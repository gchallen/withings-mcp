import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  WithingsConfig,
  WithingsApiResponse,
  TokenResponse,
  MeasureType,
  WithingsMeasureGroup,
  WithingsMeasure,
} from './types.js';

export class WithingsClient {
  private config: WithingsConfig;
  private configPath: string;
  private baseUrl = 'https://wbsapi.withings.net';
  private authUrl = 'https://account.withings.com';
  private tokenUrl = 'https://wbsapi.withings.net/v2/oauth2';

  constructor(config: WithingsConfig) {
    this.config = config;
    this.configPath = path.join(process.env.HOME || '~', '.withings-mcp', 'tokens.json');
  }

  async loadTokens(): Promise<void> {
    // Load from environment variables first, then fallback to file
    if (process.env.WITHINGS_ACCESS_TOKEN && process.env.WITHINGS_REFRESH_TOKEN) {
      this.config.accessToken = process.env.WITHINGS_ACCESS_TOKEN;
      this.config.refreshToken = process.env.WITHINGS_REFRESH_TOKEN;
      return;
    }

    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const tokens = JSON.parse(data);
      this.config.accessToken = tokens.accessToken;
      this.config.refreshToken = tokens.refreshToken;
    } catch (error) {
      console.log('No saved tokens found');
    }
  }

  async saveTokens(): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.configPath,
      JSON.stringify({
        accessToken: this.config.accessToken,
        refreshToken: this.config.refreshToken,
      })
    );
  }

  getAccessToken(): string | undefined {
    return this.config.accessToken;
  }

  getRefreshToken(): string | undefined {
    return this.config.refreshToken;
  }

  getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: 'user.info,user.metrics,user.activity',
      state: Math.random().toString(36).substring(7),
    });
    return `${this.authUrl}/oauth2_user/authorize2?${params}`;
  }

  async exchangeCodeForToken(code: string): Promise<void> {
    const params = new URLSearchParams({
      action: 'requesttoken',
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      redirect_uri: this.config.redirectUri,
    });

    try {
      const response = await axios.post<TokenResponse>(
        this.tokenUrl,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
        }
      );

      if (response.data.status !== 0) {
        throw new Error(`Withings API error: ${response.data.error || 'Unknown error'}`);
      }

      if (!response.data.body?.access_token || !response.data.body?.refresh_token) {
        throw new Error(`Invalid token response: ${JSON.stringify(response.data)}`);
      }

      this.config.accessToken = response.data.body.access_token;
      this.config.refreshToken = response.data.body.refresh_token;

      await this.saveTokens();
    } catch (error: any) {
      if (error.response) {
        console.error('Withings API error:', error.response.status, error.response.data);
        throw new Error(`Withings API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async refreshAccessToken(): Promise<void> {
    if (!this.config.refreshToken) {
      throw new Error('No refresh token available');
    }

    const params = new URLSearchParams({
      action: 'requesttoken',
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: this.config.refreshToken,
    });

    const response = await axios.post<TokenResponse>(
      this.tokenUrl,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
      }
    );

    if (response.data.status !== 0) {
      throw new Error(`Withings API error: ${response.data.error || 'Unknown error'}`);
    }

    if (!response.data.body?.access_token || !response.data.body?.refresh_token) {
      throw new Error(`Invalid refresh token response: ${JSON.stringify(response.data)}`);
    }

    this.config.accessToken = response.data.body.access_token;
    this.config.refreshToken = response.data.body.refresh_token;
    await this.saveTokens();
  }

  async makeApiRequest(endpoint: string, params: Record<string, any>): Promise<any> {
    if (!this.config.accessToken) {
      throw new Error('Not authenticated. Please authorize first.');
    }

    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
        },
        params,
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        await this.refreshAccessToken();
        const response = await axios.get(`${this.baseUrl}${endpoint}`, {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
          },
          params,
        });
        return response.data;
      }
      throw error;
    }
  }

  async getMeasures(
    meastype?: number[],
    startdate?: number,
    enddate?: number
  ): Promise<WithingsMeasureGroup[]> {
    const params: Record<string, any> = {
      action: 'getmeas',
    };

    if (meastype && meastype.length > 0) {
      params.meastype = meastype.join(',');
    }
    if (startdate) {
      params.startdate = startdate;
    }
    if (enddate) {
      params.enddate = enddate;
    }

    const response: WithingsApiResponse = await this.makeApiRequest('/measure', params);

    if (response.status !== 0) {
      throw new Error(`API Error: ${response.error || 'Unknown error'}`);
    }

    return response.body?.measuregrps || [];
  }

  async getLatestWeight(): Promise<number | null> {
    const measures = await this.getMeasures([MeasureType.WEIGHT]);

    if (measures.length === 0) {
      return null;
    }

    const latestGroup = measures[0];
    const weightMeasure = latestGroup.measures.find((m: WithingsMeasure) => m.type === MeasureType.WEIGHT);

    if (!weightMeasure) {
      return null;
    }

    return weightMeasure.value * Math.pow(10, weightMeasure.unit);
  }

  async getBodyComposition(): Promise<Record<string, number | string>> {
    const measTypes = [
      MeasureType.WEIGHT,
      MeasureType.FAT_MASS_WEIGHT,
      MeasureType.FAT_MASS_PERCENTAGE,
      MeasureType.MUSCLE_MASS,
      MeasureType.MUSCLE_MASS_PERCENTAGE,
      MeasureType.BONE_MASS,
      MeasureType.BONE_MASS_PERCENTAGE,
      MeasureType.HYDRATION,
      MeasureType.HYDRATION_PERCENTAGE,
      MeasureType.VISCERAL_FAT_INDEX,
      MeasureType.METABOLIC_AGE,
    ];

    const measures = await this.getMeasures(measTypes);
    const composition: Record<string, number | string> = {};

    if (measures.length > 0) {
      const latestGroup = measures[0];

      for (const measure of latestGroup.measures) {
        const value = measure.value * Math.pow(10, measure.unit);

        switch (measure.type) {
          case MeasureType.WEIGHT:
            composition.weight_kg = value;
            break;
          case MeasureType.FAT_MASS_WEIGHT:
            composition.fat_mass_kg = value;
            break;
          case MeasureType.FAT_MASS_PERCENTAGE:
            composition.fat_percentage = value;
            break;
          case MeasureType.MUSCLE_MASS:
            composition.muscle_mass_kg = value;
            break;
          case MeasureType.MUSCLE_MASS_PERCENTAGE:
            composition.muscle_percentage = value;
            break;
          case MeasureType.BONE_MASS:
            composition.bone_mass_kg = value;
            break;
          case MeasureType.BONE_MASS_PERCENTAGE:
            composition.bone_percentage = value;
            break;
          case MeasureType.HYDRATION:
            composition.hydration_kg = value;
            break;
          case MeasureType.HYDRATION_PERCENTAGE:
            composition.hydration_percentage = value;
            break;
          case MeasureType.VISCERAL_FAT_INDEX:
            composition.visceral_fat_index = value;
            break;
          case MeasureType.METABOLIC_AGE:
            composition.metabolic_age = value;
            break;
        }
      }

      if (latestGroup.date) {
        composition.measurement_date = new Date(latestGroup.date * 1000).toISOString();
      }
    }

    return composition;
  }
}