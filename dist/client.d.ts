import type { ClientConfig, InfoOptions, EnclaveInfo, NotarizationOptions, AttestationResponse, DebugRequestResponse, AttestationRequest } from './types';
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
    #private;
    private log;
    constructor(config?: ClientConfig);
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
    notarize(req: AttestationRequest, options?: NotarizationOptions): Promise<AttestationResponse[]>;
    /**
     * Use this function to test your requests without performing attestation and verification
     *
     * @throws {DebugAttestationError | Error}
     */
    testSelector(req: AttestationRequest, timeout: number): Promise<DebugRequestResponse[]>;
    /**
     * Requests information about enclaves that Notarization Backend is running in
     *
     * @throws {AttestationError | Error}
     */
    enclavesInfo(options?: InfoOptions): Promise<EnclaveInfo[]>;
    /**
     * @throws {AttestationIntegrityError | Error}
     */
    private verifyReports;
    /**
     * @throws {AttestationError | DebugAttestationError | Error}
     */
    private createAttestation;
}
