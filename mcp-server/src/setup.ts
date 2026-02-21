#!/usr/bin/env node
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';
import http from 'http';

const execAsync = promisify(exec);

const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const SETUP_PORT = 3456;

interface ClaudeConfig {
  mcpServers: {
    [key: string]: {
      command: string;
      args: string[];
      env?: Record<string, string>;
    };
  };
}

/**
 * Terminal-first setup for Agent Marketplace MCP
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
  console.log('║  🚀 Agent Marketplace Setup                    ║');
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
  console.log('3. Try: @agentmarketplace execute_skill --skillId seo-meta-tags');
  console.log('');
  console.log('Available skills:');
  console.log('  • seo-meta-tags - Add SEO meta tags');
  console.log('  • typescript-convert - Convert JS to TypeScript');
  console.log('  • add-loading-states - Add loading states');
  console.log('  • add-error-boundaries - Add error boundaries');
  console.log('  • fix-eslint - Fix ESLint errors');
  console.log('  • optimize-images - Optimize images');
  console.log('');
  console.log('Need help? Visit: https://agentmarketplace.com/docs');
  console.log('');
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
              <title>Setup Complete</title>
              <style>
                body {
                  font-family: system-ui, -apple-system, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  background: #f5f5f5;
                }
                .container {
                  text-align: center;
                  background: white;
                  padding: 48px;
                  border-radius: 12px;
                  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }
                h1 { color: #10b981; margin: 0 0 16px 0; }
                p { color: #6b7280; margin: 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>✅ Authentication Complete!</h1>
                <p>You can close this window and return to your terminal.</p>
              </div>
            </body>
          </html>
        `);

        // Close server and resolve with token
        server.close();
        resolve(token);
      }
    });

    server.listen(SETUP_PORT, () => {
      console.log('✓ Local server started');
      console.log('');
      console.log('🌐 Opening browser to authenticate...');

      // Open browser
      const authUrl = `${API_URL}/setup/auth?callback=http://localhost:${SETUP_PORT}/callback`;
      openBrowser(authUrl);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Setup timed out after 5 minutes'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Save auth token to config file
 */
async function saveToken(token: string): Promise<void> {
  const configDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.agentmarketplace');
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
  const configPath = getClaudeConfigPath();

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

  // Add agentmarketplace MCP server
  const mcpServerPath = path.join(__dirname, 'index.js');
  config.mcpServers.agentmarketplace = {
    command: 'node',
    args: [mcpServerPath],
    env: {
      AUTH_TOKEN: token,
      API_URL: API_URL,
    },
  };

  // Write config
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  console.log(`✓ Configured Claude Code at: ${configPath}`);
}

/**
 * Get Claude Code config path based on OS
 */
function getClaudeConfigPath(): string | null {
  const home = process.env.HOME || process.env.USERPROFILE || '';

  if (process.platform === 'darwin') {
    // macOS
    return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (process.platform === 'win32') {
    // Windows
    return path.join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
  } else if (process.platform === 'linux') {
    // Linux
    return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
  }

  return null;
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
  console.error('❌ Setup failed:', error.message);
  console.error('');
  console.error('Need help? Visit: https://agentmarketplace.com/docs');
  process.exit(1);
});
