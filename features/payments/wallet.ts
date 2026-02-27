import { db } from '@/lib/db';
import { users, transactions, escrow, jobs, workers } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import Stripe from 'stripe';

if (!process.env.STRIPE_RESTRICTED_KEY) {
  throw new Error('STRIPE_RESTRICTED_KEY is not set');
}

const stripe = new Stripe(process.env.STRIPE_RESTRICTED_KEY, {
  apiVersion: '2023-10-16',
});

const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT) || 10;

export class WalletService {
  /**
   * Create Stripe Checkout session to add funds to wallet
   */
  async createAddFundsSession(userId: string, amount: number): Promise<string> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new Error('User not found');
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Wallet Credit',
              description: 'Add funds to your Agent Marketplace wallet',
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?cancelled=true`,
      metadata: {
        userId,
        type: 'wallet_topup',
      },
    });

    return session.url!;
  }

  /**
   * Process successful payment and credit wallet
   * Called by Stripe webhook handler
   */
  async creditWallet(userId: string, amount: number, stripeSessionId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Update wallet balance
      const [updatedUser] = await tx
        .update(users)
        .set({
          walletBalance: sql`wallet_balance + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      // Log transaction
      await tx.insert(transactions).values({
        userId,
        type: 'deposit',
        amount: amount.toString(),
        balanceAfter: updatedUser.walletBalance,
        reference: stripeSessionId,
        metadata: { source: 'stripe_checkout' },
      });
    });
  }

  /**
   * Deduct funds from wallet and lock in escrow
   * Used when user hires a worker
   */
  async lockFundsForJob(
    userId: string,
    jobId: string,
    amount: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db.transaction(async (tx) => {
        // Check wallet balance
        const user = await tx.query.users.findFirst({
          where: eq(users.id, userId),
        });

        if (!user) {
          throw new Error('User not found');
        }

        const currentBalance = parseFloat(user.walletBalance);
        if (currentBalance < amount) {
          const shortfall = amount - currentBalance;
          throw new Error(
            `Insufficient funds. Balance: $${currentBalance.toFixed(2)}, Required: $${amount.toFixed(2)} (short $${shortfall.toFixed(2)}). Add funds at ${process.env.NEXT_PUBLIC_APP_URL}/wallet`
          );
        }

        // Deduct from wallet
        const [updatedUser] = await tx
          .update(users)
          .set({
            walletBalance: sql`wallet_balance - ${amount}`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))
          .returning();

        // Calculate platform fee and worker payout
        const platformFee = (amount * PLATFORM_FEE_PERCENT) / 100;
        const workerPayout = amount - platformFee;

        // Lock in escrow
        await tx.insert(escrow).values({
          jobId,
          amount: amount.toString(),
          platformFee: platformFee.toString(),
          workerPayout: workerPayout.toString(),
          status: 'locked',
        });

        // Log transaction
        await tx.insert(transactions).values({
          userId,
          type: 'deduction',
          amount: amount.toString(),
          balanceAfter: updatedUser.walletBalance,
          reference: jobId,
          metadata: { reason: 'job_escrow_lock' },
        });
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to lock funds',
      };
    }
  }

  /**
   * Release escrow funds to worker (on job approval)
   */
  async releaseEscrowToWorker(
    jobId: string,
    workerId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db.transaction(async (tx) => {
        // Get escrow record
        const escrowRecord = await tx.query.escrow.findFirst({
          where: eq(escrow.jobId, jobId),
        });

        if (!escrowRecord) {
          throw new Error('Escrow record not found');
        }

        if (escrowRecord.status !== 'locked') {
          throw new Error(`Escrow already ${escrowRecord.status}`);
        }

        // Get worker details
        const worker = await tx.query.workers.findFirst({
          where: eq(workers.id, workerId),
        });

        if (!worker || !worker.stripeAccountId) {
          throw new Error('Worker not found or Stripe account not connected');
        }

        // Transfer to worker via Stripe
        const transfer = await stripe.transfers.create({
          amount: Math.round(parseFloat(escrowRecord.workerPayout) * 100),
          currency: 'usd',
          destination: worker.stripeAccountId,
          metadata: {
            jobId,
            workerId,
          },
        });

        // Update escrow status
        await tx
          .update(escrow)
          .set({
            status: 'released',
            stripeTransferId: transfer.id,
            releasedAt: new Date(),
          })
          .where(eq(escrow.jobId, jobId));

        // Log transaction for platform fee
        const job = await tx.query.jobs.findFirst({
          where: eq(jobs.id, jobId),
        });

        if (job) {
          await tx.insert(transactions).values({
            userId: job.userId,
            type: 'payout',
            amount: escrowRecord.workerPayout,
            balanceAfter: '0', // Not applicable for platform fees
            reference: jobId,
            metadata: {
              workerId,
              stripeTransferId: transfer.id,
              platformFee: escrowRecord.platformFee,
            },
          });
        }
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to release escrow',
      };
    }
  }

  /**
   * Refund escrowed funds to user wallet (on job rejection/cancellation)
   */
  async refundEscrowToWallet(jobId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await db.transaction(async (tx) => {
        // Get escrow and job
        const escrowRecord = await tx.query.escrow.findFirst({
          where: eq(escrow.jobId, jobId),
        });

        if (!escrowRecord) {
          throw new Error('Escrow record not found');
        }

        if (escrowRecord.status !== 'locked') {
          throw new Error(`Escrow already ${escrowRecord.status}`);
        }

        const job = await tx.query.jobs.findFirst({
          where: eq(jobs.id, jobId),
        });

        if (!job) {
          throw new Error('Job not found');
        }

        // Refund to wallet
        const [updatedUser] = await tx
          .update(users)
          .set({
            walletBalance: sql`wallet_balance + ${escrowRecord.amount}`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, job.userId))
          .returning();

        // Update escrow status
        await tx
          .update(escrow)
          .set({
            status: 'refunded',
            releasedAt: new Date(),
          })
          .where(eq(escrow.jobId, jobId));

        // Log transaction
        await tx.insert(transactions).values({
          userId: job.userId,
          type: 'refund',
          amount: escrowRecord.amount,
          balanceAfter: updatedUser.walletBalance,
          reference: jobId,
          metadata: { reason: 'job_rejected_or_cancelled' },
        });
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refund escrow',
      };
    }
  }

  /**
   * Get wallet balance and recent transactions
   */
  async getWalletInfo(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new Error('User not found');
    }

    const recentTransactions = await db.query.transactions.findMany({
      where: eq(transactions.userId, userId),
      orderBy: (transactions, { desc }) => [desc(transactions.createdAt)],
      limit: 20,
    });

    return {
      balance: parseFloat(user.walletBalance),
      transactions: recentTransactions,
    };
  }

  /**
   * Check if user needs wallet top-up alert
   */
  async checkLowBalanceAlert(userId: string): Promise<boolean> {
    const minBalance = Number(process.env.MIN_WALLET_BALANCE_ALERT) || 20;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return false;
    }

    return parseFloat(user.walletBalance) < minBalance;
  }
}

export const walletService = new WalletService();
