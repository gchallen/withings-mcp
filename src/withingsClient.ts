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

  // In-memory access token cache
  private cachedAccessToken?: string;
  private accessTokenExpiry?: Date;

  constructor(config: WithingsConfig) {
    this.config = config;
    this.configPath = path.join(process.env.HOME || '~', '.withings-mcp', 'tokens.json');
  }

  async loadTokens(): Promise<void> {
    // Try to load refresh token from file first (gets updated during token refresh)
    // Fall back to environment variables if file doesn't exist
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const tokens = JSON.parse(data);
      if (tokens.refreshToken) {
        this.config.refreshToken = tokens.refreshToken;
        return;
      }
    } catch (error) {
      // File doesn't exist or is invalid, continue to environment variables
    }

    // Fallback to environment variables (for initial setup)
    if (process.env.WITHINGS_REFRESH_TOKEN) {
      this.config.refreshToken = process.env.WITHINGS_REFRESH_TOKEN;
      return;
    }

    console.log('No saved refresh token found');
  }

  async saveTokens(): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.configPath,
      JSON.stringify({
        refreshToken: this.config.refreshToken,
      })
    );
  }

  async getValidAccessToken(): Promise<string> {
    // Check if we have a cached access token that hasn't expired
    if (this.cachedAccessToken && this.accessTokenExpiry && this.accessTokenExpiry > new Date()) {
      return this.cachedAccessToken;
    }

    // No valid cached token, refresh it
    await this.refreshAccessToken();

    if (!this.cachedAccessToken) {
      throw new Error('Failed to obtain valid access token');
    }

    return this.cachedAccessToken;
  }

  getAccessToken(): string | undefined {
    return this.cachedAccessToken;
  }

  getRefreshToken(): string | undefined {
    return this.config.refreshToken;
  }

  getDefaultUserAttrib(): number | undefined {
    const envUserAttrib = process.env.WITHINGS_USER_ATTRIB;
    return envUserAttrib ? parseInt(envUserAttrib) : undefined;
  }

  getDefaultUnit(): 'metric' | 'imperial' {
    const envUnit = process.env.WITHINGS_UNIT_SYSTEM;
    return envUnit === 'imperial' ? 'imperial' : 'metric';
  }

  private convertWeight(kg: number, targetUnit?: 'metric' | 'imperial'): { value: number; unit: string } {
    const unit = targetUnit ?? this.getDefaultUnit();
    if (unit === 'imperial') {
      return { value: kg * 2.20462, unit: 'lb' };
    }
    return { value: kg, unit: 'kg' };
  }

  private convertMass(kg: number, targetUnit?: 'metric' | 'imperial'): { value: number; unit: string } {
    return this.convertWeight(kg, targetUnit); // Same conversion as weight
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

      // Cache access token in memory with expiration (expires in 3 hours, cache for 2.5 hours to be safe)
      this.cachedAccessToken = response.data.body.access_token;
      this.accessTokenExpiry = new Date(Date.now() + 2.5 * 60 * 60 * 1000); // 2.5 hours from now

      // Store only the refresh token persistently
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

    // Cache access token in memory with expiration (expires in 3 hours, cache for 2.5 hours to be safe)
    this.cachedAccessToken = response.data.body.access_token;
    this.accessTokenExpiry = new Date(Date.now() + 2.5 * 60 * 60 * 1000); // 2.5 hours from now

    // Update refresh token and save only that to persistent storage
    this.config.refreshToken = response.data.body.refresh_token;
    await this.saveTokens();
  }

  async makeApiRequest(endpoint: string, params: Record<string, any>): Promise<any> {
    // Ensure we have a valid access token (will refresh if needed)
    const accessToken = await this.getValidAccessToken();

    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params,
      });

      // Check if Withings API returned an authentication error
      // Status 401 in the response body means invalid/expired access token
      // Also check for "invalid_token" in the error message
      if (response.data.status === 401 ||
          (response.data.error && response.data.error.includes('invalid_token'))) {

        try {
          // Try to refresh the token
          await this.refreshAccessToken();

          // Retry the request with the new access token
          const retryResponse = await axios.get(`${this.baseUrl}${endpoint}`, {
            headers: {
              Authorization: `Bearer ${this.cachedAccessToken}`,
            },
            params,
          });
          return retryResponse.data;
        } catch (refreshError: any) {
          // If refresh fails, it might mean the refresh token is also invalid

          // Check if it's a refresh token error
          if (refreshError.message.includes('invalid refresh_token') ||
              refreshError.message.includes('Invalid Params')) {
            throw new Error(
              'Both access and refresh tokens are invalid. Please run "bun tokens" to re-authenticate.'
            );
          }
          throw refreshError;
        }
      }

      return response.data;
    } catch (error: any) {
      // Also handle HTTP 401 status (though Withings typically uses status in body)
      if (error.response?.status === 401) {
        try {
          await this.refreshAccessToken();
          const response = await axios.get(`${this.baseUrl}${endpoint}`, {
            headers: {
              Authorization: `Bearer ${this.cachedAccessToken}`,
            },
            params,
          });
          return response.data;
        } catch (refreshError: any) {
          if (refreshError.message.includes('invalid refresh_token') ||
              refreshError.message.includes('Invalid Params')) {
            throw new Error(
              'Both access and refresh tokens are invalid. Please run "bun tokens" to re-authenticate.'
            );
          }
          throw refreshError;
        }
      }
      throw error;
    }
  }

  async getMeasures(
    meastype?: number[],
    startdate?: number,
    enddate?: number,
    userAttrib?: number,
    limit?: number,
    offset?: number
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
    if (limit !== undefined) {
      params.limit = limit;
    }
    if (offset !== undefined) {
      params.offset = offset;
    }

    const response: WithingsApiResponse = await this.makeApiRequest('/measure', params);

    if (response.status !== 0) {
      throw new Error(`API Error: ${response.error || 'Unknown error'}`);
    }

    let measureGroups = response.body?.measuregrps || [];

    // Filter by user attribution if specified
    if (userAttrib !== undefined) {
      measureGroups = measureGroups.filter(group => group.attrib === userAttrib);
    }

    return measureGroups;
  }

  async getMeasuresWithPagination(
    meastype?: number[],
    startdate?: number,
    enddate?: number,
    userAttrib?: number,
    limit?: number,
    offset?: number
  ): Promise<{
    measures: WithingsMeasureGroup[];
    pagination: {
      limit?: number;
      offset?: number;
      more?: boolean;
      total_returned: number;
    };
  }> {
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
    if (limit !== undefined) {
      params.limit = limit;
    }
    if (offset !== undefined) {
      params.offset = offset;
    }

    const response: WithingsApiResponse = await this.makeApiRequest('/measure', params);

    if (response.status !== 0) {
      throw new Error(`API Error: ${response.error || 'Unknown error'}`);
    }

    let measureGroups = response.body?.measuregrps || [];

    // Filter by user attribution if specified
    if (userAttrib !== undefined) {
      measureGroups = measureGroups.filter(group => group.attrib === userAttrib);
    }

    return {
      measures: measureGroups,
      pagination: {
        limit,
        offset,
        more: response.body?.more || false,
        total_returned: measureGroups.length,
      },
    };
  }

  async getLatestWeight(userAttrib?: number, unitSystem?: 'metric' | 'imperial'): Promise<{ value: number; unit: string; date: string; timestamp: number } | null> {
    const effectiveUserAttrib = userAttrib ?? this.getDefaultUserAttrib();
    const measures = await this.getMeasures([MeasureType.WEIGHT], undefined, undefined, effectiveUserAttrib);

    if (measures.length === 0) {
      return null;
    }

    const latestGroup = measures[0];
    const weightMeasure = latestGroup.measures.find((m: WithingsMeasure) => m.type === MeasureType.WEIGHT);

    if (!weightMeasure) {
      return null;
    }

    const weightKg = weightMeasure.value * Math.pow(10, weightMeasure.unit);
    const weightData = this.convertWeight(weightKg, unitSystem);

    return {
      value: weightData.value,
      unit: weightData.unit,
      date: new Date(latestGroup.date * 1000).toISOString(),
      timestamp: latestGroup.date
    };
  }

  async getBodyComposition(userAttrib?: number, unitSystem?: 'metric' | 'imperial'): Promise<Record<string, number | string>> {
    const effectiveUserAttrib = userAttrib ?? this.getDefaultUserAttrib();
    const effectiveUnitSystem = unitSystem ?? this.getDefaultUnit();
    const measTypes = [
      MeasureType.WEIGHT,
      MeasureType.FAT_FREE_MASS, // Type 5 - Fat Free Mass (kg)
      MeasureType.FAT_RATIO_PERCENTAGE, // Type 6 - Fat Ratio (%)
      MeasureType.FAT_MASS_WEIGHT, // Type 8 - Fat Mass Weight (kg)
      MeasureType.MUSCLE_MASS_WEIGHT, // Type 76 - Muscle Mass (kg)
      MeasureType.HYDRATION_PERCENTAGE, // Type 77
      MeasureType.BONE_MASS, // Type 88 - Bone Mass (kg)
      MeasureType.UNKNOWN_170, // Type 170 - possibly visceral fat
    ];

    const measures = await this.getMeasures(measTypes, undefined, undefined, effectiveUserAttrib);
    const composition: Record<string, number | string> = {};

    // Find the latest measurement for each type across all groups
    const latestMeasurements: Record<number, { value: number; date: number }> = {};

    for (const group of measures) {
      for (const measure of group.measures) {
        const currentLatest = latestMeasurements[measure.type];
        if (!currentLatest || group.date > currentLatest.date) {
          latestMeasurements[measure.type] = {
            value: measure.value * Math.pow(10, measure.unit),
            date: group.date,
          };
        }
      }
    }

    // Convert to readable format with unit conversion
    const massUnit = effectiveUnitSystem === 'imperial' ? 'lb' : 'kg';

    for (const [typeStr, data] of Object.entries(latestMeasurements)) {
      const type = parseInt(typeStr);
      const value = data.value;

      switch (type) {
        case MeasureType.WEIGHT:
          const weight = this.convertWeight(value, effectiveUnitSystem);
          composition[`weight_${weight.unit}`] = parseFloat(weight.value.toFixed(2));
          break;

        case MeasureType.FAT_FREE_MASS: // Type 5 - Fat Free Mass (kg)
          const fatFreeMass = this.convertMass(value, effectiveUnitSystem);
          composition[`fat_free_mass_${fatFreeMass.unit}`] = parseFloat(fatFreeMass.value.toFixed(2));
          break;

        case MeasureType.FAT_RATIO_PERCENTAGE: // Type 6 - Fat Ratio (%) - official documentation
          composition.fat_percentage = parseFloat(value.toFixed(1));
          break;

        case MeasureType.FAT_MASS_WEIGHT: // Type 8 - Fat Mass Weight (kg)
          const fatMass = this.convertMass(value, effectiveUnitSystem);
          composition[`fat_mass_${fatMass.unit}`] = parseFloat(fatMass.value.toFixed(2));
          break;

        case MeasureType.MUSCLE_MASS_WEIGHT: // Type 76 - Muscle Mass (kg)
          const muscleMass = this.convertMass(value, effectiveUnitSystem);
          composition[`muscle_mass_${muscleMass.unit}`] = parseFloat(muscleMass.value.toFixed(2));
          // Calculate muscle percentage from mass
          const weightKgForMuscle = latestMeasurements[MeasureType.WEIGHT]?.value;
          if (weightKgForMuscle) {
            composition.muscle_percentage = parseFloat((value / weightKgForMuscle * 100).toFixed(1));
          }
          break;

        case MeasureType.HYDRATION_PERCENTAGE: // Type 77
          composition.hydration_percentage = parseFloat(value.toFixed(1));
          break;

        case MeasureType.BONE_MASS: // Type 88 - Bone Mass (kg) - official documentation
          const boneMass = this.convertMass(value, effectiveUnitSystem);
          composition[`bone_mass_${boneMass.unit}`] = parseFloat(boneMass.value.toFixed(2));
          // Calculate bone percentage from mass
          const weightKgForBone = latestMeasurements[MeasureType.WEIGHT]?.value;
          if (weightKgForBone) {
            composition.bone_percentage = parseFloat((value / weightKgForBone * 100).toFixed(1));
          }
          break;

        case MeasureType.UNKNOWN_170: // Type 170 - possibly visceral fat index
          composition.visceral_fat_index = parseFloat(value.toFixed(1));
          break;
      }
    }

    // Add unit system and measurement date
    composition.unit_system = effectiveUnitSystem;
    if (Object.keys(latestMeasurements).length > 0) {
      const mostRecentDate = Math.max(...Object.values(latestMeasurements).map(m => m.date));
      composition.measurement_date = new Date(mostRecentDate * 1000).toISOString();
      composition.measurement_timestamp = mostRecentDate;
    }

    return composition;
  }

  async getAvailableUsers(): Promise<{ attrib: number; count: number; latestDate: string }[]> {
    // Get recent measurements to see which users have data
    const measures = await this.getMeasures([MeasureType.WEIGHT]);

    const userStats: Record<number, { count: number; latestDate: number }> = {};

    for (const group of measures) {
      if (!userStats[group.attrib]) {
        userStats[group.attrib] = { count: 0, latestDate: 0 };
      }
      userStats[group.attrib].count++;
      if (group.date > userStats[group.attrib].latestDate) {
        userStats[group.attrib].latestDate = group.date;
      }
    }

    return Object.entries(userStats).map(([attrib, stats]) => ({
      attrib: parseInt(attrib),
      count: stats.count,
      latestDate: new Date(stats.latestDate * 1000).toISOString(),
    })).sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  }

  async getUserSettings(): Promise<Record<string, string | number | boolean | undefined>> {
    // Get timezone from API response and combine with environment settings
    const response = await this.makeApiRequest('/measure', {
      action: 'getmeas',
      meastype: '1', // Weight only for lightweight call
      limit: 1
    });

    const settings: Record<string, string | number | boolean | undefined> = {};

    // Timezone from API response
    if (response.body?.timezone) {
      settings.timezone = response.body.timezone;
    }

    // Unit system from environment or default
    settings.unit_system = this.getDefaultUnit();

    // Default user attribution from environment
    const userAttrib = this.getDefaultUserAttrib();
    if (userAttrib !== undefined) {
      settings.default_user_attrib = userAttrib;
    }

    // Client configuration (without secrets)
    settings.client_id = this.config.clientId;
    settings.redirect_uri = this.config.redirectUri;

    // Token status
    settings.has_access_token = !!this.config.accessToken;
    settings.has_refresh_token = !!this.config.refreshToken;

    return settings;
  }
}