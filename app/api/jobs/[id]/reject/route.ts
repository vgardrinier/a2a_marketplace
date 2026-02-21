import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { jobService } from '@/features/jobs/service';
import { z } from 'zod';
import { rateLimit } from '@/lib/middleware/rate-limit';

const rejectJobSchema = z.object({
  reason: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // CRITICAL: Verify authentication (belt-and-suspenders with middleware)
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit by userId (not IP - prevents proxy bypass)
  const limitCheck = rateLimit(req, true, `user:${userId}`);
  if (limitCheck) return limitCheck;

  try {
    const body = await req.json();
    const { reason } = rejectJobSchema.parse(body);

    // CRITICAL: Pass userId to verify job ownership
    const job = await jobService.rejectJob(params.id, userId, reason);

    return NextResponse.json({ job });
  } catch (error) {
    console.error('Job rejection error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reject job' },
      { status: 500 }
    );
  }
}
