import type { AttestationErrorResponse, DebugRequestResponseWithError } from './types/attestation';

export class AttestationError extends Error {
  /**
   * Additional information to help figure out the reason for the error
   */
  errorDetails: string | undefined;

  /**
   * Custom error code that can help to identify an issue.
   * Detailed explanation of all the error codes can be found in the documentation:
   * https://docs.aleooracle.xyz/sdk/errors/
   */
  errorCode: number;

  /**
   * Attestation target's response status code, which exists if the error
   * has occurred during or after performing a request to the target.
   */
  responseStatusCode: number | undefined;

  constructor(err: AttestationErrorResponse) {
    super(err.errorMessage);

    this.errorCode = err.errorCode;
    this.errorDetails = err.errorDetails;
    this.responseStatusCode = err.responseStatusCode;
  }
}

export class DebugAttestationError extends Error {
  /**
   * Additional information to help figure out the reason for the error
   */
  errorDetails: string | undefined;

  /**
   * Custom error code that can help to identify an issue.
   * Detailed explanation of all the error codes can be found in the documentation:
   * https://docs.aleooracle.xyz/sdk/errors/
   */
  errorCode: number | undefined;

  /**
   * Attestation target's response status code, which exists if the error
   * has occurred during or after performing a request to the target.
   */
  responseStatusCode: number | undefined;

  /**
   * Full response body received in the attestation target's response
   */
  responseBody: string;

  /**
   * Extracted data from `responseBody` using provided selector
   */
  extractedData: string;

  constructor(err: DebugRequestResponseWithError) {
    super(err.errorMessage);

    this.errorDetails = err.errorDetails;
    this.errorCode = err.errorCode;
    this.responseStatusCode = err.responseStatusCode;
    this.responseBody = err.responseBody;
    this.extractedData = err.extractedData;
  }
}

export class AttestationIntegrityError extends Error {}
