/* eslint-disable import/prefer-default-export */
import { AttestationError, DebugAttestationError } from './errors';

import type {
  AttestationErrorResponse,
  AttestationResponse,
  DebugRequestResponse,
  DebugRequestResponseWithError,
  EnclaveInfo,
} from './types';

import type { Response } from './fetch';

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
