import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { jobService } from '@/features/jobs/service';
import { z } from 'zod';
import { rateLimit } from '@/lib/middleware/rate-limit';

const approveJobSchema = z.object({
  rating: z.number().min(1).max(5),
  feedback: z.string().optional(),
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
    const { rating, feedback } = approveJobSchema.parse(body);

    // CRITICAL: Pass userId to verify job ownership
    const job = await jobService.approveJob(params.id, userId, rating, feedback);

    return NextResponse.json({ job });
  } catch (error) {
    console.error('Job approval error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve job' },
      { status: 500 }
    );
  }
}
