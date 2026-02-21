import { NextRequest, NextResponse } from 'next/server';
import { workerService } from '@/features/workers/service';
import { rateLimit } from '@/lib/middleware/rate-limit';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Rate limit check (normal)
  const limitCheck = rateLimit(req);
  if (limitCheck) return limitCheck;

  try {
    const worker = await workerService.getWorker(params.id);

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    const stats = await workerService.getWorkerStats(params.id);

    return NextResponse.json({ worker, stats });
  } catch (error) {
    console.error('Worker fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch worker' },
      { status: 500 }
    );
  }
}
