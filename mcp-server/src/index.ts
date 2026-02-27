#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SkillLibrary } from './skills.js';
import path from 'path';

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://a2a-marketplace-three.vercel.app';
const WORKSPACE_PATH = process.cwd();
const SKILLS_PATH = path.join(WORKSPACE_PATH, 'skills');

class MentatServer {
  private server: Server;
  private skillLibrary: SkillLibrary;
  private apiKey: string | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'mentat',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.skillLibrary = new SkillLibrary(SKILLS_PATH, WORKSPACE_PATH, API_BASE_URL);

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'execute_skill',
          description: 'Apply instant code improvements using pre-built skills (free)',
          inputSchema: {
            type: 'object',
            properties: {
              skillId: {
                type: 'string',
                description: 'Which skill to apply (e.g., seo-meta-tags for adding SEO metadata)',
              },
              inputs: {
                type: 'object',
                description: 'Customization options for the skill',
              },
              targetFiles: {
                type: 'array',
                items: { type: 'string' },
                description: 'Which files to modify',
              },
            },
            required: ['skillId'],
          },
        },
        {
          name: 'hire_worker',
          description: 'Get expert help with custom tasks (pay only for completed work)',
          inputSchema: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: 'What needs to be done',
              },
              specialty: {
                type: 'string',
                description: 'Type of expert needed (e.g., "frontend", "API design")',
              },
              budget: {
                type: 'number',
                description: 'Maximum you want to spend in USD',
              },
              context: {
                type: 'object',
                description: 'Additional context to help match the right expert',
              },
            },
            required: ['task'],
          },
        },
        {
          name: 'check_job',
          description: 'See progress and status of work in progress',
          inputSchema: {
            type: 'object',
            properties: {
              jobId: {
                type: 'string',
                description: 'ID of the job to check on',
              },
            },
            required: ['jobId'],
          },
        },
        {
          name: 'approve_job',
          description: 'Accept completed work and release payment to the worker',
          inputSchema: {
            type: 'object',
            properties: {
              jobId: {
                type: 'string',
                description: 'ID of the completed job',
              },
              rating: {
                type: 'number',
                description: 'Your rating of the work quality (1-5 stars)',
                minimum: 1,
                maximum: 5,
              },
              feedback: {
                type: 'string',
                description: 'Comments about the work (optional)',
              },
            },
            required: ['jobId', 'rating'],
          },
        },
        {
          name: 'reject_job',
          description: 'Request a refund for unsatisfactory work',
          inputSchema: {
            type: 'object',
            properties: {
              jobId: {
                type: 'string',
                description: 'ID of the job you want to reject',
              },
              reason: {
                type: 'string',
                description: 'Why the work was unsatisfactory',
              },
            },
            required: ['jobId', 'reason'],
          },
        },
        {
          name: 'check_wallet',
          description: 'View your current wallet balance',
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
      const skillInfo = [
        `Great news! I found a pre-built skill that can handle this instantly (no cost):`,
        ``,
        `**${match.skill.name}**`,
        match.skill.description || '',
        ``,
        `Ready to apply this skill?`,
      ].join('\n');

      return {
        content: [
          {
            type: 'text',
            text: skillInfo,
          },
        ],
      };
    }

    if (match.type === 'worker') {
      const { matches, recommendation } = match;

      // Build transparent worker list with reasoning
      let text = '💡 **Expert Help Available**\n\n';
      text += `${recommendation}\n\n`;
      text += `**Top ${Math.min(matches.length, 5)} Matching Experts:**\n\n`;

      matches.slice(0, 5).forEach((m: any, index: number) => {
        const confidenceIcon =
          m.confidence === 'high' ? '🟢' : m.confidence === 'medium' ? '🟡' : '🔴';

        text += `**${index + 1}. ${m.worker.name}** ${confidenceIcon}\n`;
        text += `   → ${m.worker.specialty}\n`;
        text += `   → ${m.worker.reputationScore}/5 stars • ${m.worker.completionCount} completed jobs\n`;
        text += `   → Typically completes in ~${m.worker.avgCompletionTime} min\n`;
        text += `   → Estimated cost: **$${m.worker.pricing}**\n`;
        text += `   → ${Math.round(m.score)}% match: ${m.reasons.join(', ')}\n`;
        text += '\n';
      });

      if (matches.length > 5) {
        text += `_Showing top 5 of ${matches.length} matching workers_\n\n`;
      }

      text += '**Ready to proceed?**\n';
      text += "I can hire one of these experts for you. They'll complete the work and you only pay when satisfied.\n";

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

    if (balance === 0) {
      return {
        content: [
          {
            type: 'text',
            text: [
              `Wallet Balance: $0.00`,
              ``,
              `All skills are free — no wallet funding needed.`,
              `You'll only need to add funds when paid workers become available.`,
              ``,
              `Top up anytime at: ${API_BASE_URL}/wallet`,
            ].join('\n'),
          },
        ],
      };
    }

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
    console.error('Mentat MCP server running on stdio');
  }
}

const server = new MentatServer();
server.run().catch(console.error);
