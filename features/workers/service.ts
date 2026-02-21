import { db } from '@/lib/db';
import { workers, type Worker, type NewWorker } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export class WorkerService {
  /**
   * Register new worker
   */
  async registerWorker(data: NewWorker): Promise<Worker> {
    // Validate required fields
    if (!data.name || !data.specialty || !data.apiEndpoint) {
      throw new Error('Missing required fields');
    }

    // Set status to pending until admin approval
    const [worker] = await db
      .insert(workers)
      .values({
        ...data,
        status: 'pending',
      })
      .returning();

    return worker;
  }

  /**
   * Get worker by ID
   */
  async getWorker(workerId: string): Promise<Worker | null> {
    const worker = await db.query.workers.findFirst({
      where: eq(workers.id, workerId),
    });

    return worker || null;
  }

  /**
   * List all active workers
   */
  async listActiveWorkers(): Promise<Worker[]> {
    return await db.query.workers.findMany({
      where: eq(workers.status, 'active'),
      orderBy: (workers, { desc }) => [desc(workers.reputationScore)],
    });
  }

  /**
   * List workers by specialty
   */
  async listWorkersBySpecialty(specialty: string): Promise<Worker[]> {
    return await db.query.workers.findMany({
      where: and(eq(workers.specialty, specialty), eq(workers.status, 'active')),
      orderBy: (workers, { desc }) => [desc(workers.reputationScore)],
    });
  }

  /**
   * Update worker profile
   */
  async updateWorker(workerId: string, updates: Partial<NewWorker>): Promise<Worker> {
    const [worker] = await db
      .update(workers)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(workers.id, workerId))
      .returning();

    if (!worker) {
      throw new Error('Worker not found');
    }

    return worker;
  }

  /**
   * Approve worker (admin only)
   */
  async approveWorker(workerId: string): Promise<Worker> {
    const [worker] = await db
      .update(workers)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(workers.id, workerId))
      .returning();

    if (!worker) {
      throw new Error('Worker not found');
    }

    return worker;
  }

  /**
   * Suspend worker (admin only)
   */
  async suspendWorker(workerId: string): Promise<Worker> {
    const [worker] = await db
      .update(workers)
      .set({
        status: 'suspended',
        updatedAt: new Date(),
      })
      .where(eq(workers.id, workerId))
      .returning();

    if (!worker) {
      throw new Error('Worker not found');
    }

    return worker;
  }

  /**
   * Update worker reputation after job completion
   */
  async updateReputation(workerId: string, rating: number): Promise<void> {
    await db.transaction(async (tx) => {
      const worker = await tx.query.workers.findFirst({
        where: eq(workers.id, workerId),
      });

      if (!worker) {
        throw new Error('Worker not found');
      }

      const currentScore = parseFloat(worker.reputationScore || '0');
      const currentCount = worker.completionCount;

      // Calculate new weighted average
      const newScore = (currentScore * currentCount + rating) / (currentCount + 1);

      await tx
        .update(workers)
        .set({
          reputationScore: newScore.toFixed(2),
          completionCount: currentCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(workers.id, workerId));
    });
  }

  /**
   * Get worker stats
   */
  async getWorkerStats(workerId: string) {
    const worker = await db.query.workers.findFirst({
      where: eq(workers.id, workerId),
    });

    if (!worker) {
      throw new Error('Worker not found');
    }

    // Get job statistics
    const jobStats = await db.query.jobs.findMany({
      where: eq(db.$with('jobs').workerId, workerId),
    });

    const totalJobs = jobStats.length;
    const approvedJobs = jobStats.filter((j) => j.status === 'approved').length;
    const rejectedJobs = jobStats.filter((j) => j.status === 'rejected').length;
    const averageRating =
      jobStats.reduce((sum, j) => sum + (j.rating || 0), 0) / (totalJobs || 1);

    return {
      worker,
      stats: {
        totalJobs,
        approvedJobs,
        rejectedJobs,
        approvalRate: totalJobs > 0 ? (approvedJobs / totalJobs) * 100 : 0,
        averageRating,
      },
    };
  }
}

export const workerService = new WorkerService();
