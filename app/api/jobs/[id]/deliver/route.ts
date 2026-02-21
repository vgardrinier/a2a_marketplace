import { NextRequest, NextResponse } from 'next/server';
import { jobService } from '@/features/jobs/service';
import { db } from '@/lib/db';
import { jobs, workers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit } from '@/lib/middleware/rate-limit';
import { verifyWebhookWithTimestamp } from '@/lib/security/webhook-crypto';

const deliverJobSchema = z.object({
  deliverableText: z.string().optional(),
  deliverableUrl: z.string().url().optional(),
  deliverableFiles: z.record(z.string()).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get job to check if worker has webhook secret
    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, params.id),
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // If job has a worker, verify webhook signature
    if (job.workerId) {
      const worker = await db.query.workers.findFirst({
        where: eq(workers.id, job.workerId),
      });

      if (!worker) {
        return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
      }

      // Rate limit by workerId (not IP - prevents abuse)
      const limitCheck = rateLimit(req, true, `worker:${worker.id}`);
      if (limitCheck) return limitCheck;

      // PRODUCTION ENFORCEMENT: webhookSecret is REQUIRED in production
      if (!worker.webhookSecret && process.env.NODE_ENV === 'production') {
        console.error('Worker missing webhookSecret in production', {
          workerId: worker.id,
          jobId: params.id,
        });
        return NextResponse.json(
          { error: 'Worker webhook signature required in production' },
          { status: 401 }
        );
      }

      // If worker has webhook secret, signature is REQUIRED
      if (worker.webhookSecret) {
        const signature = req.headers.get('X-Webhook-Signature');
        const timestamp = req.headers.get('X-Webhook-Timestamp');

        if (!signature || !timestamp) {
          console.error('Missing webhook signature or timestamp', {
            jobId: params.id,
            workerId: worker.id,
            hasSignature: !!signature,
            hasTimestamp: !!timestamp,
          });
          return NextResponse.json(
            { error: 'Webhook signature required but not provided' },
            { status: 401 }
          );
        }

        // Read raw body for signature verification
        const bodyText = await req.text();

        // Verify signature with timestamp
        const verification = verifyWebhookWithTimestamp(
          bodyText,
          signature,
          timestamp,
          worker.webhookSecret,
          300 // 5 minutes max age
        );

        if (!verification.valid) {
          console.error('Webhook signature verification failed', {
            jobId: params.id,
            workerId: worker.id,
            error: verification.error,
          });
          return NextResponse.json(
            { error: `Webhook verification failed: ${verification.error}` },
            { status: 401 }
          );
        }

        // Parse body after verification
        const data = deliverJobSchema.parse(JSON.parse(bodyText));

        const deliveredJob = await jobService.deliverJob({
          jobId: params.id,
          ...data,
        });

        return NextResponse.json({ job: deliveredJob });
      }
    }

    // No signature required (no worker or no webhook secret in dev)
    // Rate limit by IP as fallback
    const limitCheck = rateLimit(req, true);
    if (limitCheck) return limitCheck;

    const body = await req.json();
    const data = deliverJobSchema.parse(body);

    const deliveredJob = await jobService.deliverJob({
      jobId: params.id,
      ...data,
    });

    return NextResponse.json({ job: deliveredJob });
  } catch (error) {
    console.error('Job delivery error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to deliver job' },
      { status: 500 }
    );
  }
}
