import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { jobService } from '@/features/jobs/service';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit } from '@/lib/middleware/rate-limit';

const createJobSchema = z.object({
  type: z.enum(['skill', 'worker']),
  skillId: z.string().optional(),
  workerId: z.string().optional(),
  task: z.string().min(1),
  inputs: z.record(z.any()).optional(),
  context: z.record(z.any()).optional(),
  budget: z.number().min(0),
});

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = auth();

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const jobs = await jobService.getUserJobs(user.id);

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Jobs fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch jobs' },
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
    const data = createJobSchema.parse(body);

    const job = await jobService.createJob({
      ...data,
      userId: user.id,
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error('Job creation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create job' },
      { status: 500 }
    );
  }
}
