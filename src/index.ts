#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { WithingsClient } from './withingsClient.js';
import { WithingsConfig } from './types.js';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config();

const server = new Server(
  {
    name: 'withings-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let withingsClient: WithingsClient | null = null;

async function initializeClient(): Promise<WithingsClient> {
  const config: WithingsConfig = {
    clientId: process.env.WITHINGS_CLIENT_ID || '',
    clientSecret: process.env.WITHINGS_CLIENT_SECRET || '',
    redirectUri: process.env.WITHINGS_REDIRECT_URI || 'http://localhost:3000/callback',
  };

  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      'Missing Withings credentials. Please set WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET environment variables.'
    );
  }

  const client = new WithingsClient(config);
  await client.loadTokens();
  return client;
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools: Tool[] = [
    {
      name: 'withings_authorize',
      description: 'Get authorization URL for Withings OAuth2 flow',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'withings_complete_auth',
      description: 'Complete Withings authorization with OAuth2 code',
      inputSchema: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Authorization code from OAuth2 callback',
          },
        },
        required: ['code'],
      },
    },
    {
      name: 'withings_get_weight',
      description: 'Get the latest weight measurement from Withings scale',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'withings_get_body_composition',
      description:
        'Get complete body composition data including weight, fat mass, muscle mass, bone mass, hydration, and more',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'withings_get_measurements',
      description: 'Get raw measurement data with optional filters',
      inputSchema: {
        type: 'object',
        properties: {
          measureTypes: {
            type: 'array',
            items: { type: 'number' },
            description:
              'Measurement types to retrieve (1=Weight, 5=Fat Mass, 6=Muscle Mass, 8=Bone Mass, etc.)',
          },
          startDate: {
            type: 'string',
            description: 'Start date in ISO format',
          },
          endDate: {
            type: 'string',
            description: 'End date in ISO format',
          },
        },
      },
    },
  ];

  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!withingsClient) {
    try {
      withingsClient = await initializeClient();
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error initializing Withings client: ${error.message}`,
          },
        ],
      };
    }
  }

  try {
    switch (name) {
      case 'withings_authorize': {
        const authUrl = withingsClient.getAuthorizationUrl();
        return {
          content: [
            {
              type: 'text',
              text: `Please visit this URL to authorize access to your Withings data:\n${authUrl}\n\nAfter authorization, you'll receive a code. Use the withings_complete_auth tool with that code.`,
            },
          ],
        };
      }

      case 'withings_complete_auth': {
        const { code } = args as { code: string };
        await withingsClient.exchangeCodeForToken(code);
        return {
          content: [
            {
              type: 'text',
              text: 'Authorization successful! Your tokens have been saved.',
            },
          ],
        };
      }

      case 'withings_get_weight': {
        const weight = await withingsClient.getLatestWeight();
        if (weight === null) {
          return {
            content: [
              {
                type: 'text',
                text: 'No weight measurements found.',
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: `Latest weight: ${weight.toFixed(2)} kg`,
            },
          ],
        };
      }

      case 'withings_get_body_composition': {
        const composition = await withingsClient.getBodyComposition();
        const formatted = JSON.stringify(composition, null, 2);
        return {
          content: [
            {
              type: 'text',
              text: `Body Composition:\n${formatted}`,
            },
          ],
        };
      }

      case 'withings_get_measurements': {
        const { measureTypes, startDate, endDate } = args as {
          measureTypes?: number[];
          startDate?: string;
          endDate?: string;
        };

        const startTimestamp = startDate ? Math.floor(new Date(startDate).getTime() / 1000) : undefined;
        const endTimestamp = endDate ? Math.floor(new Date(endDate).getTime() / 1000) : undefined;

        const measurements = await withingsClient.getMeasures(
          measureTypes,
          startTimestamp,
          endTimestamp
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(measurements, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
        };
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Withings MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});