#!/usr/bin/env node
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';
import http from 'http';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://a2a-marketplace-three.vercel.app';
const SETUP_PORT = 3456;

interface ClaudeConfig {
  mcpServers?: {
    [key: string]: {
      command: string;
      args: string[];
      env?: Record<string, string>;
    };
  };
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
}

/**
 * Terminal-first setup for Mentat MCP
 *
 * Flow:
 * 1. Start local server to receive auth token
 * 2. Open browser to authenticate
 * 3. Receive token from callback
 * 4. Save token and configure Claude Code
 * 5. Done!
 */
async function setup() {
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  🧠 Mentat MCP Setup                           ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');

  // Step 1: Start local callback server
  console.log('📡 Starting local server to receive auth token...');
  const token = await startCallbackServer();

  // Step 2: Save token
  console.log('💾 Saving authentication token...');
  await saveToken(token);

  // Step 3: Configure Claude Code
  console.log('⚙️  Configuring Claude Code...');
  await configureClaudeCode(token);

  // Step 4: Success!
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  ✅ Setup Complete!                            ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');
  console.log('Next steps:');
  console.log('1. Restart Claude Code');
  console.log('2. Open any project');
  console.log('3. Try: @mentat deploy this');
  console.log('');
  console.log('Mentat auto-detects your project stack and routes to the right tool.');
  console.log('');
  console.log('Need help? https://github.com/vgardrinier/mentat');
  console.log('');

  // Exit cleanly
  process.exit(0);
}

/**
 * Start local server to receive auth token from web callback
 */
function startCallbackServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // Parse URL
      const url = new URL(req.url || '', `http://localhost:${SETUP_PORT}`);

      if (url.pathname === '/callback') {
        const token = url.searchParams.get('token');

        if (!token) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing token');
          return;
        }

        // Send success response
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Mentat Setup Complete</title>
              <style>
                body {
                  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  background: #000;
                  color: #4ade80;
                }
                .container {
                  border: 2px solid #166534;
                  background: #0a0a0a;
                  padding: 48px;
                  border-radius: 8px;
                  max-width: 600px;
                }
                .header {
                  color: #4ade80;
                  font-size: 14px;
                  white-space: pre;
                  margin-bottom: 24px;
                }
                .message {
                  color: #4ade80;
                  margin: 16px 0;
                  font-size: 16px;
                }
                .note {
                  color: #6b7280;
                  font-size: 14px;
                  margin-top: 24px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">╔════════════════════════════════════════════════╗
║  ✓ MENTAT SETUP COMPLETE                       ║
╚════════════════════════════════════════════════╝</div>
                <div class="message">$ Authentication successful</div>
                <div class="note">// You can close this window and return to your terminal</div>
              </div>
            </body>
          </html>
        `);

        // Close server and resolve with token
        server.close(() => {
          resolve(token);
        });
      }
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${SETUP_PORT} is already in use. Please close other applications and try again.`));
      } else {
        reject(err);
      }
    });

    server.listen(SETUP_PORT, () => {
      console.log('✓ Local server started');
      console.log('');
      console.log('🌐 Opening browser to authenticate...');
      console.log('');

      // Open browser
      const authUrl = `${API_URL}/setup/auth?callback=http://localhost:${SETUP_PORT}/callback`;
      console.log(`   URL: ${authUrl}`);
      console.log('');
      openBrowser(authUrl);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Setup timed out after 5 minutes. Please try again.'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Save auth token to config file
 */
async function saveToken(token: string): Promise<void> {
  const configDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.mentat');
  const configPath = path.join(configDir, 'config.json');

  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(
    configPath,
    JSON.stringify({ authToken: token, apiUrl: API_URL }, null, 2)
  );

  console.log(`✓ Saved to: ${configPath}`);
}

/**
 * Configure Claude Code MCP settings
 */
async function configureClaudeCode(token: string): Promise<void> {
  const configPath = await getClaudeConfigPath();

  if (!configPath) {
    console.log('⚠️  Could not find Claude Code config');
    console.log('   You may need to manually add the MCP server');
    return;
  }

  // Read existing config or create new
  let config: ClaudeConfig;
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(content);
  } catch {
    config = { mcpServers: {} };
  }

  // Add mentat MCP server
  if (!config.mcpServers) config.mcpServers = {};
  const mcpServerPath = path.join(__dirname, 'index.js');
  config.mcpServers.mentat = {
    command: 'node',
    args: [mcpServerPath],
    env: {
      AUTH_TOKEN: token,
      API_URL: API_URL,
    },
  };

  // Auto-approve the solve tool so users don't get prompted every time
  if (!config.permissions) config.permissions = {};
  if (!config.permissions.allow) config.permissions.allow = [];
  const solvePermission = 'mcp__mentat__solve';
  if (!config.permissions.allow.includes(solvePermission)) {
    config.permissions.allow.push(solvePermission);
  }

  // Write config
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  console.log(`✓ Configured Claude Code at: ${configPath}`);
}

/**
 * Get Claude Code config path.
 * Checks newer ~/.claude/settings.json first, falls back to ~/.claude.json
 */
async function getClaudeConfigPath(): Promise<string | null> {
  const home = process.env.HOME || process.env.USERPROFILE || '';

  // Newer path (Claude Code CLI)
  const newPath = path.join(home, '.claude', 'settings.json');
  try {
    await fs.access(newPath);
    return newPath;
  } catch { /* not found */ }

  // Legacy path
  return path.join(home, '.claude.json');
}

/**
 * Open URL in default browser
 */
function openBrowser(url: string) {
  const command = process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
    ? 'start'
    : 'xdg-open';

  exec(`${command} "${url}"`);
}

// Run setup
setup().catch((error) => {
  console.error('');
  console.error('╔════════════════════════════════════════════════╗');
  console.error('║  ❌ SETUP FAILED                               ║');
  console.error('╚════════════════════════════════════════════════╝');
  console.error('');

  // Show the actual error, regardless of its type
  if (error instanceof Error) {
    console.error('Error:', error.message);
    if (process.env.DEBUG) {
      console.error('Stack trace:', error.stack);
    }
  } else {
    console.error('Error:', String(error));
  }

  console.error('');
  console.error('Common fixes:');
  console.error('  • Make sure you\'re signed in at https://a2a-marketplace-three.vercel.app');
  console.error('  • Check that port 3456 is not in use');
  console.error('  • Try running the command again');
  console.error('');
  console.error('Need help? https://github.com/vgardrinier/mentat');
  console.error('');
  process.exit(1);
});
