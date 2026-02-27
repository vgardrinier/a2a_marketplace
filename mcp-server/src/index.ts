#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SkillLibrary } from './skills.js';
import { CatalogLibrary } from './catalog.js';
import { detectProjectContext } from './detect.js';
import type { ProjectProfile } from './types.js';
import path from 'path';

import type { CatalogEntry } from './types.js';

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://a2a-marketplace-three.vercel.app';
const WORKSPACE_PATH = process.cwd();
const SKILLS_PATH = path.join(WORKSPACE_PATH, 'skills');

/**
 * Format the solve response from a profile + filtered catalog entries.
 * Exported for testing.
 */
export function formatSolveResponse(
  profile: ProjectProfile,
  entries: CatalogEntry[],
  task: string,
  targetFiles?: string[],
): string {
  const parts: string[] = [];

  parts.push('## Your Project');
  parts.push(`- Language: ${profile.language.join(', ')}`);
  if (profile.framework) parts.push(`- Framework: ${profile.framework}`);
  if (profile.configs.length > 0) parts.push(`- Detected: ${profile.configs.join(', ')}`);
  if (profile.dependencies.length > 0) {
    const topDeps = profile.dependencies.slice(0, 15);
    parts.push(`- Deps: ${topDeps.join(', ')}${profile.dependencies.length > 15 ? ` (+${profile.dependencies.length - 15} more)` : ''}`);
  }
  if (profile.packageManager) parts.push(`- Package manager: ${profile.packageManager}`);
  parts.push('');

  if (entries.length > 0) {
    parts.push('## Available Solutions');
    parts.push('');
    for (const entry of entries) {
      parts.push(`### ${entry.id} (${entry.type})`);
      parts.push(entry.description);
      if (entry.instructions && entry.instructions !== entry.description) {
        parts.push('');
        parts.push(entry.instructions.trim());
      }
      parts.push('');
    }
  } else {
    parts.push('## No catalog solutions matched this project.');
    parts.push('Proceed with your own judgment.');
    parts.push('');
  }

  parts.push(`## User's Task`);
  parts.push(`"${task}"`);
  if (targetFiles?.length) {
    parts.push(`Target files: ${targetFiles.join(', ')}`);
  }
  parts.push('');
  parts.push('Pick the best solution and execute it. If none fit, use your own judgment.');

  return parts.join('\n');
}

class MentatServer {
  private server: Server;
  private skillLibrary: SkillLibrary;
  private catalogLibrary: CatalogLibrary;
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
    this.catalogLibrary = new CatalogLibrary(WORKSPACE_PATH);

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'solve',
          description:
            'Only use when the user explicitly mentions Mentat or asks for Mentat\'s help. ' +
            'Routes to the best skill, CLI, or agent for the task. ' +
            'Mentat detects the project stack automatically.',
          inputSchema: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: 'What the user wants to do, in plain english',
              },
              targetFiles: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific files to focus on (optional)',
              },
            },
            required: ['task'],
          },
        },
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
          description: 'Get expert help with custom tasks (coming soon)',
          inputSchema: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: 'What needs to be done',
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
          case 'solve':
            return await this.solve(args as any);
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

  private async solve(args: { task: string; targetFiles?: string[] }) {
    const profile = await detectProjectContext(WORKSPACE_PATH);
    const entries = await this.catalogLibrary.getRelevantEntries(profile);
    const text = formatSolveResponse(profile, entries, args.task, args.targetFiles);

    return {
      content: [{ type: 'text', text }],
    };
  }

  private async executeSkill(args: {
    skillId: string;
    inputs?: Record<string, any>;
    targetFiles?: string[];
  }) {
    // Try catalog first, fall back to legacy SkillLibrary
    const catalogEntry = await this.catalogLibrary.getEntryById(args.skillId);

    if (catalogEntry) {
      const context = await this.skillLibrary.gatherContext(
        catalogEntry.context_patterns || [],
        args.targetFiles || []
      );
      return {
        content: [
          {
            type: 'text',
            text: this.skillLibrary.formatForClaude(
              {
                id: catalogEntry.id,
                name: catalogEntry.name,
                description: catalogEntry.description,
                instructions: catalogEntry.instructions,
                context_patterns: catalogEntry.context_patterns,
                examples: catalogEntry.examples,
              },
              context
            ),
          },
        ],
      };
    }

    // Legacy path
    const skill = await this.skillLibrary.loadSkill(args.skillId);
    const context = await this.skillLibrary.gatherContext(
      skill.context_patterns || [],
      args.targetFiles || []
    );
    const formattedPrompt = this.skillLibrary.formatForClaude(skill, context);

    return {
      content: [{ type: 'text', text: formattedPrompt }],
    };
  }

  private async hireWorker(_args: { task: string }) {
    return {
      content: [
        {
          type: 'text',
          text: [
            'Worker marketplace coming soon.',
            '',
            'For now, use `solve` to find available skills and CLI tools that can help with your task.',
          ].join('\n'),
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

    return {
      content: [
        {
          type: 'text',
          text: `Job approved. Payment released to worker. Rating: ${args.rating}/5`,
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
          text: `Job rejected. Funds refunded to your wallet.`,
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
          text: `Wallet Balance: $${balance.toFixed(2)}\n${needsTopUp ? '\nLow balance - consider topping up' : ''}`,
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
