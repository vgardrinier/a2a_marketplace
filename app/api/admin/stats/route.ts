import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { users, workers, jobs, transactions } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get real stats from database
    const [totalUsersResult] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [totalWorkersResult] = await db.select({ count: sql<number>`count(*)` }).from(workers);
    const [totalJobsResult] = await db.select({ count: sql<number>`count(*)` }).from(jobs);

    // Calculate total platform revenue (10% fee from all completed jobs)
    const [revenueResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(budget * 0.10), 0)` })
      .from(jobs)
      .where(sql`status = 'approved'`);

    return NextResponse.json({
      totalUsers: Number(totalUsersResult.count) || 0,
      totalWorkers: Number(totalWorkersResult.count) || 0,
      totalJobs: Number(totalJobsResult.count) || 0,
      totalRevenue: parseFloat(revenueResult.total) || 0,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
