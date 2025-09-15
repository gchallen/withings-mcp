import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MeasureType, } from './types.js';
export class WithingsClient {
    config;
    configPath;
    baseUrl = 'https://wbsapi.withings.net';
    authUrl = 'https://account.withings.com';
    tokenUrl = 'https://wbsapi.withings.net/v2/oauth2';
    constructor(config) {
        this.config = config;
        this.configPath = path.join(process.env.HOME || '~', '.withings-mcp', 'tokens.json');
    }
    async loadTokens() {
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
        }
        catch (error) {
            console.log('No saved tokens found');
        }
    }
    async saveTokens() {
        const dir = path.dirname(this.configPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(this.configPath, JSON.stringify({
            accessToken: this.config.accessToken,
            refreshToken: this.config.refreshToken,
        }));
    }
    getAccessToken() {
        return this.config.accessToken;
    }
    getRefreshToken() {
        return this.config.refreshToken;
    }
    getDefaultUserAttrib() {
        const envUserAttrib = process.env.WITHINGS_USER_ATTRIB;
        return envUserAttrib ? parseInt(envUserAttrib) : undefined;
    }
    getDefaultUnit() {
        const envUnit = process.env.WITHINGS_UNIT_SYSTEM;
        return envUnit === 'imperial' ? 'imperial' : 'metric';
    }
    convertWeight(kg, targetUnit) {
        const unit = targetUnit ?? this.getDefaultUnit();
        if (unit === 'imperial') {
            return { value: kg * 2.20462, unit: 'lb' };
        }
        return { value: kg, unit: 'kg' };
    }
    convertMass(kg, targetUnit) {
        return this.convertWeight(kg, targetUnit); // Same conversion as weight
    }
    getAuthorizationUrl() {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            scope: 'user.info,user.metrics,user.activity',
            state: Math.random().toString(36).substring(7),
        });
        return `${this.authUrl}/oauth2_user/authorize2?${params}`;
    }
    async exchangeCodeForToken(code) {
        const params = new URLSearchParams({
            action: 'requesttoken',
            grant_type: 'authorization_code',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            code,
            redirect_uri: this.config.redirectUri,
        });
        try {
            const response = await axios.post(this.tokenUrl, params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                },
            });
            if (response.data.status !== 0) {
                throw new Error(`Withings API error: ${response.data.error || 'Unknown error'}`);
            }
            if (!response.data.body?.access_token || !response.data.body?.refresh_token) {
                throw new Error(`Invalid token response: ${JSON.stringify(response.data)}`);
            }
            this.config.accessToken = response.data.body.access_token;
            this.config.refreshToken = response.data.body.refresh_token;
            await this.saveTokens();
        }
        catch (error) {
            if (error.response) {
                console.error('Withings API error:', error.response.status, error.response.data);
                throw new Error(`Withings API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }
    async refreshAccessToken() {
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
        const response = await axios.post(this.tokenUrl, params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
        });
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
    async makeApiRequest(endpoint, params) {
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
        }
        catch (error) {
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
    async getMeasures(meastype, startdate, enddate, userAttrib) {
        const params = {
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
        const response = await this.makeApiRequest('/measure', params);
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
    async getLatestWeight(userAttrib, unitSystem) {
        const effectiveUserAttrib = userAttrib ?? this.getDefaultUserAttrib();
        const measures = await this.getMeasures([MeasureType.WEIGHT], undefined, undefined, effectiveUserAttrib);
        if (measures.length === 0) {
            return null;
        }
        const latestGroup = measures[0];
        const weightMeasure = latestGroup.measures.find((m) => m.type === MeasureType.WEIGHT);
        if (!weightMeasure) {
            return null;
        }
        const weightKg = weightMeasure.value * Math.pow(10, weightMeasure.unit);
        return this.convertWeight(weightKg, unitSystem);
    }
    async getBodyComposition(userAttrib, unitSystem) {
        const effectiveUserAttrib = userAttrib ?? this.getDefaultUserAttrib();
        const effectiveUnitSystem = unitSystem ?? this.getDefaultUnit();
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
        const measures = await this.getMeasures(measTypes, undefined, undefined, effectiveUserAttrib);
        const composition = {};
        // Find the latest measurement for each type across all groups
        const latestMeasurements = {};
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
                case MeasureType.FAT_MASS_WEIGHT:
                    const fatMass = this.convertMass(value, effectiveUnitSystem);
                    composition[`fat_mass_${fatMass.unit}`] = parseFloat(fatMass.value.toFixed(2));
                    break;
                case MeasureType.FAT_MASS_PERCENTAGE:
                    composition.fat_percentage = parseFloat(value.toFixed(1));
                    break;
                case MeasureType.MUSCLE_MASS:
                    const muscleMass = this.convertMass(value, effectiveUnitSystem);
                    composition[`muscle_mass_${muscleMass.unit}`] = parseFloat(muscleMass.value.toFixed(2));
                    break;
                case MeasureType.MUSCLE_MASS_PERCENTAGE:
                    composition.muscle_percentage = parseFloat(value.toFixed(1));
                    break;
                case MeasureType.BONE_MASS:
                    const boneMass = this.convertMass(value, effectiveUnitSystem);
                    composition[`bone_mass_${boneMass.unit}`] = parseFloat(boneMass.value.toFixed(2));
                    break;
                case MeasureType.BONE_MASS_PERCENTAGE:
                    composition.bone_percentage = parseFloat(value.toFixed(1));
                    break;
                case MeasureType.HYDRATION:
                    const hydration = this.convertMass(value, effectiveUnitSystem);
                    composition[`hydration_${hydration.unit}`] = parseFloat(hydration.value.toFixed(2));
                    break;
                case MeasureType.HYDRATION_PERCENTAGE:
                    composition.hydration_percentage = parseFloat(value.toFixed(1));
                    break;
                case MeasureType.VISCERAL_FAT_INDEX:
                    composition.visceral_fat_index = parseFloat(value.toFixed(1));
                    break;
                case MeasureType.METABOLIC_AGE:
                    composition.metabolic_age = Math.round(value);
                    break;
            }
        }
        // Add unit system and measurement date
        composition.unit_system = effectiveUnitSystem;
        if (Object.keys(latestMeasurements).length > 0) {
            const mostRecentDate = Math.max(...Object.values(latestMeasurements).map(m => m.date));
            composition.measurement_date = new Date(mostRecentDate * 1000).toISOString();
        }
        return composition;
    }
    async getAvailableUsers() {
        // Get recent measurements to see which users have data
        const measures = await this.getMeasures([MeasureType.WEIGHT]);
        const userStats = {};
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
}
//# sourceMappingURL=withingsClient.js.map