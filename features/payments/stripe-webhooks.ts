import Stripe from 'stripe';
import { walletService } from './wallet';

if (!process.env.STRIPE_RESTRICTED_KEY) {
  throw new Error('STRIPE_RESTRICTED_KEY is not set');
}

const stripe = new Stripe(process.env.STRIPE_RESTRICTED_KEY, {
  apiVersion: '2023-10-16',
});

export class StripeWebhookHandler {
  /**
   * Verify webhook signature - CRITICAL SECURITY
   */
  verifyWebhook(payload: string, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // SECURITY: Fail closed - if no secret configured, reject all webhooks
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured - rejecting webhook for security');
    }

    try {
      // This throws if signature is invalid
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      // SECURITY: Log but don't reveal details to attacker
      console.error('Webhook signature verification failed');
      throw new Error('Webhook signature verification failed');
    }
  }

  /**
   * Handle webhook events
   */
  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'account.updated':
        await this.handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle successful checkout (wallet top-up)
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const { userId, type } = session.metadata || {};

    if (type !== 'wallet_topup' || !userId) {
      console.log('Skipping non-wallet checkout session');
      return;
    }

    const amountInDollars = (session.amount_total || 0) / 100;

    await walletService.creditWallet(userId, amountInDollars, session.id);

    console.log(`Credited $${amountInDollars} to user ${userId}`);
  }

  /**
   * Handle Stripe Connect account updates
   */
  private async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    // Check if account is fully onboarded
    if (account.charges_enabled && account.payouts_enabled) {
      console.log(`Worker account ${account.id} is fully enabled`);
    } else {
      console.log(`Worker account ${account.id} pending verification`);
    }
  }
}

export const stripeWebhookHandler = new StripeWebhookHandler();
