# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Withings MCP (Model Context Protocol) client written in TypeScript, designed to run with Bun runtime. It provides access to Withings smart scale data including weight and body composition measurements.

## Development Commands

All commands use Bun (not npm):

```bash
# Build TypeScript to JavaScript
bun run build

# Run development server
bun dev

# Run OAuth login flow
bun tokens

# Run tests
bun test
bun test --watch
bun test --coverage

# Lint and format
bun lint
bun format
```

## Architecture

### Core Components

1. **WithingsClient** (`src/withingsClient.ts`)
   - Handles OAuth token management (access/refresh tokens)
   - Makes API requests to Withings API endpoints
   - Automatically refreshes expired tokens using refresh token
   - Manages token persistence in `~/.withings-mcp/tokens.json`
   - Supports unit conversion (metric/imperial)

2. **MCP Server** (`src/index.ts`)
   - Implements Model Context Protocol server
   - Exposes Withings data as tools for AI models
   - Tools: `withings_get_weight`, `withings_get_body_composition`, `withings_get_measurements`, `withings_get_users`, `withings_get_user_settings`

3. **OAuth Login** (`src/login.ts`)
   - Standalone OAuth authorization flow
   - Starts temporary local server on port 3000
   - Handles callback and saves tokens to `.env` file

4. **CLI Entry Point** (`src/cli.ts`)
   - Unified CLI interface
   - Routes to either login or server mode

### Token Management Flow

1. Tokens are obtained via OAuth login (`bun tokens`)
2. Saved to `.env` file as `WITHINGS_ACCESS_TOKEN` and `WITHINGS_REFRESH_TOKEN`
3. MCP server loads tokens from environment or `~/.withings-mcp/tokens.json`
4. When access token expires (invalid_token error), `makeApiRequest` should:
   - Detect the error in response body
   - Call `refreshAccessToken()` to get new tokens
   - Retry the original request
   - Save new tokens for future use

### Key Error Handling

The Withings API returns errors in the response body, not as HTTP status codes:
- `status: 401` in response body = invalid/expired access token
- `error: "invalid_token"` = token needs refresh
- Must check response.data.status and response.data.error, not just HTTP status

### Environment Variables

Required:
- `WITHINGS_CLIENT_ID` - OAuth client ID
- `WITHINGS_CLIENT_SECRET` - OAuth client secret
- `WITHINGS_REDIRECT_URI` - OAuth callback URL (default: http://localhost:3000/callback)

After OAuth:
- `WITHINGS_ACCESS_TOKEN` - Access token (expires after ~3 hours)
- `WITHINGS_REFRESH_TOKEN` - Refresh token (long-lived)

Optional:
- `WITHINGS_USER_ATTRIB` - Pin to specific user (0=device owner)
- `WITHINGS_UNIT_SYSTEM` - Default units (metric/imperial)

## Testing Token Refresh

To test token refresh with an expired token:
1. The `.env` file likely contains an expired access token
2. Run any tool request to trigger refresh
3. Check that `refreshAccessToken()` is called
4. Verify new tokens are saved

## Distribution

The project is distributed via GitHub and can be run directly:
- `bunx --bun gchallen/withings-mcp` - Run with Bun
- `npx gchallen/withings-mcp` - Run with npm
- Both compiled JavaScript (bin/) and TypeScript source are included for compatibility