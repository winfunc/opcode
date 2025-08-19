#!/usr/bin/env node

import { ClaudiaServer } from './server.js';
import type { ServerConfig } from './types/index.js';

/**
 * Parse command-line arguments into a partial ServerConfig.
 *
 * Recognized options:
 * - `--port`, `-p <number>` — sets `port`
 * - `--host`, `-h <host>` — sets `host`
 * - `--claude-binary <path>` — sets `claude_binary_path`
 * - `--claude-home <path>` — sets `claude_home_dir`
 * - `--help` — prints help and exits (0)
 * - `--version` — prints the version and exits (0)
 *
 * Options that take a value expect the value as the next argument and will
 * ignore values that start with `-`. Unknown options beginning with `-`
 * result in an error message and exit(1).
 *
 * Note: this function may call `process.exit()` as a side effect for help,
 * version, or unrecognized option handling.
 *
 * @returns A Partial<ServerConfig> populated with any recognized CLI options.
 */
function parseArgs(): Partial<ServerConfig> {
  const args = process.argv.slice(2);
  const config: Partial<ServerConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--port':
      case '-p':
        if (nextArg && !nextArg.startsWith('-')) {
          config.port = parseInt(nextArg, 10);
          i++;
        }
        break;
      case '--host':
      case '-h':
        if (nextArg && !nextArg.startsWith('-')) {
          config.host = nextArg;
          i++;
        }
        break;
      case '--claude-binary':
        if (nextArg && !nextArg.startsWith('-')) {
          config.claude_binary_path = nextArg;
          i++;
        }
        break;
      case '--claude-home':
        if (nextArg && !nextArg.startsWith('-')) {
          config.claude_home_dir = nextArg;
          i++;
        }
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
      case '--version':
        console.log('1.0.0');
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return config;
}

/**
 * Print the command-line help/usage information for the Claudia Server CLI.
 *
 * Outputs usage, supported options, examples, relevant environment variables,
 * and available API endpoints to the process standard output.
 */
function printHelp(): void {
  console.log(`
Claudia Server - Standalone TypeScript server for Claude Code integration

Usage: claudia-server [options]

Options:
  -p, --port <port>           Server port (default: 3000)
  -h, --host <host>           Server host (default: 0.0.0.0)
  --claude-binary <path>      Path to Claude binary (auto-detected if not specified)
  --claude-home <path>        Path to Claude home directory (default: ~/.claude)
  --help                      Show this help message
  --version                   Show version number

Examples:
  claudia-server                                    # Start with default settings
  claudia-server --port 8080                       # Start on port 8080
  claudia-server --host localhost --port 3001      # Start on localhost:3001
  claudia-server --claude-binary /usr/bin/claude   # Use specific Claude binary

Environment Variables:
  PORT                        Server port (overridden by --port)
  HOST                        Server host (overridden by --host)
  CLAUDE_BINARY               Claude binary path (overridden by --claude-binary)
  CLAUDE_HOME                 Claude home directory (overridden by --claude-home)

API Endpoints:
  GET  /                      Server info
  GET  /api/status/health     Health check
  GET  /api/status/info       Detailed server info
  GET  /api/claude/version    Claude version info
  POST /api/claude/execute    Execute Claude Code
  POST /api/claude/continue   Continue Claude conversation
  POST /api/claude/resume     Resume Claude session
  GET  /api/projects          List projects
  POST /api/projects          Create project
  WS   /ws                    WebSocket for real-time streaming

For more information, visit: https://github.com/getAsterisk/claudia
`);
}

/**
 * Start the Claudia server using CLI arguments and environment variables.
 *
 * Parses command-line options, merges them with environment variables to construct a partial ServerConfig,
 * instantiates and starts a ClaudiaServer, and logs the effective runtime configuration (port, host,
 * CORS origins, max concurrent sessions, and optionally Claude binary/home paths). On startup failure
 * the function logs the error and exits the process with code 1.
 *
 * @returns A promise that resolves when the server has started.
 */
async function main(): Promise<void> {
  try {
    // Parse command line arguments
    const cliConfig = parseArgs();

    // Merge with environment variables
    const config: Partial<ServerConfig> = {
      port: cliConfig.port || (process.env.PORT ? parseInt(process.env.PORT, 10) : undefined),
      host: cliConfig.host || process.env.HOST,
      claude_binary_path: cliConfig.claude_binary_path || process.env.CLAUDE_BINARY,
      claude_home_dir: cliConfig.claude_home_dir || process.env.CLAUDE_HOME,
    };

    // Create and start server
    const server = new ClaudiaServer(config);
    await server.start();

    // Log configuration
    const serverConfig = server.getConfig();
    console.log('Server Configuration:');
    console.log(`  Port: ${serverConfig.port}`);
    console.log(`  Host: ${serverConfig.host}`);
    console.log(`  CORS Origins: ${serverConfig.cors_origin.join(', ')}`);
    console.log(`  Max Concurrent Sessions: ${serverConfig.max_concurrent_sessions}`);
    if (serverConfig.claude_binary_path) {
      console.log(`  Claude Binary: ${serverConfig.claude_binary_path}`);
    }
    if (serverConfig.claude_home_dir) {
      console.log(`  Claude Home: ${serverConfig.claude_home_dir}`);
    }

  } catch (error) {
    console.error('Failed to start Claudia Server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}