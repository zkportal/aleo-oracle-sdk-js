/* eslint-disable import/prefer-default-export */
import { AttestationError, DebugAttestationError } from './errors';

import type {
  AttestationErrorResponse,
  AttestationResponse,
  CustomBackendConfig,
  DebugRequestResponse,
  DebugRequestResponseWithError,
  EnclaveInfo,
} from './types';

import fetch, { type Response } from './fetch';
import { getOrResolveFullAddress, type IpAndUrl } from './address';

export type BackendMesh = { backend: Required<CustomBackendConfig>; ipAndUrl: IpAndUrl[] }[];

// Resolves backends to one or more IPs and builds URLs with the IPs and path string.
export async function resolveBackends(backends: Required<CustomBackendConfig>[], path: string): Promise<BackendMesh> {
  // resolve backends to one or more IPs, then we send the request to all of the resolved IPs
  // and get the first response - this helps with availability and geographic load balancing.
  return Promise.all(
    backends.map(async (backend) => {
      const resolvedUrls = await getOrResolveFullAddress(backend, path);
      return {
        backend,
        ipAndUrl: resolvedUrls,
      };
    }),
  );
}

// Performs a request to the backend mesh prepared by resolveBackends
export async function requestBackendMesh(
  backendMesh: BackendMesh,
  method: string,
  body?: object,
  abortSignal?: AbortSignal,
): Promise<Response[]> {
  const settledResult = await Promise.allSettled(
    backendMesh.map(async (resolvedBackend) => {
      const fetchOptions: RequestInit = {
        ...resolvedBackend.backend.init,
        method,
        body: body ? JSON.stringify(body) : undefined,
        signal: abortSignal,
        headers: {
          ...resolvedBackend.backend.init.headers,
          'Content-Type': 'application/json',
        },
      };

      // each backend may be resolved to more than one IP, send a request to all of them,
      // for every backend wait for only one response to arrive.
      return Promise.any(
        resolvedBackend.ipAndUrl.map(({ ip, path }) => fetch(resolvedBackend.backend, ip, path, fetchOptions)),
      );
    }),
  );

  const responses: Response[] = [];
  const errorReasons: PromiseRejectedResult['reason'][] = [];

  settledResult.forEach((result) => {
    if (result.status === 'rejected') {
      errorReasons.push(result.reason);
      return;
    }

    responses.push(result.value);
  });

  if (responses.length === 0) {
    throw new Error(`all backends responded with errors: ${JSON.stringify(errorReasons)}`);
  }

  return responses;
}

export async function handleInfoResponse(resp: Response): Promise<EnclaveInfo> {
  const oracleBackendURL = new URL(resp.url);
  let jsonBody;
  try {
    jsonBody = await resp.json();
  } catch (e) {
    // the response doesn't have a JSON body. This is an error response without an error message
    throw new Error('failed to parse response', { cause: { error: e, host: oracleBackendURL.host, status: resp.statusText } });
  }

  if (resp.status !== 200) {
    // general error with a JSON body
    throw new AttestationError(jsonBody as AttestationErrorResponse);
  }

  const result: EnclaveInfo = {
    enclaveUrl: oracleBackendURL.origin,
    ...jsonBody,
  };

  return result;
}

export async function handleAttestationResponse(
  options: { timeout?: number; debug: boolean },
  resp: Response,
): Promise<DebugRequestResponse|AttestationResponse> {
  const oracleBackendURL = new URL(resp.url);
  let jsonBody;
  try {
    jsonBody = await resp.json();
  } catch (e) {
    // the response doesn't have a JSON body. This is an error response without an error message
    throw new Error('attestation failed', { cause: { error: e, host: oracleBackendURL.host, status: resp.statusText } });
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
}
