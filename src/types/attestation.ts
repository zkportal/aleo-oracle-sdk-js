/* eslint-disable max-len */
export type HeaderDict = { [header: string]: string };

export type PositionInfo = {
  // Index of the block where the write operation started
  Pos: number;
  // Number of blocks written in the write operation
  Len: number;
}

export type ProofPositionalInfo = {
  data: PositionInfo;
  timestamp: PositionInfo;
  statusCode: PositionInfo;
  method: PositionInfo;
  responseFormat: PositionInfo;
  url: PositionInfo;
  selector: PositionInfo;
  encodingOptions: PositionInfo;
  requestHeaders: PositionInfo;
  optionalFields: PositionInfo;
}

export type NitroReportExtras = {
  pcr0Pos: string;
  pcr1Pos: string;
  pcr2Pos: string;
  userDataPos: string;
}

export type OracleData = {
  /**
   * Schnorr signature of a verified Attestation Report.
   */
  signature: string;

  /**
   * Aleo-encoded data, that was used to create hash included in Attestation Report.
   */
  userData: string;

  /**
   * Aleo-encoded Attestation Report.
   */
  report: string;

  /**
   * A public key the signature was created against.
   */
  address: string;

  /**
   * Object containing information about positions of data included in Attestation Report hash.
   */
  encodedPositions: ProofPositionalInfo;

  /**
   * Aleo-encoded request. Same as `UserData` but with zeroed `attestationData` and `timestamp`.
   */
  encodedRequest: string;

  /**
   * Poseidon8 hash of an `encodedRequest`. Can be used to verify in an aleo program that the report was made with the correct request.
   */
  requestHash: string;

  /**
   * Poseidon8 hash of the request hash with the attestation timestamp.
   * Can be used to verify in an aleo program that the report was made with the correct request.
   */
  timestampedRequestHash: string;

  /**
   * Object containing extra information about the attestation report.
   * If the attestation type is "nitro", it contains Aleo-encoded structs with
   * information that helps to extract user data and PCR values from the report.
   */
  reportExtras: NitroReportExtras | undefined;
}

type EncodingOptions = {
  /**
   * Type which should be used to interpret an Attestation Data to encode it to Aleo format (to be used in an aleo program)
   *
   * `string` - Extracted value is a string
   *
   * `int` - Extracted value is an unsigned decimal or hexadecimal integer up to 64 bits in size
   *
   * `float` - Extracted value is an unsigned floating point number up to 64 bits in size
   */
  value: 'string' | 'int' | 'float';

  /**
   * `Required if "encodingValue" is "float"`.
   *
   * Precision of an Attestaton Data. Mush be equal or bigger than the number of digits after the comma.
   */
  precision?: number;
}

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

/**
 * It is highly recommended to use a time insensitive historic data to notarize.
 */
export type AttestationRequest = {
  /**
   * URL of a resource to attest - attestation target. Supports only HTTPS.
   */
  url: string;

  /**
   * HTTP method to be used for a request to the attestation target.
   */
  requestMethod: 'GET' | 'POST';

  /**
   * Optional element selector for extracting data from the attestation resource - XPath for HTML, JSON key path for JSON.
   * When empty, the oracle attests to the whole response unless the response size limit of **4kb** is hit.
   *
   * JSON key path example - given an example JSON
   * `{
   *   "primitive": "value",
   *   "list": [123, 223, 3],
   *   "dictionary": {
   *     "key1": "value1",
   *     "key2": "value2"
   *   }
   * }`
   *
   * - selector `"primitive"` will select `value`;
   * - selector `"list.[1]"` will select `223`;
   * - selector `"dictionary.key2"` will select `value2`.
   */
  selector?: string;

  /**
   * Expected attestation target response format.
   */
  responseFormat: 'html' | 'json';

  /**
   * When `responseFormat` is `'html'`, this field indicates the type of extraction
   * for the response after applying the selector.
   *
   * Given extracted value below
   *
   * `<a href="/test">Nice link</a>`
   *
   * - using `'element'` will return the whole tag;
   * - using `'value'` will return `Nice link`. This is an equivalent of using {@link HTMLElement#innerText}.
   */
  htmlResultType?: 'element' | 'value';

  /**
   * Can be used to provide a POST request body for the attestation target request.
   *
   * Has effect only when `requestMethod` is `'POST'`.
   */
  requestBody?: string;

  /**
   * Can be used to provide a Content-Type request header for the attestation target request.
   *
   * Has effect only when `requestMethod` is `'POST'`.
   */
  requestContentType?: string;

  /**
   * Optional dictionary of HTTP headers to add to the request to attestation target.
   *
   * Value of headers which might contain sensitive information (like `Authorization`, `X-Auth-Token` or `Cookie`)
   * and any non-standard headers used by attestation target would be replaced with `*****` in attestation report.
   *
   * This SDK will use some default request header.
   */
  requestHeaders?: HeaderDict;

  /**
   * Information about how to encode Attestation Data to Aleo-compatible format.
   */
  encodingOptions: EncodingOptions;
};

/**
 * Notarization backend's response for attestation request.
 */
export type AttestationResponse = {
  /**
   * Url of the Notarization Backend the report came from.
   */
  enclaveUrl: string;

  /**
   * Attestation Report in Base64 encoding, created by the Trusted Execution Environment using the extracted data.
   */
  attestationReport: string;

  /**
   * Which TEE produced an attestation report.
   */
  reportType: 'sgx' | 'nitro';

  /**
   * Data extracted from the attestation target's response using the provided selector.
   *
   * The data is always a string, as seen in the raw HTTP response.
   */
  attestationData: string;

  /**
   * Full response body received in the attestation target's response.
   */
  responseBody: string;

  /**
   * Status code of the attestation target's response.
   */
  responseStatusCode: number;

  /**
   * 32 hex-encoded bytes that were used by AWS Nitro as nonce to create an attestation report. Will be empty in case of SGX.
   */
  nonce?: string;

  /**
   * Unix timestamp of attestation date time as seen by the server.
   */
  timestamp: number;

  /**
   * Information that can be used for with your Aleo program, like Aleo-formated attestation report.
   */
  oracleData: OracleData;

  /**
   * Original attestation request.
   */
  attestationRequest: Readonly<AttestationRequest>;
};

export type AttestationErrorResponse = {
  errorMessage: string;
  errorCode: number;
  errorDetails?: string;
  responseStatusCode?: number;
};

export type DebugRequestResponse = {
  /**
   * Full response body received in the attestation target's response.
   */
  responseBody: string;

  /**
   * Status code of the attestation target's response.
   */
  responseStatusCode: number;

  /**
   * Extracted data from `responseBody` using provided selector.
   */
  extractedData: string;
};

export type SgxInfo = {
  /**
   * Security version of the enclave. For SGX enclaves, this is the ISVSVN value.
   */
  securityVersion: number;

  /**
   * If true, the report is for a debug enclave.
   */
  debug: boolean;

  /**
   * The unique ID for the enclave - MRENCLAVE value. Base64.
   */
  uniqueId: string;

  /**
   * The signer ID for the enclave - MRSIGNER value. Base64.
   */
  signerId: string;

  /**
   * The Product ID for the enclave - ISVPRODID value. Base64.
   */
  productId: string;

  /**
   * The status of the enclave's TCB level.
   */
  tcbStatus: number;

  /**
   * Some of the SGX report values encoded for Aleo.
   */
  aleo: {
    /**
     * Same as UniqueID but encoded for Aleo as a struct of two `u128`s.
     *
     * @example
     * "{ chunk_1: 182463194922434241099279556506927504877u128, chunk_2: 195059457426944486782769680982131545140u128 }"
     */
    uniqueId: string;

    /**
     * Same as SignerID but encoded for Aleo as a struct of two `u128`s.
     *
     * @example
     * "{ chunk_1: 153386052680309655679396867527014121204u128, chunk_2: 35972203959719964238382729092704599014u128 }"
     */
    signerId: string;

    /**
     * Same as ProductID but encoded for Aleo as one `u128`.
     *
     * @example "0u128"
     */
    productId: string;
  };
}

export type NitroDocument = {
  /**
   * Issuing Nitro hypervisor module ID.
   */
  moduleID: string;

  /**
   * UTC time when document was created, in milliseconds since UNIX epoch.
   */
  timestamp: number;

  /**
   * The digest function used for calculating the register values.
   */
  digest: 'SHA384';

  /**
   * Map of all locked PCRs at the moment the attestation document was generated. All PCR values are 48 bytes long. Base64.
   */
  pcrs: {
    '0': string;
    '1': string;
    '2': string;
    '3': string;
    '4': string;
    '5': string;
    '6': string;
    '7': string;
    '8': string;
    '9': string;
    '10': string;
    '11': string;
    '12': string;
    '13': string;
    '14': string;
    '15': string;
  };

  /**
   * The public key certificate for the public key that was used to sign the attestation document. Base64.
   */
  certificate: string;

  /**
   * Issuing CA bundle for infrastructure certificate. Base64.
   */
  cabundle: string[];

  /**
   * Additional signed user data. Always zero in a self report. Base64.
   */
  userData: string;

  /**
   * An optional cryptographic nonce provided by the attestation consumer as a proof of authenticity. Base64.
   */
  nonce: string;
}

export type NitroInfo = {
  /**
   * Nitro enclave attestation document.
   */
  document: NitroDocument;

  /**
   * Protected section from the COSE Sign1 payload of the Nitro enclave attestation result. Base64.
   */
  protectedCose: string;

  /**
   * Signature section from the COSE Sign1 payload of the Nitro enclave attestation document. Base64.
   */
  signature: string;

  /**
   * Some of the Nitro document values encoded for Aleo.
   */
  aleo: {
    /**
     * PCRs 0-2 encoded for Aleo as one struct of 9 `u128` fields, 3 chunks per PCR value.
     *
     * @example
     * "{ pcr_0_chunk_1: 286008366008963534325731694016530740873u128, pcr_0_chunk_2: 271752792258401609961977483182250439126u128, pcr_0_chunk_3: 298282571074904242111697892033804008655u128, pcr_1_chunk_1: 160074764010604965432569395010350367491u128, pcr_1_chunk_2: 139766717364114533801335576914874403398u128, pcr_1_chunk_3: 227000420934281803670652481542768973666u128, pcr_2_chunk_1: 280126174936401140955388060905840763153u128, pcr_2_chunk_2: 178895560230711037821910043922200523024u128, pcr_2_chunk_3: 219470830009272358382732583518915039407u128 }"
     */
    pcrs: string;

    /**
     * Self report user data (always zero) encoded for Aleo as a `u128`.
     *
     * @example "0u128"
     */
    userData: string;
  };
}

export type InfoOptions = {
  /**
   * Info request timeout, milliseconds. If not set, the default timeout of fetch API is used, whatever fetch implementation it may be.
   */
  timeout?: number;
}

/**
 * Information about TEE Notarization Backend is running in.
 */
export type EnclaveInfo = {
  /**
   * Url of the Notarization Backend the report came from.
   */
  enclaveUrl: string;

  /**
   * TEE that backend is running in.
   */
  reportType: 'sgx' | 'nitro';

  /**
   * Information about the TEE. If reportType is 'sgx', then the type is SgxInfo; if reportType is 'nitro', then the type is NitroInfo.
   */
  info: SgxInfo | NitroInfo;

  /**
   * Public key of the report signing key that was generated in the enclave.
   */
  signerPubKey: string;
}

export type DebugRequestResponseWithError = DebugRequestResponse & AttestationErrorResponse;
