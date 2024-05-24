import type {
  ClientConfig,
  InfoOptions,
  EnclaveInfo,
  NotarizationOptions,
  AttestationResponse,
  DebugRequestResponse,
  AttestationRequest,
  CustomBackendConfig,
} from './types';

import {
  DEFAULT_FETCH_OPTIONS, DEFAULT_NOTARIZATION_BACKENDS, DEFAULT_NOTARIZATION_OPTIONS, DEFAULT_TIMEOUT_MS,
  DEFAULT_VERIFICATION_BACKEND, DEFAULT_NOTARIZATION_HEADERS,
} from './defaults';
import { AttestationIntegrityError } from './errors';
import {
  getFullAddress, getOrResolveFullAddress, trimPath, trimUrl,
} from './address';
import { handleAttestationResponse, handleInfoResponse } from './request';
import fetch, { type Response } from './fetch';

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
export default class OracleClient {
  #oracleBackends: Required<CustomBackendConfig>[];

  #verifier: Required<CustomBackendConfig>;

  private log: (...args: any[]) => void;

  constructor(config?: ClientConfig) {
    if (config?.quiet ?? false) {
      this.log = () => {};
    } else {
      this.log = config?.logger || console.log;
    }

    // we may modify the config, so we create a copy
    const conf = { ...config };

    // Use the configured notarizer backend, add default fetch options if they are missing.
    // Use default notarization backends if the configuration is missing.
    // Note that the configuration allows configuring only one backend, while the SDK supports multiple
    // notarization backends.
    if (conf?.notarizer) {
      conf.notarizer.init = {
        ...DEFAULT_FETCH_OPTIONS,
        ...conf.notarizer.init,
      };
      conf.notarizer.apiPrefix = conf.notarizer.apiPrefix || '';
      this.#oracleBackends = [conf.notarizer as Required<CustomBackendConfig>];
    } else {
      this.#oracleBackends = DEFAULT_NOTARIZATION_BACKENDS as Required<CustomBackendConfig>[];
    }

    // sanitize oracle backend configs
    this.#oracleBackends = this.#oracleBackends.map((backend: Required<CustomBackendConfig>) => {
      const sanitizedConf = { ...backend };
      sanitizedConf.address = trimUrl(backend.address);
      sanitizedConf.apiPrefix = trimPath(backend.apiPrefix || '');
      return sanitizedConf;
    });
    this.log('OracleClient: using notarizers:', this.#oracleBackends.map((backend) => getFullAddress(backend).host).join(', '));

    // Use the configured verification backend, add default fetch options if they are missing.
    // Use default verification backend if the configuration is missing.
    if (conf?.verifier) {
      conf.verifier.init = {
        ...DEFAULT_FETCH_OPTIONS,
        ...conf.verifier.init,
      };
      conf.verifier.apiPrefix = conf.verifier.apiPrefix || '';
      this.#verifier = conf.verifier as Required<CustomBackendConfig>;
    } else {
      this.#verifier = DEFAULT_VERIFICATION_BACKEND as Required<CustomBackendConfig>;
    }

    // sanitize verification backend config
    this.#verifier.address = trimUrl(this.#verifier.address);
    this.#verifier.apiPrefix = trimPath(this.#verifier.apiPrefix || '');

    this.log('OracleClient: using verifier:', getFullAddress(this.#verifier).host);
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

    const isValid = await this.verifyReports(attestations, options.timeout || DEFAULT_TIMEOUT_MS);
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
    const API_ENDPOINT = '/info';

    let abortSignal: AbortSignal|undefined;

    if (options?.timeout && options?.timeout > 0) {
      abortSignal = AbortSignal.timeout(options?.timeout);
    }

    // resolve backends to one or more IPs, then we send the request to all of the resolved IPs
    // and get the first response - this helps with availability and geographic load balancing.
    const resolvedBackends = await Promise.all(
      this.#oracleBackends.map(async (backend) => {
        const hostsAndUrls = await getOrResolveFullAddress(backend, API_ENDPOINT);
        return {
          backend,
          hostsAndUrls,
        };
      }),
    );

    let responses: Response[];

    try {
      // each backend may be resolved to more than one IP, send a request to all of them,
      // for every backend wait for only one response to arrive.
      responses = await Promise.all(
        resolvedBackends.map(async (resolvedBackend) => {
          const fetchOptions: RequestInit = {
            ...resolvedBackend.backend.init,
            signal: abortSignal,
            method: 'GET',
            headers: {
              ...resolvedBackend.backend.init.headers,
              'Content-Type': 'application/json',
            },
          };

          return Promise.any(
            resolvedBackend.hostsAndUrls.map(({ ip, path }) => fetch(resolvedBackend.backend, ip, path, fetchOptions)),
          );
        }),
      );
    } catch (e) {
      this.log('OracleClient: one or more info requests have failed, reason -', e);
      throw e;
    }

    const enclavesInfo = await Promise.all(
      responses.map((resp) => handleInfoResponse(resp)),
    );

    return enclavesInfo;
  }

  /**
   * @throws {AttestationIntegrityError | Error}
   */
  private async verifyReports(attestations: AttestationResponse[], timeout: number): Promise<boolean> {
    const API_ENDPOINT = '/verify';

    const abortSignal = AbortSignal.timeout(timeout);

    // resolve backends to one or more IPs, then we send the request to all of the resolved IPs
    // and get the first response - this helps with availability and geographic load balancing.
    const resolvedUrls = await getOrResolveFullAddress(this.#verifier, API_ENDPOINT);

    const fetchOptions: RequestInit = {
      ...this.#verifier.init,
      signal: abortSignal,
      method: 'POST',
      headers: {
        ...this.#verifier.init.headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reports: attestations }),
    };

    let response: Response;
    try {
      response = await Promise.any(resolvedUrls.map(({ ip, path }) => fetch(this.#verifier, ip, path, fetchOptions)));
    } catch (e) {
      this.log('OracleClient: verification request have failed, reason -', e);
      throw e;
    }

    if (response.status !== 200) {
      throw new AttestationIntegrityError(`verification failed: ${response.statusText}`);
    }

    let jsonBody;
    try {
      jsonBody = await response.json() as { success: boolean; errorMessage?: string };
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
    options: { timeout?: number; debug: boolean } = { timeout: DEFAULT_TIMEOUT_MS, debug: false },
  ): Promise<AttestationResponse[] | DebugRequestResponse[]> {
    const API_ENDPOINT = '/notarize';

    // construct oracle HTTP request body
    const attestReq: AttestationRequest & { debugRequest: boolean } = {
      ...req,
      requestHeaders: {
        ...DEFAULT_NOTARIZATION_HEADERS,
        ...(req.requestHeaders ?? {}),
      },
      debugRequest: options.debug,
    };

    let abortSignal: AbortSignal|undefined;

    if (options?.timeout && options?.timeout > 0) {
      abortSignal = AbortSignal.timeout(options?.timeout);
    }

    // resolve backends to one or more IPs, then we send the request to all of the resolved IPs
    // and get the first response - this helps with availability and geographic load balancing.
    const resolvedBackends = await Promise.all(
      this.#oracleBackends.map(async (backend) => {
        const resolvedUrls = await getOrResolveFullAddress(backend, API_ENDPOINT);
        return {
          backend,
          ipAndUrl: resolvedUrls,
        };
      }),
    );

    let responses: Response[];
    try {
      // each backend may be resolved to more than one IP, send a request to all of them,
      // for every backend wait for only one response to arrive.
      responses = await Promise.all(
        resolvedBackends.map(async (resolvedBackend) => {
          const fetchOptions: RequestInit = {
            ...resolvedBackend.backend.init,
            method: 'POST',
            signal: abortSignal,
            body: JSON.stringify(attestReq),
            headers: {
              ...resolvedBackend.backend.init.headers,
              'Content-Type': 'application/json',
            },
          };

          return Promise.any(
            resolvedBackend.ipAndUrl.map(({ ip, path }) => fetch(resolvedBackend.backend, ip, path, fetchOptions)),
          );
        }),
      );
    } catch (e) {
      this.log('OracleClient: one or more attestation requests have failed, reason -', e);
      throw e;
    }

    const attestations = await Promise.all(
      responses.map(async (resp) => handleAttestationResponse(options, resp)),
    );

    return attestations as (AttestationResponse[] | DebugRequestResponse[]);
  }
}
