#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args[0];

if (command === 'auth') {
  // Run the auth tool
  import('./auth.js').then((module) => {
    // The auth module runs its main function on import
  }).catch((error) => {
    console.error('Failed to run auth command:', error);
    process.exit(1);
  });
} else if (command === 'server' || !command) {
  // Run the MCP server (default)
  import('./index.js').then((module) => {
    // The index module runs the server on import
  }).catch((error) => {
    console.error('Failed to run MCP server:', error);
    process.exit(1);
  });
} else {
  console.error(`Unknown command: ${command}`);
  console.error('Usage:');
  console.error('  withings-mcp        # Start MCP server (default)');
  console.error('  withings-mcp server # Start MCP server');
  console.error('  withings-mcp auth   # Run OAuth authorization');
  process.exit(1);
}