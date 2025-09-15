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
    FAT_FREE_MASS = 5,// Fat Free Mass (kg) - per official documentation
    FAT_RATIO_PERCENTAGE = 6,// Fat Ratio (%) - per official documentation
    HYDRATION = 7,
    FAT_MASS_WEIGHT = 8,// Fat Mass Weight (kg) - per official documentation
    PULSE_WAVE_VELOCITY = 9,
    HEART_RATE = 11,
    TEMPERATURE = 12,
    SPO2 = 54,
    BODY_TEMPERATURE = 71,
    SKIN_TEMPERATURE = 73,
    MUSCLE_MASS_WEIGHT = 76,// Muscle Mass (kg) - per official documentation
    HYDRATION_PERCENTAGE = 77,
    BONE_MASS = 88,// Bone Mass (kg) - per official documentation
    METABOLIC_AGE = 155,
    VISCERAL_FAT_INDEX = 158,
    FAT_MASS_PERCENTAGE = 160,
    UNKNOWN_170 = 170,// Possibly visceral fat index - shows 2.6
    UNKNOWN_226 = 226,// Unknown large value - shows 1922
    UNKNOWN_227 = 227
}
//# sourceMappingURL=types.d.ts.map