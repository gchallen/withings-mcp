#!/usr/bin/env node

import { WithingsClient } from './withingsClient.js';
import { WithingsConfig } from './types.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as http from 'http';
import * as url from 'url';
import open from 'open';

dotenv.config();

interface AuthServer {
  server: http.Server;
  promise: Promise<string>;
}

function createAuthServer(): AuthServer {
  let resolveCode: (code: string) => void;
  let rejectCode: (error: Error) => void;

  const promise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url || '', true);

    if (parsedUrl.pathname === '/callback') {
      const code = parsedUrl.query.code as string;
      const error = parsedUrl.query.error as string;

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body>
              <h1>Authorization Failed</h1>
              <p>Error: ${error}</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
        rejectCode(new Error(`Authorization failed: ${error}`));
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body>
              <h1>Authorization Successful!</h1>
              <p>You can close this window and return to your terminal.</p>
            </body>
          </html>
        `);
        resolveCode(code);
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body>
              <h1>Authorization Failed</h1>
              <p>No authorization code received.</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
        rejectCode(new Error('No authorization code received'));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  return { server, promise };
}

async function saveTokensToEnv(accessToken: string, refreshToken: string): Promise<void> {
  try {
    const envContent = await fs.readFile('.env', 'utf-8');
    let updatedContent = envContent;

    // Update or add access token
    if (updatedContent.includes('WITHINGS_ACCESS_TOKEN=')) {
      updatedContent = updatedContent.replace(
        /WITHINGS_ACCESS_TOKEN=.*/,
        `WITHINGS_ACCESS_TOKEN=${accessToken}`
      );
    } else {
      updatedContent += `\nWITHINGS_ACCESS_TOKEN=${accessToken}`;
    }

    // Update or add refresh token
    if (updatedContent.includes('WITHINGS_REFRESH_TOKEN=')) {
      updatedContent = updatedContent.replace(
        /WITHINGS_REFRESH_TOKEN=.*/,
        `WITHINGS_REFRESH_TOKEN=${refreshToken}`
      );
    } else {
      updatedContent += `\nWITHINGS_REFRESH_TOKEN=${refreshToken}`;
    }

    await fs.writeFile('.env', updatedContent);
  } catch (error) {
    // If .env doesn't exist, create it
    const envContent = `WITHINGS_CLIENT_ID=${process.env.WITHINGS_CLIENT_ID || ''}
WITHINGS_CLIENT_SECRET=${process.env.WITHINGS_CLIENT_SECRET || ''}
WITHINGS_REDIRECT_URI=${process.env.WITHINGS_REDIRECT_URI || 'http://localhost:3000/callback'}
WITHINGS_ACCESS_TOKEN=${accessToken}
WITHINGS_REFRESH_TOKEN=${refreshToken}
`;
    await fs.writeFile('.env', envContent);
  }
}

async function main() {
  console.log('🔐 Withings OAuth Authorization Tool\n');

  const config: WithingsConfig = {
    clientId: process.env.WITHINGS_CLIENT_ID || '',
    clientSecret: process.env.WITHINGS_CLIENT_SECRET || '',
    redirectUri: process.env.WITHINGS_REDIRECT_URI || 'http://localhost:3000/callback',
  };

  if (!config.clientId || !config.clientSecret) {
    console.error('❌ Error: Missing Withings credentials');
    console.error('Please set WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET environment variables');
    console.error('Or create a .env file with these values\n');
    process.exit(1);
  }

  const client = new WithingsClient(config);
  const { server, promise } = createAuthServer();

  // Start the local server
  const port = 3000;
  server.listen(port, () => {
    console.log(`🚀 Local server started on http://localhost:${port}`);
  });

  try {
    // Generate and open authorization URL
    const authUrl = client.getAuthorizationUrl();
    console.log('🌐 Opening authorization URL in your browser...');
    console.log(`If it doesn't open automatically, visit: ${authUrl}\n`);

    await open(authUrl);

    console.log('⏳ Waiting for authorization...');
    console.log('Please complete the authorization in your browser.\n');

    // Wait for the authorization code
    const code = await promise;

    console.log('✅ Authorization code received!');
    console.log('🔄 Exchanging code for tokens...');

    // Exchange code for tokens
    await client.exchangeCodeForToken(code);

    // Save tokens to .env file
    await saveTokensToEnv(
      client.getAccessToken() || '',
      client.getRefreshToken() || ''
    );

    console.log('💾 Tokens saved to .env file');
    console.log('🎉 Authorization complete!\n');
    console.log('You can now use the Withings MCP server.');

  } catch (error: any) {
    console.error('❌ Authorization failed:', error.message);
    process.exit(1);
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});