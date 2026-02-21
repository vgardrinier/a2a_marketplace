import { NextRequest, NextResponse } from 'next/server';
import { jobService } from '@/features/jobs/service';
import { rateLimit } from '@/lib/middleware/rate-limit';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Rate limit check (normal)
  const limitCheck = rateLimit(req);
  if (limitCheck) return limitCheck;

  try {
    const job = await jobService.getJob(params.id);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error('Job fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch job' },
      { status: 500 }
    );
  }
}
