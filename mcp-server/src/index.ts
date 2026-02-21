#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SkillLibrary } from './skills.js';
import path from 'path';

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const WORKSPACE_PATH = process.cwd();
const SKILLS_PATH = path.join(WORKSPACE_PATH, 'skills');

class AgentMarketplaceServer {
  private server: Server;
  private skillLibrary: SkillLibrary;
  private apiKey: string | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'agent-marketplace',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.skillLibrary = new SkillLibrary(SKILLS_PATH, WORKSPACE_PATH);

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'execute_skill',
          description: 'Execute a skill locally (instant, free)',
          inputSchema: {
            type: 'object',
            properties: {
              skillId: {
                type: 'string',
                description: 'Skill ID to execute (e.g., seo-meta-tags)',
              },
              inputs: {
                type: 'object',
                description: 'Input parameters for the skill',
              },
              targetFiles: {
                type: 'array',
                items: { type: 'string' },
                description: 'Files to operate on',
              },
            },
            required: ['skillId'],
          },
        },
        {
          name: 'hire_worker',
          description: 'Hire a specialist worker for custom work (paid)',
          inputSchema: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: 'Description of the task',
              },
              specialty: {
                type: 'string',
                description: 'Worker specialty (optional)',
              },
              budget: {
                type: 'number',
                description: 'Maximum budget in USD',
              },
              context: {
                type: 'object',
                description: 'Context files and metadata',
              },
            },
            required: ['task'],
          },
        },
        {
          name: 'check_job',
          description: 'Check status of a job',
          inputSchema: {
            type: 'object',
            properties: {
              jobId: {
                type: 'string',
                description: 'Job ID to check',
              },
            },
            required: ['jobId'],
          },
        },
        {
          name: 'approve_job',
          description: 'Approve job and release payment',
          inputSchema: {
            type: 'object',
            properties: {
              jobId: {
                type: 'string',
                description: 'Job ID to approve',
              },
              rating: {
                type: 'number',
                description: 'Rating from 1-5',
                minimum: 1,
                maximum: 5,
              },
              feedback: {
                type: 'string',
                description: 'Optional feedback',
              },
            },
            required: ['jobId', 'rating'],
          },
        },
        {
          name: 'reject_job',
          description: 'Reject job and request refund',
          inputSchema: {
            type: 'object',
            properties: {
              jobId: {
                type: 'string',
                description: 'Job ID to reject',
              },
              reason: {
                type: 'string',
                description: 'Reason for rejection',
              },
            },
            required: ['jobId', 'reason'],
          },
        },
        {
          name: 'check_wallet',
          description: 'Check wallet balance',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'execute_skill':
            return await this.executeSkill(args as any);
          case 'hire_worker':
            return await this.hireWorker(args as any);
          case 'check_job':
            return await this.checkJob(args as any);
          case 'approve_job':
            return await this.approveJob(args as any);
          case 'reject_job':
            return await this.rejectJob(args as any);
          case 'check_wallet':
            return await this.checkWallet();
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async executeSkill(args: {
    skillId: string;
    inputs?: Record<string, any>;
    targetFiles?: string[];
  }) {
    // Load skill definition
    const skill = await this.skillLibrary.loadSkill(args.skillId);

    // Gather context from files
    const context = await this.skillLibrary.gatherContext(
      skill.context_patterns || [],
      args.targetFiles || []
    );

    // Format for Claude to read
    const formattedPrompt = this.skillLibrary.formatForClaude(skill, context);

    return {
      content: [
        {
          type: 'text',
          text: formattedPrompt,
        },
      ],
    };
  }

  private async hireWorker(args: {
    task: string;
    specialty?: string;
    budget?: number;
    context?: Record<string, any>;
  }) {
    const response = await fetch(`${API_BASE_URL}/api/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: args.task,
        specialty: args.specialty,
        budget: args.budget,
      }),
    });

    if (!response.ok) {
      throw new Error(`Match API failed: ${response.statusText}`);
    }

    const { match } = await response.json();

    if (match.type === 'skill') {
      return {
        content: [
          {
            type: 'text',
            text: `Found matching skill: ${match.skill.name}\n\nExecute with: execute_skill(skillId: "${match.skill.id}")`,
          },
        ],
      };
    }

    if (match.type === 'worker') {
      const { matches, recommendation } = match;

      // Build transparent worker list with reasoning
      let text = '💡 Recommended: Hire a Worker\n\n';
      text += `Why: ${recommendation}\n\n`;
      text += '─────────────────────────────────────\n';
      text += `Top ${Math.min(matches.length, 5)} Matching Workers:\n\n`;

      matches.slice(0, 5).forEach((m: any, index: number) => {
        const confidenceIcon =
          m.confidence === 'high' ? '🟢' : m.confidence === 'medium' ? '🟡' : '🔴';

        text += `${index + 1}. ${m.worker.name} ${confidenceIcon}\n`;
        text += `   Specialty: ${m.worker.specialty}\n`;
        text += `   Rating: ${m.worker.reputationScore}/5 (${m.worker.completionCount} jobs)\n`;
        text += `   Avg Time: ~${m.worker.avgCompletionTime} min\n`;
        text += `   Est Cost: $${m.worker.pricing}\n`;
        text += `   Match: ${Math.round(m.score)}% - ${m.reasons.join(', ')}\n`;
        text += `   Confidence: ${m.confidence.toUpperCase()}\n`;
        text += '\n';
      });

      text += '─────────────────────────────────────\n\n';
      text += '📌 To hire a worker, note their number and:\n';
      text += '   1. Check your wallet: check_wallet()\n';
      text += '   2. Create job with preferred worker\n\n';

      if (matches.length > 5) {
        text += `💡 Showing top 5 of ${matches.length} matching workers\n\n`;
      }

      text += 'Or type: execute_skill(...) to try a pre-built skill instead';

      return {
        content: [{ type: 'text', text }],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: match.message || 'No match found',
        },
      ],
    };
  }

  private async checkJob(args: { jobId: string }) {
    const response = await fetch(`${API_BASE_URL}/api/jobs/${args.jobId}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Job fetch failed: ${response.statusText}`);
    }

    const { job } = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: `Job ${job.id}\n\nStatus: ${job.status}\nTask: ${job.task}\nBudget: $${job.budget}\nCreated: ${new Date(job.createdAt).toLocaleString()}\n${job.deliveredAt ? `\nDelivered: ${new Date(job.deliveredAt).toLocaleString()}` : ''}`,
        },
      ],
    };
  }

  private async approveJob(args: {
    jobId: string;
    rating: number;
    feedback?: string;
  }) {
    const response = await fetch(
      `${API_BASE_URL}/api/jobs/${args.jobId}/approve`,
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: args.rating,
          feedback: args.feedback,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Approval failed: ${response.statusText}`);
    }

    const { job } = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: `✓ Job approved!\n\nPayment released to worker.\nRating: ${args.rating}/5`,
        },
      ],
    };
  }

  private async rejectJob(args: { jobId: string; reason: string }) {
    const response = await fetch(
      `${API_BASE_URL}/api/jobs/${args.jobId}/reject`,
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: args.reason,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Rejection failed: ${response.statusText}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: `✓ Job rejected.\n\nFunds refunded to your wallet.`,
        },
      ],
    };
  }

  private async checkWallet() {
    const response = await fetch(`${API_BASE_URL}/api/wallet`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Wallet fetch failed: ${response.statusText}`);
    }

    const { balance, needsTopUp } = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: `Wallet Balance: $${balance.toFixed(2)}\n${needsTopUp ? '\n⚠️ Low balance - consider topping up' : ''}`,
        },
      ],
    };
  }

  private getAuthHeaders(): Record<string, string> {
    if (this.apiKey) {
      return {
        Authorization: `Bearer ${this.apiKey}`,
      };
    }
    return {};
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Agent Marketplace MCP server running on stdio');
  }
}

const server = new AgentMarketplaceServer();
server.run().catch(console.error);
