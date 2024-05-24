import type { AttestationResponse, DebugRequestResponse, EnclaveInfo } from './types';
import type { Response } from './fetch';
export declare function handleInfoResponse(resp: Response): Promise<EnclaveInfo>;
export declare function handleAttestationResponse(options: {
    timeout?: number;
    debug: boolean;
}, resp: Response): Promise<DebugRequestResponse | AttestationResponse>;
