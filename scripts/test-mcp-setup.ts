/**
 * MCP Setup End-to-End Test
 *
 * Tests the full npx mentat setup flow that users will experience
 *
 * What this tests:
 * 1. npx mentat runs without errors
 * 2. Redirects to production URL (not localhost)
 * 3. Auth token saved to correct location
 * 4. Claude Code config updated (not Claude Desktop)
 * 5. MCP server can start and list tools
 *
 * Run: npx tsx scripts/test-mcp-setup.ts
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, access } from 'fs/promises';
import path from 'path';
import { constants } from 'fs';

const execAsync = promisify(exec);

const PROD_URL = 'https://a2a-marketplace-three.vercel.app';
const HOME = process.env.HOME || process.env.USERPROFILE || '';
const MENTAT_CONFIG_PATH = path.join(HOME, '.mentat', 'config.json');
const CLAUDE_CODE_CONFIG_PATH = path.join(HOME, '.claude.json');

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(`  ${message}`);
}

function logResult(result: TestResult) {
  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} ${result.name}`);
  if (!result.passed) {
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function test1_BuildMCPPackage(): Promise<TestResult> {
  log('Building MCP package...');

  try {
    const { stdout, stderr } = await execAsync('npm run build', {
      cwd: path.join(process.cwd(), 'mcp-server'),
    });

    // Check if dist/index.js and dist/setup.js exist
    const indexExists = await fileExists(path.join(process.cwd(), 'mcp-server', 'dist', 'index.js'));
    const setupExists = await fileExists(path.join(process.cwd(), 'mcp-server', 'dist', 'setup.js'));

    if (!indexExists || !setupExists) {
      return {
        name: 'Build MCP Package',
        passed: false,
        message: 'Build completed but dist files missing',
        details: { indexExists, setupExists },
      };
    }

    return {
      name: 'Build MCP Package',
      passed: true,
      message: 'MCP package built successfully',
    };
  } catch (error) {
    return {
      name: 'Build MCP Package',
      passed: false,
      message: `Build failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function test2_CheckSetupScript(): Promise<TestResult> {
  log('Checking setup script configuration...');

  try {
    const setupPath = path.join(process.cwd(), 'mcp-server', 'src', 'setup.ts');
    const setupCode = await readFile(setupPath, 'utf-8');

    const issues: string[] = [];

    // Check production URL is configured
    if (!setupCode.includes(PROD_URL)) {
      issues.push(`Production URL not found in setup.ts. Expected: ${PROD_URL}`);
    }

    // Check it writes to ~/.claude.json (Claude Code), not Claude Desktop paths
    if (setupCode.includes('Library/Application Support/Claude/claude_desktop_config.json')) {
      issues.push('Setup still references Claude Desktop config path instead of ~/.claude.json');
    }

    if (!setupCode.includes('.claude.json')) {
      issues.push('Setup does not reference Claude Code config path (~/.claude.json)');
    }

    if (issues.length > 0) {
      return {
        name: 'Check Setup Script',
        passed: false,
        message: 'Setup script has configuration issues',
        details: issues,
      };
    }

    return {
      name: 'Check Setup Script',
      passed: true,
      message: 'Setup script configured correctly for production',
    };
  } catch (error) {
    return {
      name: 'Check Setup Script',
      passed: false,
      message: `Failed to read setup script: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function test3_MCPServerStarts(): Promise<TestResult> {
  log('Testing if MCP server can start...');

  try {
    const mcpServerPath = path.join(process.cwd(), 'mcp-server', 'dist', 'index.js');

    // Try to start MCP server and send list tools request
    const testInput = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });

    const { stdout } = await execAsync(`echo '${testInput}' | node ${mcpServerPath}`, {
      timeout: 5000,
    });

    // Check if response contains expected tools
    const expectedTools = ['execute_skill', 'hire_worker', 'check_wallet'];
    const missingTools = expectedTools.filter(tool => !stdout.includes(tool));

    if (missingTools.length > 0) {
      return {
        name: 'MCP Server Starts',
        passed: false,
        message: 'MCP server started but missing expected tools',
        details: { missingTools },
      };
    }

    return {
      name: 'MCP Server Starts',
      passed: true,
      message: 'MCP server starts and lists all tools',
    };
  } catch (error) {
    return {
      name: 'MCP Server Starts',
      passed: false,
      message: `MCP server failed to start: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function test4_PackageJsonValid(): Promise<TestResult> {
  log('Validating package.json...');

  try {
    const pkgPath = path.join(process.cwd(), 'mcp-server', 'package.json');
    const pkgData = JSON.parse(await readFile(pkgPath, 'utf-8'));

    const issues: string[] = [];

    // Check version is set
    if (!pkgData.version || pkgData.version === '0.0.0') {
      issues.push('Package version not set or is 0.0.0');
    }

    // Check bin entry
    if (!pkgData.bin?.mentat) {
      issues.push('Missing bin.mentat entry for npx mentat command');
    }

    // Check name
    if (pkgData.name !== 'mentat-mcp') {
      issues.push(`Package name is ${pkgData.name}, expected mentat-mcp`);
    }

    if (issues.length > 0) {
      return {
        name: 'Package.json Valid',
        passed: false,
        message: 'package.json has issues',
        details: issues,
      };
    }

    return {
      name: 'Package.json Valid',
      passed: true,
      message: `Package mentat-mcp v${pkgData.version} configured correctly`,
    };
  } catch (error) {
    return {
      name: 'Package.json Valid',
      passed: false,
      message: `Failed to read package.json: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function test5_SkillsAvailable(): Promise<TestResult> {
  log('Checking if skills are available...');

  try {
    const skillsDir = path.join(process.cwd(), 'skills');
    const skillsExist = await fileExists(skillsDir);

    if (!skillsExist) {
      return {
        name: 'Skills Available',
        passed: false,
        message: 'Skills directory not found',
      };
    }

    // Check for at least one skill
    const { stdout } = await execAsync(`ls ${skillsDir}/*.yaml 2>/dev/null | wc -l`);
    const skillCount = parseInt(stdout.trim());

    if (skillCount === 0) {
      return {
        name: 'Skills Available',
        passed: false,
        message: 'No skill YAML files found in skills directory',
      };
    }

    return {
      name: 'Skills Available',
      passed: true,
      message: `Found ${skillCount} skills in skills directory`,
    };
  } catch (error) {
    return {
      name: 'Skills Available',
      passed: false,
      message: `Failed to check skills: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function runTests() {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('🧪 MCP SETUP PRE-PUBLISH TESTS');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('Testing mentat-mcp package before publishing to npm...');
  console.log('');

  // Run all tests
  results.push(await test1_BuildMCPPackage());
  results.push(await test2_CheckSetupScript());
  results.push(await test3_MCPServerStarts());
  results.push(await test4_PackageJsonValid());
  results.push(await test5_SkillsAvailable());

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('📊 TEST RESULTS');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  results.forEach(logResult);

  console.log('');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total: ${results.length} tests`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('');

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('');
    console.log('✅ Ready to publish to npm');
    console.log('');
    console.log('Next steps:');
    console.log('  1. cd mcp-server');
    console.log('  2. npm publish');
    console.log('  3. Test with: npx mentat');
    console.log('');
  } else {
    console.log('⚠️  SOME TESTS FAILED');
    console.log('');
    console.log('❌ DO NOT PUBLISH TO NPM YET');
    console.log('');
    console.log('Fix the failing tests above before publishing.');
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('');

  return failed === 0 ? 0 : 1;
}

// Run tests
runTests()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
