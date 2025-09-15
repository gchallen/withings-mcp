export interface WithingsConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    accessToken?: string;
    refreshToken?: string;
}
export interface WithingsMeasure {
    value: number;
    type: number;
    unit: number;
    algo?: number;
    fm?: number;
}
export interface WithingsMeasureGroup {
    grpid: number;
    attrib: number;
    date: number;
    created: number;
    modified: number;
    category: number;
    deviceid?: string;
    hash_deviceid?: string;
    measures: WithingsMeasure[];
}
export interface WithingsApiResponse {
    status: number;
    body?: {
        updatetime?: number;
        more?: boolean;
        offset?: number;
        measuregrps?: WithingsMeasureGroup[];
    };
    error?: string;
}
export interface WithingsTokenBody {
    userid: string;
    access_token: string;
    refresh_token: string;
    scope: string;
    expires_in: number;
    token_type: string;
}
export interface TokenResponse {
    status: number;
    body?: WithingsTokenBody;
    error?: string;
}
export declare enum MeasureType {
    WEIGHT = 1,
    HEIGHT = 4,
    FAT_MASS_WEIGHT = 5,
    MUSCLE_MASS = 6,
    HYDRATION = 7,
    BONE_MASS = 8,
    PULSE_WAVE_VELOCITY = 9,
    HEART_RATE = 11,
    TEMPERATURE = 12,
    SPO2 = 54,
    BODY_TEMPERATURE = 71,
    SKIN_TEMPERATURE = 73,
    MUSCLE_MASS_PERCENTAGE = 76,
    HYDRATION_PERCENTAGE = 77,
    BONE_MASS_PERCENTAGE = 88,
    METABOLIC_AGE = 155,
    VISCERAL_FAT_INDEX = 158,
    FAT_MASS_PERCENTAGE = 160
}
//# sourceMappingURL=types.d.ts.map