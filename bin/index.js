#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { WithingsClient } from './withingsClient.js';
import * as dotenv from 'dotenv';
dotenv.config();
const server = new Server({
    name: 'withings-mcp',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
let withingsClient = null;
async function initializeClient() {
    const config = {
        clientId: process.env.WITHINGS_CLIENT_ID || '',
        clientSecret: process.env.WITHINGS_CLIENT_SECRET || '',
        redirectUri: process.env.WITHINGS_REDIRECT_URI || 'http://localhost:3000/callback',
    };
    if (!config.clientId || !config.clientSecret) {
        throw new Error('Missing Withings credentials. Please set WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET environment variables.');
    }
    const client = new WithingsClient(config);
    await client.loadTokens();
    return client;
}
server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = [
        {
            name: 'withings_get_weight',
            description: 'Get the latest weight measurement from Withings scale',
            inputSchema: {
                type: 'object',
                properties: {
                    userAttrib: {
                        type: 'number',
                        description: 'User attribution (0=device owner, 1+=other users). If not specified, returns data from all users.',
                    },
                    unitSystem: {
                        type: 'string',
                        enum: ['metric', 'imperial'],
                        description: 'Unit system for measurements (metric=kg, imperial=lb). If not specified, uses WITHINGS_UNIT_SYSTEM environment variable or defaults to metric.',
                    },
                },
            },
        },
        {
            name: 'withings_get_body_composition',
            description: 'Get complete body composition data including weight, fat mass, muscle mass, bone mass, hydration, and more',
            inputSchema: {
                type: 'object',
                properties: {
                    userAttrib: {
                        type: 'number',
                        description: 'User attribution (0=device owner, 1+=other users). If not specified, returns data from all users.',
                    },
                    unitSystem: {
                        type: 'string',
                        enum: ['metric', 'imperial'],
                        description: 'Unit system for measurements (metric=kg, imperial=lb). If not specified, uses WITHINGS_UNIT_SYSTEM environment variable or defaults to metric.',
                    },
                },
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
                        description: 'Measurement types to retrieve (1=Weight, 5=Fat Mass, 6=Muscle Mass, 8=Bone Mass, etc.)',
                    },
                    startDate: {
                        type: 'string',
                        description: 'Start date in ISO format',
                    },
                    endDate: {
                        type: 'string',
                        description: 'End date in ISO format',
                    },
                    userAttrib: {
                        type: 'number',
                        description: 'User attribution (0=device owner, 1+=other users). If not specified, returns data from all users.',
                    },
                },
            },
        },
        {
            name: 'withings_get_users',
            description: 'Get list of users who have measurements on the Withings scale',
            inputSchema: {
                type: 'object',
                properties: {},
            },
        },
        {
            name: 'withings_get_user_settings',
            description: 'Get user settings including timezone, unit preferences, and client configuration',
            inputSchema: {
                type: 'object',
                properties: {},
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
        }
        catch (error) {
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
            case 'withings_get_weight': {
                const { userAttrib, unitSystem } = args;
                const effectiveUserAttrib = userAttrib ?? withingsClient.getDefaultUserAttrib();
                const weight = await withingsClient.getLatestWeight(userAttrib, unitSystem);
                if (weight === null) {
                    const userText = effectiveUserAttrib !== undefined ? ` for user ${effectiveUserAttrib}` : '';
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `No weight measurements found${userText}.`,
                            },
                        ],
                    };
                }
                const userText = effectiveUserAttrib !== undefined ? ` (user ${effectiveUserAttrib})` : '';
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Latest weight: ${weight.value.toFixed(2)} ${weight.unit}${userText}`,
                        },
                    ],
                };
            }
            case 'withings_get_body_composition': {
                const { userAttrib, unitSystem } = args;
                const effectiveUserAttrib = userAttrib ?? withingsClient.getDefaultUserAttrib();
                const composition = await withingsClient.getBodyComposition(userAttrib, unitSystem);
                const formatted = JSON.stringify(composition, null, 2);
                const userText = effectiveUserAttrib !== undefined ? ` (user ${effectiveUserAttrib})` : '';
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Body Composition${userText}:\n${formatted}`,
                        },
                    ],
                };
            }
            case 'withings_get_measurements': {
                const { measureTypes, startDate, endDate, userAttrib } = args;
                const startTimestamp = startDate ? Math.floor(new Date(startDate).getTime() / 1000) : undefined;
                const endTimestamp = endDate ? Math.floor(new Date(endDate).getTime() / 1000) : undefined;
                const effectiveUserAttrib = userAttrib ?? withingsClient.getDefaultUserAttrib();
                const measurements = await withingsClient.getMeasures(measureTypes, startTimestamp, endTimestamp, effectiveUserAttrib);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(measurements, null, 2),
                        },
                    ],
                };
            }
            case 'withings_get_users': {
                const users = await withingsClient.getAvailableUsers();
                const formatted = users.map(user => {
                    const userType = user.attrib === 0 ? 'Device Owner' :
                        user.attrib === 2 ? 'Manual Entry' :
                            user.attrib === 4 ? 'Auto Detection' :
                                `User ${user.attrib}`;
                    return `• User ${user.attrib} (${userType}): ${user.count} measurements, latest: ${user.latestDate}`;
                }).join('\n');
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Available Users:\n${formatted}`,
                        },
                    ],
                };
            }
            case 'withings_get_user_settings': {
                const settings = await withingsClient.getUserSettings();
                const formatted = [
                    `Timezone: ${settings.timezone}`,
                    `Unit System: ${settings.unit_system}`,
                    `Default User: ${settings.default_user_attrib !== undefined ? settings.default_user_attrib : 'All users'}`,
                    `Client ID: ${settings.client_id}`,
                    `Redirect URI: ${settings.redirect_uri}`,
                    `Access Token: ${settings.has_access_token ? 'Present' : 'Missing'}`,
                    `Refresh Token: ${settings.has_refresh_token ? 'Present' : 'Missing'}`,
                ].join('\n');
                return {
                    content: [
                        {
                            type: 'text',
                            text: `User Settings:\n${formatted}`,
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
    }
    catch (error) {
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
//# sourceMappingURL=index.js.map