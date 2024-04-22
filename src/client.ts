import { DEFAULT_NOTARIZATION_HEADERS } from './types';
import type {
  ClientConfig,
  EnclaveInfo,
  AttestationResponse,
  DebugRequestResponse,
  AttestationErrorResponse,
  AttestationRequest,
  DebugRequestResponseWithError,
} from './types';

import { AttestationError, DebugAttestationError, AttestationIntegrityError } from './errors';

export * from './types';

const DEFAULT_TIMEOUT_MS = 5000;

export const DEFAULT_FETCH_OPTIONS: Pick<RequestInit, 'cache'|'keepalive'|'mode'|'referrer'|'redirect'> = {
  cache: 'no-store',
  mode: 'cors',
  redirect: 'follow',
  referrer: '',
  keepalive: false,
};

export type NotarizationOptions = {
  /**
   * If multiple attesters are used, the client will check that the attestation data is exactly the same in all attestation responses.
   */
  dataShouldMatch: boolean;

  /**
   * Attestation request timeout, milliseconds.
   * If not set, the default timeout of fetch API is used, whatever fetch implementation it may be.
   */
  timeout?: number;

  /**
   * If multiple attesters are used this option controls the maximum deviation in milliseconds between attestation timestamps.
   *
   * - if set to 0, requires that all attestations are done at the same time (not recommended). Note that the attestation timestamp
   * is set by the attestation server using server time.
   * - if `undefined`, no time deviation checks are performed.
   */
  maxTimeDeviation?: number;
}

export type InfoOptions = {
  /**
   * Info request timeout, milliseconds. If not set, the default timeout of fetch API is used, whatever fetch implementation it may be.
   */
  timeout?: number;
}

export const DEFAULT_NOTARIZATION_OPTIONS: NotarizationOptions = {
  dataShouldMatch: true,
  timeout: DEFAULT_TIMEOUT_MS,
  maxTimeDeviation: undefined,
};

function trimUrl(url: string) {
  let trimmedUrl = url.trim();
  if (trimmedUrl.endsWith('/')) {
    trimmedUrl = trimmedUrl.slice(0, -1);
  }

  return trimmedUrl;
}

/**
 * @example
 * const req: AttestationRequest = {
 *   url: 'google.com',
 *   requestMethod: 'GET',
 *   responseFormat: 'html',
 *   htmlResultType: 'value',
 *   selector: '/html/head/title',
 * }
 *
 * const client = new OracleClient();
 *
 * const resp = await client.notarize(req);
 *
 * console.log(resp.attestationData); // will print "Google"
 */
export class OracleClient {
  #oracleBackends: (string|URL)[];

  #oracleFetchOptions: RequestInit;

  #verifier: string | URL;

  #verifierFetchOptions: RequestInit;

  private log: (...args: any[]) => void;

  constructor(config?: ClientConfig) {
    if (config?.quiet ?? false) {
      this.log = () => {};
    } else {
      this.log = config?.logger || console.log;
    }

    if (config?.notarizer) {
      this.log('OracleClient: using custom notarizer -', config.notarizer.url);
      this.#oracleBackends = [trimUrl(config.notarizer.url)];
    } else {
      this.#oracleBackends = [
        'https://sgx.aleooracle.xyz', // TODO: configure
      ];
    }
    this.#oracleFetchOptions = config?.notarizer?.init || DEFAULT_FETCH_OPTIONS;

    if (config?.verifier) {
      this.log('OracleClient: using custom verifier -', config.verifier.url);
      this.#verifier = trimUrl(config.verifier.url);
    } else {
      this.#verifier = 'https://verifier.aleooracle.xyz'; // TODO: configure
    }
    this.#verifierFetchOptions = config?.verifier?.init || DEFAULT_FETCH_OPTIONS;
  }

  /**
   * Requests attestation of data extracted from the provided URL using provided selector. Attestation is created by one or more
   * Trusted Execution Environments (TEE). If more than one is used (default), all attestation requests should succeed.
   *
   * Use options to configure attestation.
   *
   * If `options.dataShouldMatch` is set to `true`, returns extracted data, attested by one of the attesting TEEs.
   * Otherwise it returns an array of extracted data, attested by all of the available TEEs.
   *
   * @throws {AttestationError | AttestationIntegrityError | Error}
   */
  async notarize(req: AttestationRequest, options: NotarizationOptions = DEFAULT_NOTARIZATION_OPTIONS): Promise<AttestationResponse[]> {
    const attestations = await this.createAttestation(req, { timeout: options.timeout, debug: false }) as AttestationResponse[];
    this.log(`OracleClient: attested ${new URL(`https://${req.url}`).host} using ${this.#oracleBackends.length} attesters`);

    const numbAttestations = attestations.length;

    if (numbAttestations === 0 || numbAttestations !== this.#oracleBackends.length) {
      throw new AttestationIntegrityError(
        'unexpected number of attestations',
        { cause: `expected ${this.#oracleBackends.length}, got ${numbAttestations}` },
      );
    }

    // do some basic client side validation
    const firstAttestation = attestations[0];
    const attestationTimestamps = [attestations[0].timestamp];
    for (let i = 1; i < numbAttestations; i++) {
      // data matching is disabled, this check is done first for a possibility of early exit
      if (options.dataShouldMatch && attestations[i].attestationData !== firstAttestation.attestationData) {
        throw new AttestationIntegrityError('attestation data mismatch', { cause: attestations.map((at) => at.attestationData) });
      }

      // save the timestamps to check for deviation of all attestations
      attestationTimestamps.push(attestations[i].timestamp);
    }

    if (options.maxTimeDeviation !== undefined) {
      // warn the user that it's not recommended to have a deviation less than 10ms or more than 10s
      if (options.maxTimeDeviation < 10 || options.maxTimeDeviation > 10 * 1000) {
        this.log(`OracleClient: WARNING max time deviation for attestation of ${options.maxTimeDeviation}ms is not recommended`);
      }
      // test that all attestations were done within the allowed deviation
      attestationTimestamps.sort();
      // the difference between the soonest and latest timestamps shouldn't be more than the configured deviation
      if (attestationTimestamps[numbAttestations - 1] - attestationTimestamps[0] > options.maxTimeDeviation) {
        throw new AttestationIntegrityError(
          'attestation timestamps deviate too much',
          { cause: { maxTimeDeviation: options.maxTimeDeviation, attestationTimestamps } },
        );
      }
    }

    const isValid = await this.verifyReports(attestations);
    if (!isValid) {
      throw new AttestationIntegrityError('failed to verify reports');
    }

    return attestations;
  }

  /**
   * Use this function to test your requests without performing attestation and verification
   *
   * @throws {DebugAttestationError | Error}
   */
  async testSelector(req: AttestationRequest, timeout: number): Promise<DebugRequestResponse[]> {
    return this.createAttestation(req, { timeout, debug: true }) as Promise<DebugRequestResponse[]>;
  }

  /**
   * Requests information about enclaves that Notarization Backend is running in
   *
   * @throws {AttestationError | Error}
   */
  async enclavesInfo(options?: InfoOptions): Promise<EnclaveInfo[]> {
    const fetchOptions: RequestInit = {
      ...this.#oracleFetchOptions,
      method: 'GET',
    };

    if (options?.timeout && options?.timeout > 0) {
      fetchOptions.signal = AbortSignal.timeout(options?.timeout);
    }

    let responses: Response[];
    try {
      responses = await Promise.all(
        this.#oracleBackends.map((backend) => fetch(`${backend}/info`, fetchOptions)),
      );
    } catch (e) {
      this.log('OracleClient: one or more info requests have failed, reason -', e);
      throw e;
    }

    const enclavesInfo = await Promise.all(
      responses.map(async (resp) => {
        const oracleBackendURL = new URL(resp.url);
        let jsonBody;
        try {
          jsonBody = await resp.json();
        } catch (e) {
          this.log(`OracleClient: failed to parse info response from ${oracleBackendURL.host}, reason - ${e}`);
          // the response doesn't have a JSON body. This is an error response without an error message
          throw new Error('requesting info failed', { cause: { host: oracleBackendURL.host, status: resp.statusText } });
        }

        if (resp.status !== 200) {
          // general error with a JSON body
          throw new AttestationError(jsonBody as AttestationErrorResponse);
        }

        const info: EnclaveInfo = {
          enclaveUrl: oracleBackendURL.origin,
          ...jsonBody,
        };

        return info;
      }),
    );

    return enclavesInfo;
  }

  /**
   * @throws {AttestationIntegrityError | Error}
   */
  private async verifyReports(attestations: AttestationResponse[]): Promise<boolean> {
    const fetchOptions: RequestInit = {
      ...this.#verifierFetchOptions,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reports: attestations }),
    };

    let response: Response;
    try {
      response = await fetch(`${this.#verifier}/verify`, fetchOptions);
    } catch (e) {
      this.log('OracleClient: verification request have failed, reason -', e);
      throw e;
    }

    if (response.status !== 200) {
      throw new AttestationIntegrityError(`verification failed: ${response.statusText}`);
    }

    let jsonBody;
    try {
      jsonBody = await response.json() as { success: boolean, errorMessage?: string };
    } catch (e) {
      this.log(`OracleClient: failed to parse verification response from ${this.#verifier}, reason - ${e}`);
      throw new Error('verification failed', { cause: { host: this.#verifier, status: response.statusText } });
    }

    if (!jsonBody.success) {
      throw new AttestationIntegrityError(`verification failed: ${jsonBody.errorMessage}`);
    }

    return true;
  }

  /**
   * @throws {AttestationError | DebugAttestationError | Error}
   */
  private async createAttestation(
    req: AttestationRequest,
    options: { timeout?: number, debug: boolean } = { timeout: DEFAULT_TIMEOUT_MS, debug: false },
  ): Promise<AttestationResponse[] | DebugRequestResponse[]> {
    // construct oracle HTTP request body
    const attestReq: AttestationRequest & { debugRequest: boolean } = {
      ...req,
      requestHeaders: {
        ...DEFAULT_NOTARIZATION_HEADERS,
        ...(req.requestHeaders ?? {}),
      },
      debugRequest: options.debug,
    };

    // construct Fetch API options
    const fetchOptions: RequestInit = {
      ...this.#oracleFetchOptions,
      method: 'POST',
      body: JSON.stringify(attestReq),
    };

    // attach abort signal if timeout is enabled
    if (options.timeout && options.timeout > 0) {
      fetchOptions.signal = AbortSignal.timeout(options.timeout);
    }

    let responses: Response[];
    try {
      responses = await Promise.all(
        this.#oracleBackends.map((backend) => fetch(`${backend}/notarize`, fetchOptions)),
      );
    } catch (e) {
      this.log('OracleClient: one or more attestation requests have failed, reason -', e);
      throw e;
    }

    const attestations = await Promise.all(
      responses.map(async (resp) => {
        const oracleBackendURL = new URL(resp.url);
        let jsonBody;
        try {
          jsonBody = await resp.json();
        } catch (e) {
          this.log(`OracleClient: failed to parse attestation response from ${oracleBackendURL.host}, reason - ${e}`);
          // the response doesn't have a JSON body. This is an error response without an error message
          throw new Error('attestation failed', { cause: { host: oracleBackendURL.host, status: resp.statusText } });
        }

        if (resp.status !== 200) {
          // this is an error with a JSON body, can be attestation error or debug request error
          if (options.debug && jsonBody.responseBody !== undefined) {
            // user did a debug request, and we got a debug error response, which is indicated by having a responseBody and errorMessage
            throw new DebugAttestationError(jsonBody as DebugRequestResponseWithError);
          } else {
            // general attestation error with a JSON body
            throw new AttestationError(jsonBody as AttestationErrorResponse);
          }
        }

        // the user requested debugging, the request didn't fail, therefore it's a successful debugging request
        if (options.debug) {
          return jsonBody as DebugRequestResponse;
        }

        const attestation: AttestationResponse = {
          enclaveUrl: oracleBackendURL.origin,
          ...jsonBody,
        };

        return attestation;
      }),
    );

    return attestations as (AttestationResponse[] | DebugRequestResponse[]);
  }
}
