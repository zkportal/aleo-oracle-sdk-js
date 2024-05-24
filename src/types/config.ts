export type CustomBackendAllowedFetchOptions = Omit<RequestInit, 'body' | 'integrity' | 'method'>;

/**
 * Oracle SDK backend configuration type for using custom backends with the client.
 */
export type CustomBackendConfig = {
  /**
   * Domain name or IP address of the backend
   */
  address: string;

  /**
   * The port that the backend listens on for the API requests
   */
  port: number;

  /**
   * Whether the client should use HTTPS to connect to the backend
   */
  https: boolean;

  /**
   * Whether the client should resolve the backend (when it's a domain name).
   * If the domain name is resolved to more than one IP, then the requests will be
   * sent to all of the resolved servers, and the first response will be used.
   */
  resolve: boolean;

  /**
   * Optional API prefix to use before the API endpoints
   */
  apiPrefix?: string;

  /**
   * Optional custom Fetch API options
   */
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
