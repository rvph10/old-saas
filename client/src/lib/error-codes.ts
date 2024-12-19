export const ErrorCodes = {
  AUTH: {
    INVALID_CREDENTIALS: 'AUTH_001',
    ACCOUNT_LOCKED: 'AUTH_002',
    SESSION_EXPIRED: 'AUTH_003',
    INVALID_TOKEN: 'AUTH_004',
    EMAIL_NOT_VERIFIED: 'AUTH_005',
    ACCOUNT_DEACTIVATED: 'AUTH_006',
    TWO_FACTOR_REQUIRED: 'AUTH_007',
    INVALID_2FA_TOKEN: 'AUTH_008',
    SESSION_LIMIT_EXCEEDED: 'AUTH_009',
    INVALID_RESET_TOKEN: 'AUTH_010',
  },
  VALIDATION: {
    INVALID_PASSWORD: 'VAL_001',
    INVALID_EMAIL: 'VAL_002',
    INVALID_USERNAME: 'VAL_003',
    PASSWORD_HISTORY: 'VAL_004',
    INVALID_INPUT: 'VAL_005',
  },
  ACCOUNT: {
    ALREADY_EXISTS: 'ACC_001',
    NOT_FOUND: 'ACC_002',
    BLOCKED: 'ACC_003',
    SUSPENDED: 'ACC_004',
  },
  NETWORK_ERROR: 'NET_001',
  UNKNOWN_ERROR: 'UNK_001',
} as const;

type ValueOf<T> = T[keyof T];
type FlattenObject<T> = T extends object 
  ? ValueOf<{ [K in keyof T]: T[K] extends object ? ValueOf<T[K]> : T[K] }>
  : never;

export type ErrorCode = FlattenObject<typeof ErrorCodes>;