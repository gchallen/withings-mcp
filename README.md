# Withings MCP Client

MCP (Model Context Protocol) client for retrieving data from Withings smart scale, including weight and body composition measurements.

## Prerequisites

1. Create a Withings Developer account at https://developer.withings.com/
2. Create an application to get your Client ID and Client Secret
3. Set up your redirect URI (default: `http://localhost:3000/callback`)
4. [Bun](https://bun.sh/) runtime (recommended) or Node.js

## Installation

### Install from GitHub

With Bun (recommended):

```bash
bun install git+https://github.com/gchallen/withings-mcp.git
```

Or with npm:

```bash
npm install git+https://github.com/gchallen/withings-mcp.git
```

### Or run directly from GitHub

With Bun (recommended):

```bash
bunx --bun gchallen/withings-mcp
```

Or with npm/npx:

```bash
npx gchallen/withings-mcp
```

## Setup

### 1. Configuration

Create a `.env` file with your Withings credentials:

```bash
WITHINGS_CLIENT_ID=your_client_id
WITHINGS_CLIENT_SECRET=your_client_secret
WITHINGS_REDIRECT_URI=http://localhost:3000/callback
```

### 2. Authorization (One-time setup)

Before using the MCP server, you need to authorize access to your Withings data. Run the authorization tool:

With Bun:
```bash
bun run auth
```

With npm:
```bash
npm run auth
```

Or directly from GitHub:
```bash
bunx --bun gchallen/withings-mcp auth
# or
npx gchallen/withings-mcp auth
```

Or after cloning:
```bash
git clone https://github.com/gchallen/withings-mcp.git
cd withings-mcp
bun run auth
# or
npm run auth
```

This will:
1. Start a temporary local server on port 3000
2. Open your browser to the Withings authorization page
3. Handle the OAuth callback automatically
4. Save your access and refresh tokens to the `.env` file
5. Shut down the temporary server

The authorization is only needed once. The MCP server will automatically refresh tokens as needed.

## CLI Usage

The package provides a unified CLI with the following commands:

```bash
# Run OAuth authorization (one-time setup)
bunx --bun gchallen/withings-mcp auth

# Start the MCP server (default command)
bunx --bun gchallen/withings-mcp
# or explicitly
bunx --bun gchallen/withings-mcp server
```

## Available Tools

The MCP server provides the following tools:

### `withings_get_weight`
Get the latest weight measurement from your Withings scale.

### `withings_get_body_composition`
Get complete body composition data including:
- Weight (kg)
- Fat mass (kg and percentage)
- Muscle mass (kg and percentage)
- Bone mass (kg and percentage)
- Hydration (kg and percentage)
- Visceral fat index
- Metabolic age

### `withings_get_measurements`
Get raw measurement data with optional filters.

Parameters:
- `measureTypes` (optional): Array of measurement type IDs
- `startDate` (optional): Start date in ISO format
- `endDate` (optional): End date in ISO format

## Usage with Claude Desktop

Add the server to your Claude Desktop configuration:

With Bun (recommended):
```json
{
  "mcpServers": {
    "withings": {
      "command": "bunx",
      "args": ["--bun", "gchallen/withings-mcp"],
      "env": {
        "WITHINGS_CLIENT_ID": "your_client_id",
        "WITHINGS_CLIENT_SECRET": "your_client_secret",
        "WITHINGS_REDIRECT_URI": "http://localhost:3000/callback",
        "WITHINGS_ACCESS_TOKEN": "your_access_token",
        "WITHINGS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

Or with npm:
```json
{
  "mcpServers": {
    "withings": {
      "command": "npx",
      "args": ["gchallen/withings-mcp"],
      "env": {
        "WITHINGS_CLIENT_ID": "your_client_id",
        "WITHINGS_CLIENT_SECRET": "your_client_secret",
        "WITHINGS_REDIRECT_URI": "http://localhost:3000/callback",
        "WITHINGS_ACCESS_TOKEN": "your_access_token",
        "WITHINGS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

**Note:** After running the auth command, the access and refresh tokens will be saved to your `.env` file. Copy these values to your Claude Desktop configuration.

## Development

### Clone the Repository

For local development or if you prefer to clone the repository:

```bash
git clone https://github.com/gchallen/withings-mcp.git
cd withings-mcp
bun install  # or npm install
```

### Build (Optional - Bun runs TypeScript directly)
```bash
bun run build  # or npm run build
```

### Run in development mode
```bash
bun run dev    # or npm run dev
```

### Run tests
```bash
bun test       # or npm test
```

### Lint and format
```bash
bun run lint   # or npm run lint
bun run format # or npm run format
```

## License

ISC