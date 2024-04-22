import type { AttestationErrorResponse, DebugRequestResponseWithError } from './types/attestation';

export class AttestationError extends Error {
  errorDetails: string | undefined;

  constructor(err: AttestationErrorResponse) {
    super(err.errorMessage);

    this.errorDetails = err.errorDetails;
  }
}

export class DebugAttestationError extends Error {
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

    this.responseBody = err.responseBody;
    this.extractedData = err.extractedData;
  }
}

export class AttestationIntegrityError extends Error {}
