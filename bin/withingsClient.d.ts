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
    getDefaultUserAttrib(): number | undefined;
    getDefaultUnit(): 'metric' | 'imperial';
    private convertWeight;
    private convertMass;
    getAuthorizationUrl(): string;
    exchangeCodeForToken(code: string): Promise<void>;
    refreshAccessToken(): Promise<void>;
    makeApiRequest(endpoint: string, params: Record<string, any>): Promise<any>;
    getMeasures(meastype?: number[], startdate?: number, enddate?: number, userAttrib?: number): Promise<WithingsMeasureGroup[]>;
    getLatestWeight(userAttrib?: number, unitSystem?: 'metric' | 'imperial'): Promise<{
        value: number;
        unit: string;
    } | null>;
    getBodyComposition(userAttrib?: number, unitSystem?: 'metric' | 'imperial'): Promise<Record<string, number | string>>;
    getAvailableUsers(): Promise<{
        attrib: number;
        count: number;
        latestDate: string;
    }[]>;
    getUserSettings(): Promise<Record<string, string | number | boolean | undefined>>;
}
//# sourceMappingURL=withingsClient.d.ts.map