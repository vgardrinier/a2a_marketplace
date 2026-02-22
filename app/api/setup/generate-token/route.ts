import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

/**
 * Generate a long-lived API token for MCP server authentication
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    let user = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
    });

    // Auto-create user on first setup (same pattern as wallet route)
    if (!user) {
      const clerkUser = await clerkClient.users.getUser(clerkId);
      const email = clerkUser.emailAddresses[0]?.emailAddress || 'unknown@example.com';

      [user] = await db.insert(users).values({
        clerkId,
        email,
        walletBalance: '0.00',
      }).returning();
    }

    // Generate secure token
    const token = `amp_${createId()}`;

    // In production, you'd store this token in the database
    // For MVP, we'll use Clerk's session token
    // TODO: Add api_tokens table with: userId, token, createdAt, lastUsedAt

    return NextResponse.json({
      token,
      userId: user.id,
      message: 'Token generated successfully',
    });
  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate token' },
      { status: 500 }
    );
  }
}
