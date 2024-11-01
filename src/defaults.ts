import type { CustomBackendConfig, HeaderDict, NotarizationOptions } from './types';

export const DEFAULT_TIMEOUT_MS = 5000;

export const DEFAULT_NOTARIZATION_HEADERS: HeaderDict = {
  Accept: '*/*',
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Upgrade-Insecure-Requests': '1',
  DNT: '1',
};

export const DEFAULT_FETCH_OPTIONS: Pick<RequestInit, 'cache'|'keepalive'|'mode'|'referrer'|'redirect'> = {
  cache: 'no-store',
  mode: 'cors',
  redirect: 'follow',
  referrer: '',
  keepalive: false,
};

export const DEFAULT_NOTARIZATION_OPTIONS: NotarizationOptions = {
  dataShouldMatch: true,
  timeout: DEFAULT_TIMEOUT_MS,
  maxTimeDeviation: undefined,
};

export const DEFAULT_NOTARIZATION_BACKENDS: CustomBackendConfig[] = [
  {
    address: 'sgx.aleooracle.xyz',
    port: 443,
    https: true,
    apiPrefix: '',
    resolve: true,
    init: DEFAULT_FETCH_OPTIONS,
  },
  {
    address: 'nitro.aleooracle.xyz',
    port: 443,
    https: true,
    apiPrefix: '',
    resolve: true,
    init: DEFAULT_FETCH_OPTIONS,
  },
];

export const DEFAULT_VERIFICATION_BACKEND: CustomBackendConfig = {
  address: 'verifier.aleooracle.xyz',
  port: 443,
  https: true,
  apiPrefix: '',
  resolve: true,
  init: DEFAULT_FETCH_OPTIONS,
};
