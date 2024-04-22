export type CustomBackendAllowedFetchOptions = Omit<RequestInit, 'body' | 'integrity' | 'method'>;

export type CustomBackendConfig = {
  url: string;
  init?: CustomBackendAllowedFetchOptions;
};

/**
 * Oracle SDK client configuration
 */
export type ClientConfig = {
  /**
   * Can be set to use self-hosted Oracle Notarization service for testing
   */
  notarizer?: CustomBackendConfig;

  /**
   * Can be set to use a self-hosted Oracle Notarization Verification service
   */
  verifier?: CustomBackendConfig;

  /**
   * Disables Oracle Client logging
   */
  quiet?: boolean;

  /**
   * Custom logging function. Will be used for logging by the client unless "quiet" flag is enabled
   */
  logger?: (...args: any[]) => void;
};
