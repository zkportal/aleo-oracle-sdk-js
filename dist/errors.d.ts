import type { AttestationErrorResponse, DebugRequestResponseWithError } from './types/attestation';
export declare class AttestationError extends Error {
    /**
     * Additional information to help figure out the reason for the error
     */
    errorDetails: string | undefined;
    /**
     * Attestation target's response status code, which exists if the error
     * has occurred during or after performing a request to the target.
     */
    responseStatusCode: number | undefined;
    constructor(err: AttestationErrorResponse);
}
export declare class DebugAttestationError extends Error {
    /**
     * Additional information to help figure out the reason for the error
     */
    errorDetails: string | undefined;
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
    constructor(err: DebugRequestResponseWithError);
}
export declare class AttestationIntegrityError extends Error {
}
