import { WithingsConfig, WithingsMeasureGroup } from './types.js';
export declare class WithingsClient {
    private config;
    private configPath;
    private baseUrl;
    private authUrl;
    private tokenUrl;
    constructor(config: WithingsConfig);
    loadTokens(): Promise<void>;
    saveTokens(): Promise<void>;
    getAccessToken(): string | undefined;
    getRefreshToken(): string | undefined;
    getAuthorizationUrl(): string;
    exchangeCodeForToken(code: string): Promise<void>;
    refreshAccessToken(): Promise<void>;
    makeApiRequest(endpoint: string, params: Record<string, any>): Promise<any>;
    getMeasures(meastype?: number[], startdate?: number, enddate?: number): Promise<WithingsMeasureGroup[]>;
    getLatestWeight(): Promise<number | null>;
    getBodyComposition(): Promise<Record<string, number | string>>;
}
//# sourceMappingURL=withingsClient.d.ts.map