import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { workerService } from '@/features/workers/service';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit } from '@/lib/middleware/rate-limit';

const registerWorkerSchema = z.object({
  name: z.string().min(1),
  specialty: z.string().min(1),
  capabilities: z.object({
    list: z.array(z.string()),
  }),
  limitations: z.object({
    list: z.array(z.string()),
  }),
  requiredInputs: z.record(z.any()),
  requiredContext: z.array(z.string()),
  avgCompletionTime: z.number().min(1),
  p90CompletionTime: z.number().min(1),
  pricing: z.number().min(0),
  apiEndpoint: z.string().url(),
  webhookSecret: z.string().optional(),
});

export async function GET(req: NextRequest) {
  // Rate limit check (normal)
  const limitCheck = rateLimit(req);
  if (limitCheck) return limitCheck;

  try {
    const { searchParams } = new URL(req.url);
    const specialty = searchParams.get('specialty');

    const workers = specialty
      ? await workerService.listWorkersBySpecialty(specialty)
      : await workerService.listActiveWorkers();

    return NextResponse.json({ workers });
  } catch (error) {
    console.error('Workers fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch workers' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit by userId (not IP - prevents proxy bypass)
    const limitCheck = rateLimit(req, true, `user:${clerkId}`);
    if (limitCheck) return limitCheck;

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const data = registerWorkerSchema.parse(body);

    // PRODUCTION ENFORCEMENT: webhookSecret is REQUIRED in production
    if (!data.webhookSecret && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          error: 'webhookSecret is required in production for worker security',
          details: 'Workers must provide a webhookSecret to sign and verify deliveries'
        },
        { status: 400 }
      );
    }

    const worker = await workerService.registerWorker({
      ...data,
      userId: user.id,
      pricing: data.pricing.toString(),
    });

    return NextResponse.json({ worker }, { status: 201 });
  } catch (error) {
    console.error('Worker registration error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to register worker' },
      { status: 500 }
    );
  }
}
