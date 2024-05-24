import dns from 'node:dns';
import net from 'node:net';
import https from 'node:https';
import http from 'node:http';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_NOTARIZATION_HEADERS = {
    Accept: '*/*',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Upgrade-Insecure-Requests': '1',
    DNT: '1',
};
const DEFAULT_FETCH_OPTIONS = {
    cache: 'no-store',
    mode: 'cors',
    redirect: 'follow',
    referrer: '',
    keepalive: false,
};
const DEFAULT_NOTARIZATION_OPTIONS = {
    dataShouldMatch: true,
    timeout: DEFAULT_TIMEOUT_MS,
    maxTimeDeviation: undefined,
};
const DEFAULT_NOTARIZATION_BACKENDS = [
    {
        address: 'sgx.aleooracle.xyz',
        port: 443,
        https: true,
        apiPrefix: '',
        resolve: true,
        init: DEFAULT_FETCH_OPTIONS,
    },
];
const DEFAULT_VERIFICATION_BACKEND = {
    address: 'verifier.aleooracle.xyz',
    port: 443,
    https: true,
    apiPrefix: '',
    resolve: true,
    init: DEFAULT_FETCH_OPTIONS,
};

class AttestationError extends Error {
    /**
     * Additional information to help figure out the reason for the error
     */
    errorDetails;
    /**
     * Attestation target's response status code, which exists if the error
     * has occurred during or after performing a request to the target.
     */
    responseStatusCode;
    constructor(err) {
        super(err.errorMessage);
        this.errorDetails = err.errorDetails;
        this.responseStatusCode = err.responseStatusCode;
    }
}
class DebugAttestationError extends Error {
    /**
     * Additional information to help figure out the reason for the error
     */
    errorDetails;
    /**
     * Attestation target's response status code, which exists if the error
     * has occurred during or after performing a request to the target.
     */
    responseStatusCode;
    /**
     * Full response body received in the attestation target's response
     */
    responseBody;
    /**
     * Extracted data from `responseBody` using provided selector
     */
    extractedData;
    constructor(err) {
        super(err.errorMessage);
        this.errorDetails = err.errorDetails;
        this.responseStatusCode = err.responseStatusCode;
        this.responseBody = err.responseBody;
        this.extractedData = err.extractedData;
    }
}
class AttestationIntegrityError extends Error {
}

async function resolve(hostname) {
    const { resolve4 } = dns.promises;
    return resolve4(hostname);
}
function trimPath(path) {
    let res = path.trim();
    if (res === '') {
        return res;
    }
    // replace repeating slashes in the beginning with one slash, remove repeating slashes in the end
    res = res.replace(/^\/+/, '/').replace(/\/+$/, '');
    // if the string didn't have a slash in the beginning in the first place,
    // then replace won't work, so we add one manually
    if (!res.startsWith('/')) {
        res = `/${res}`;
    }
    return res;
}
// Builds a URL based on the backend config and the desired resource path
function getFullAddress(info, path = '') {
    const scheme = info.https ? 'https://' : 'http://';
    const trimmedPath = trimPath(path);
    return {
        host: `${info.address}:${info.port}`,
        url: `${scheme}${info.address}:${info.port}${info.apiPrefix}${trimmedPath}`,
        path: `${info.apiPrefix}${trimmedPath}`,
    };
}
// Builds a URL based on the backend config and the desired resource path. If the address is not an IP, and
// the backend config enables resolving, then this function tries to resolve the address to an IP, then builds
// the full URLs using all of the resolved IPs.
async function getOrResolveFullAddress(info, path) {
    let ips = [info.address];
    if (net.isIP(info.address) === 0 && info.resolve) {
        ips = await resolve(info.address);
    }
    return ips.map((ip) => {
        const trimmedPath = trimPath(path);
        const scheme = info.https ? 'https://' : 'http://';
        return {
            ip,
            url: `${scheme}${ip}:${info.port}${info.apiPrefix}${trimmedPath}`,
            path: `${info.apiPrefix}${trimmedPath}`,
        };
    });
}
function trimUrl(url) {
    let trimmedUrl = url.trim();
    // delete trailing slashes
    while (trimmedUrl.endsWith('/')) {
        trimmedUrl = trimmedUrl.slice(0, -1);
    }
    return trimmedUrl;
}

/* eslint-disable import/prefer-default-export */
async function handleInfoResponse(resp) {
    const oracleBackendURL = new URL(resp.url);
    let jsonBody;
    try {
        jsonBody = await resp.json();
    }
    catch (e) {
        // the response doesn't have a JSON body. This is an error response without an error message
        throw new Error('failed to parse response', { cause: { error: e, host: oracleBackendURL.host, status: resp.statusText } });
    }
    if (resp.status !== 200) {
        // general error with a JSON body
        throw new AttestationError(jsonBody);
    }
    const result = {
        enclaveUrl: oracleBackendURL.origin,
        ...jsonBody,
    };
    return result;
}
async function handleAttestationResponse(options, resp) {
    const oracleBackendURL = new URL(resp.url);
    let jsonBody;
    try {
        jsonBody = await resp.json();
    }
    catch (e) {
        // the response doesn't have a JSON body. This is an error response without an error message
        throw new Error('attestation failed', { cause: { error: e, host: oracleBackendURL.host, status: resp.statusText } });
    }
    if (resp.status !== 200) {
        // this is an error with a JSON body, can be attestation error or debug request error
        if (options.debug && jsonBody.responseBody !== undefined) {
            // user did a debug request, and we got a debug error response, which is indicated by having a responseBody and errorMessage
            throw new DebugAttestationError(jsonBody);
        }
        else {
            // general attestation error with a JSON body
            throw new AttestationError(jsonBody);
        }
    }
    // the user requested debugging, the request didn't fail, therefore it's a successful debugging request
    if (options.debug) {
        return jsonBody;
    }
    const attestation = {
        enclaveUrl: oracleBackendURL.origin,
        ...jsonBody,
    };
    return attestation;
}

class Response {
    headers;
    ok;
    redirected;
    status;
    statusText;
    type;
    url;
    #data;
    constructor(status, url, headers, data) {
        this.headers = headers;
        this.ok = status === 200;
        this.redirected = false;
        this.status = status;
        this.statusText = `${status}`;
        this.type = 'default';
        this.url = url;
        this.#data = data;
    }
    async json() {
        return new Promise((resolve, reject) => {
            try {
                const data = JSON.parse(this.#data);
                resolve(data);
            }
            catch (e) {
                reject(e);
            }
        });
    }
    async text() {
        return Promise.resolve(this.#data);
    }
}
async function fetch(backend, ip, path, init) {
    let data = '';
    const reqObj = {
        host: ip,
        path,
        servername: backend.address,
        port: backend.port,
        method: init.method,
        lookup: backend.resolve ? () => { } : undefined,
        headers: {
            ...init.headers,
            host: backend.address,
        },
    };
    return new Promise((resolve, reject) => {
        const headersDict = {};
        const handleResponse = (res) => {
            res.on('data', (d) => {
                data += d;
            });
            res.on('end', () => {
                // build headers dict
                Object.entries(res.headers).forEach(([header, headerValue]) => {
                    if (headerValue !== undefined) {
                        if (Array.isArray(headerValue)) {
                            headersDict[header] = headerValue.join(', ');
                        }
                        else {
                            headersDict[header] = headerValue;
                        }
                    }
                });
                resolve(new Response(res.statusCode || 0, getFullAddress(backend, path).url, headersDict, data));
            });
        };
        let req;
        if (backend.https) {
            req = https.request(reqObj, handleResponse);
        }
        else {
            req = http.request(reqObj, handleResponse);
        }
        req.on('error', (e) => reject(e));
        if (init.body) {
            req.write(init.body);
        }
        req.end();
    });
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
class OracleClient {
    #oracleBackends;
    #verifier;
    log;
    constructor(config) {
        if (config?.quiet ?? false) {
            this.log = () => { };
        }
        else {
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
            this.#oracleBackends = [conf.notarizer];
        }
        else {
            this.#oracleBackends = DEFAULT_NOTARIZATION_BACKENDS;
        }
        // sanitize oracle backend configs
        this.#oracleBackends = this.#oracleBackends.map((backend) => {
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
            this.#verifier = conf.verifier;
        }
        else {
            this.#verifier = DEFAULT_VERIFICATION_BACKEND;
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
    async notarize(req, options = DEFAULT_NOTARIZATION_OPTIONS) {
        const attestations = await this.createAttestation(req, { timeout: options.timeout, debug: false });
        this.log(`OracleClient: attested ${new URL(`https://${req.url}`).host} using ${this.#oracleBackends.length} attesters`);
        const numbAttestations = attestations.length;
        if (numbAttestations === 0 || numbAttestations !== this.#oracleBackends.length) {
            throw new AttestationIntegrityError('unexpected number of attestations', { cause: `expected ${this.#oracleBackends.length}, got ${numbAttestations}` });
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
                throw new AttestationIntegrityError('attestation timestamps deviate too much', { cause: { maxTimeDeviation: options.maxTimeDeviation, attestationTimestamps } });
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
    async testSelector(req, timeout) {
        return this.createAttestation(req, { timeout, debug: true });
    }
    /**
     * Requests information about enclaves that Notarization Backend is running in
     *
     * @throws {AttestationError | Error}
     */
    async enclavesInfo(options) {
        const API_ENDPOINT = '/info';
        let abortSignal;
        if (options?.timeout && options?.timeout > 0) {
            abortSignal = AbortSignal.timeout(options?.timeout);
        }
        // resolve backends to one or more IPs, then we send the request to all of the resolved IPs
        // and get the first response - this helps with availability and geographic load balancing.
        const resolvedBackends = await Promise.all(this.#oracleBackends.map(async (backend) => {
            const hostsAndUrls = await getOrResolveFullAddress(backend, API_ENDPOINT);
            return {
                backend,
                hostsAndUrls,
            };
        }));
        let responses;
        try {
            // each backend may be resolved to more than one IP, send a request to all of them,
            // for every backend wait for only one response to arrive.
            responses = await Promise.all(resolvedBackends.map(async (resolvedBackend) => {
                const fetchOptions = {
                    ...resolvedBackend.backend.init,
                    signal: abortSignal,
                    method: 'GET',
                    headers: {
                        ...resolvedBackend.backend.init.headers,
                        'Content-Type': 'application/json',
                    },
                };
                return Promise.any(resolvedBackend.hostsAndUrls.map(({ ip, path }) => fetch(resolvedBackend.backend, ip, path, fetchOptions)));
            }));
        }
        catch (e) {
            this.log('OracleClient: one or more info requests have failed, reason -', e);
            throw e;
        }
        const enclavesInfo = await Promise.all(responses.map((resp) => handleInfoResponse(resp)));
        return enclavesInfo;
    }
    /**
     * @throws {AttestationIntegrityError | Error}
     */
    async verifyReports(attestations, timeout) {
        const API_ENDPOINT = '/verify';
        const abortSignal = AbortSignal.timeout(timeout);
        // resolve backends to one or more IPs, then we send the request to all of the resolved IPs
        // and get the first response - this helps with availability and geographic load balancing.
        const resolvedUrls = await getOrResolveFullAddress(this.#verifier, API_ENDPOINT);
        const fetchOptions = {
            ...this.#verifier.init,
            signal: abortSignal,
            method: 'POST',
            headers: {
                ...this.#verifier.init.headers,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reports: attestations }),
        };
        let response;
        try {
            response = await Promise.any(resolvedUrls.map(({ ip, path }) => fetch(this.#verifier, ip, path, fetchOptions)));
        }
        catch (e) {
            this.log('OracleClient: verification request have failed, reason -', e);
            throw e;
        }
        if (response.status !== 200) {
            throw new AttestationIntegrityError(`verification failed: ${response.statusText}`);
        }
        let jsonBody;
        try {
            jsonBody = await response.json();
        }
        catch (e) {
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
    async createAttestation(req, options = { timeout: DEFAULT_TIMEOUT_MS, debug: false }) {
        const API_ENDPOINT = '/notarize';
        // construct oracle HTTP request body
        const attestReq = {
            ...req,
            requestHeaders: {
                ...DEFAULT_NOTARIZATION_HEADERS,
                ...(req.requestHeaders ?? {}),
            },
            debugRequest: options.debug,
        };
        let abortSignal;
        if (options?.timeout && options?.timeout > 0) {
            abortSignal = AbortSignal.timeout(options?.timeout);
        }
        // resolve backends to one or more IPs, then we send the request to all of the resolved IPs
        // and get the first response - this helps with availability and geographic load balancing.
        const resolvedBackends = await Promise.all(this.#oracleBackends.map(async (backend) => {
            const resolvedUrls = await getOrResolveFullAddress(backend, API_ENDPOINT);
            return {
                backend,
                ipAndUrl: resolvedUrls,
            };
        }));
        let responses;
        try {
            // each backend may be resolved to more than one IP, send a request to all of them,
            // for every backend wait for only one response to arrive.
            responses = await Promise.all(resolvedBackends.map(async (resolvedBackend) => {
                const fetchOptions = {
                    ...resolvedBackend.backend.init,
                    method: 'POST',
                    signal: abortSignal,
                    body: JSON.stringify(attestReq),
                    headers: {
                        ...resolvedBackend.backend.init.headers,
                        'Content-Type': 'application/json',
                    },
                };
                return Promise.any(resolvedBackend.ipAndUrl.map(({ ip, path }) => fetch(resolvedBackend.backend, ip, path, fetchOptions)));
            }));
        }
        catch (e) {
            this.log('OracleClient: one or more attestation requests have failed, reason -', e);
            throw e;
        }
        const attestations = await Promise.all(responses.map(async (resp) => handleAttestationResponse(options, resp)));
        return attestations;
    }
}

export { AttestationError, AttestationIntegrityError, DEFAULT_FETCH_OPTIONS, DEFAULT_NOTARIZATION_BACKENDS, DEFAULT_NOTARIZATION_HEADERS, DEFAULT_NOTARIZATION_OPTIONS, DEFAULT_TIMEOUT_MS, DEFAULT_VERIFICATION_BACKEND, DebugAttestationError, OracleClient };
//# sourceMappingURL=index.js.map
