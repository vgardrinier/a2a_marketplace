import { db } from '@/lib/db';
import { workers, skills, type Worker, type Skill } from '@/lib/db/schema';
import { eq, like, and, sql } from 'drizzle-orm';

export interface MatchRequest {
  task: string;
  specialty?: string;
  budget?: number;
  requiredCapabilities?: string[];
}

export interface WorkerMatch {
  worker: Worker;
  score: number;
  reasons: string[];
  confidence: 'high' | 'medium' | 'low';
}

export type MatchResult =
  | { type: 'skill'; skill: Skill }
  | {
      type: 'worker';
      matches: WorkerMatch[]; // Top 5 matches with scores and reasoning
      recommendation: string; // Why we suggest workers over skills
    }
  | { type: 'none'; message: string };

export class WorkerMatcher {
  /**
   * Find best match (skill or worker) for a request
   */
  async findMatch(request: MatchRequest): Promise<MatchResult> {
    // Step 1: Try to match a skill first (instant, free)
    const skillMatch = await this.findSkillMatch(request);
    if (skillMatch) {
      return { type: 'skill', skill: skillMatch };
    }

    // Step 2: No skill found, match workers
    const workerMatches = await this.findWorkerMatches(request);

    if (workerMatches.length === 0) {
      return {
        type: 'none',
        message: 'No workers found matching your requirements. Try adjusting your request.',
      };
    }

    return {
      type: 'worker',
      matches: workerMatches.slice(0, 5), // Top 5 matches with scores
      recommendation: this.getRecommendationReason(request),
    };
  }

  /**
   * Explain why we're recommending workers over skills
   */
  private getRecommendationReason(request: MatchRequest): string {
    const task = request.task.toLowerCase();
    const reasons: string[] = [];

    // Heuristics for complexity
    if (task.includes('refactor') || task.includes('redesign')) {
      reasons.push('Requires design judgment and multi-step thinking');
    }
    if (task.includes('complex') || task.includes('multiple')) {
      reasons.push('Multi-step task requiring human oversight');
    }
    if (task.includes('custom') || task.includes('specific')) {
      reasons.push('Custom work tailored to your needs');
    }

    if (reasons.length === 0) {
      reasons.push('Task requires flexible problem-solving');
    }

    return reasons.join(' • ');
  }

  /**
   * Try to find matching skill
   */
  private async findSkillMatch(request: MatchRequest): Promise<Skill | null> {
    // Extract keywords from task
    const keywords = this.extractKeywords(request.task);

    // Search skills by name, description, category
    for (const keyword of keywords) {
      const matches = await db.query.skills.findMany({
        where: sql`
          ${skills.name} ILIKE ${`%${keyword}%`} OR
          ${skills.description} ILIKE ${`%${keyword}%`} OR
          ${skills.category} ILIKE ${`%${keyword}%`}
        `,
        limit: 1,
      });

      if (matches.length > 0) {
        return matches[0];
      }
    }

    return null;
  }

  /**
   * Find matching workers, ranked by fit with scores and reasoning
   */
  private async findWorkerMatches(request: MatchRequest): Promise<WorkerMatch[]> {
    let query = db
      .select()
      .from(workers)
      .where(eq(workers.status, 'active'));

    // Filter by specialty if provided
    if (request.specialty) {
      query = query.where(eq(workers.specialty, request.specialty)) as any;
    }

    // Filter by budget if provided
    if (request.budget) {
      query = query.where(sql`${workers.pricing}::numeric <= ${request.budget}`) as any;
    }

    const candidates = await query;

    // Parse keywords from task
    const keywords = this.extractKeywords(request.task);

    // Score and rank candidates with reasoning
    const scored = candidates.map((worker) => {
      let score = 0;
      const reasons: string[] = [];

      // 1. Reputation score (0-5 stars → 0-50 points)
      const reputation = parseFloat(worker.reputationScore || '0');
      score += reputation * 10;
      if (reputation >= 4.5) {
        reasons.push(`High rating: ${reputation}/5`);
      }

      // 2. Completion count (more experienced = better)
      const experiencePoints = Math.min(worker.completionCount * 0.5, 20);
      score += experiencePoints;
      if (worker.completionCount > 50) {
        reasons.push(`Experienced: ${worker.completionCount} jobs completed`);
      } else if (worker.completionCount > 10) {
        reasons.push(`${worker.completionCount} jobs completed`);
      }

      // 3. Keyword matching in capabilities
      const capabilities = (worker.capabilities as any)?.list || [];
      const matchingKeywords = keywords.filter((kw) =>
        capabilities.some((cap: string) => cap.toLowerCase().includes(kw))
      );
      score += matchingKeywords.length * 10;
      if (matchingKeywords.length > 0) {
        reasons.push(`Specialty match: ${worker.specialty}`);
      }

      // 4. Check if request conflicts with limitations
      const limitations = (worker.limitations as any)?.list || [];
      const hasConflict = keywords.some((kw) =>
        limitations.some((lim: string) => lim.toLowerCase().includes(kw))
      );
      if (hasConflict) {
        score -= 50; // Heavy penalty for conflicts
        reasons.push('⚠️ May have limitations for this task');
      }

      // 5. Pricing (cheaper is slightly better, but not main factor)
      const pricing = parseFloat(worker.pricing);
      score += Math.max(0, 10 - pricing / 5); // Max 10 points
      if (pricing <= 10) {
        reasons.push('Affordable pricing');
      }

      // 6. Avg completion time (faster is better)
      score += Math.max(0, 10 - worker.avgCompletionTime / 10); // Max 10 points
      if (worker.avgCompletionTime <= 20) {
        reasons.push(`Fast: ~${worker.avgCompletionTime} min avg`);
      }

      // Determine confidence level
      let confidence: 'high' | 'medium' | 'low';
      if (score >= 70) {
        confidence = 'high';
      } else if (score >= 40) {
        confidence = 'medium';
      } else {
        confidence = 'low';
      }

      if (confidence === 'low') {
        reasons.push('Low confidence match');
      }

      return { worker, score, reasons, confidence };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Filter out negative scores (incompatible)
    return scored.filter((s) => s.score > 0);
  }

  /**
   * Extract keywords from task description
   */
  private extractKeywords(task: string): string[] {
    // Convert to lowercase
    const normalized = task.toLowerCase();

    // Common stop words to ignore
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'was',
      'are',
      'were',
      'been',
      'be',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'should',
      'could',
      'may',
      'might',
      'must',
      'can',
      'this',
      'that',
      'these',
      'those',
      'my',
      'your',
      'i',
      'you',
      'we',
      'they',
      'it',
    ]);

    // Extract words (alphanumeric)
    const words = normalized.match(/\b[a-z0-9]+\b/g) || [];

    // Filter stop words and short words
    const keywords = words.filter((w) => w.length > 2 && !stopWords.has(w));

    // Remove duplicates
    return Array.from(new Set(keywords));
  }

  /**
   * Get specialty suggestions based on common patterns
   */
  getSpecialtySuggestions(task: string): string[] {
    const normalized = task.toLowerCase();
    const suggestions: string[] = [];

    const patterns = {
      'landing-page-design': ['landing', 'homepage', 'hero', 'landing page'],
      'seo-optimization': ['seo', 'search', 'optimization', 'meta tags', 'sitemap'],
      'refactoring': ['refactor', 'cleanup', 'improve', 'reorganize'],
      'api-integration': ['api', 'integration', 'webhook', 'connect'],
      'ui-design': ['design', 'ui', 'interface', 'layout', 'style'],
      'performance': ['performance', 'optimize', 'speed', 'slow', 'fast'],
      'testing': ['test', 'testing', 'unit test', 'e2e'],
      'documentation': ['docs', 'documentation', 'readme', 'comments'],
    };

    for (const [specialty, keywords] of Object.entries(patterns)) {
      if (keywords.some((kw) => normalized.includes(kw))) {
        suggestions.push(specialty);
      }
    }

    return suggestions;
  }
}

export const workerMatcher = new WorkerMatcher();
