import type { CustomBackendConfig, HeaderDict, NotarizationOptions } from './types';
export declare const DEFAULT_TIMEOUT_MS = 5000;
export declare const DEFAULT_NOTARIZATION_HEADERS: HeaderDict;
export declare const DEFAULT_FETCH_OPTIONS: Pick<RequestInit, 'cache' | 'keepalive' | 'mode' | 'referrer' | 'redirect'>;
export declare const DEFAULT_NOTARIZATION_OPTIONS: NotarizationOptions;
export declare const DEFAULT_NOTARIZATION_BACKENDS: CustomBackendConfig[];
export declare const DEFAULT_VERIFICATION_BACKEND: CustomBackendConfig;
