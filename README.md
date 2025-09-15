# Withings MCP Client

MCP (Model Context Protocol) client for retrieving data from Withings smart scale, including weight and body composition measurements.

## Prerequisites

1. Create a Withings Developer account at https://developer.withings.com/
2. Create an application to get your Client ID and Client Secret
3. Set up your redirect URI (default: `http://localhost:3000/callback`)

## Installation

```bash
npm install withings-mcp
```

Or use directly with npx:

```bash
npx withings-mcp
```

## Configuration

Create a `.env` file with your Withings credentials:

```bash
WITHINGS_CLIENT_ID=your_client_id
WITHINGS_CLIENT_SECRET=your_client_secret
WITHINGS_REDIRECT_URI=http://localhost:3000/callback
```

## Available Tools

The MCP server provides the following tools:

### `withings_authorize`
Get the authorization URL to start the OAuth2 flow. Visit this URL to authorize access to your Withings data.

### `withings_complete_auth`
Complete the authorization process with the code received from the OAuth2 callback.

Parameters:
- `code`: Authorization code from OAuth2 callback

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

```json
{
  "mcpServers": {
    "withings": {
      "command": "npx",
      "args": ["withings-mcp"],
      "env": {
        "WITHINGS_CLIENT_ID": "your_client_id",
        "WITHINGS_CLIENT_SECRET": "your_client_secret",
        "WITHINGS_REDIRECT_URI": "http://localhost:3000/callback"
      }
    }
  }
}
```

## Development

### Build
```bash
npm run build
```

### Run in development mode
```bash
npm run dev
```

### Run tests
```bash
npm test
```

### Lint and format
```bash
npm run lint
npm run format
```

## License

ISC