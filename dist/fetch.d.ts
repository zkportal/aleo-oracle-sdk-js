import type { CustomBackendConfig } from './types';
interface FetchResponse {
    text(): Promise<string>;
    json(): Promise<any>;
    readonly headers: Record<string, string>;
    readonly ok: boolean;
    readonly redirected: boolean;
    readonly status: number;
    readonly statusText: string;
    readonly type: ResponseType;
    readonly url: string;
}
export declare class Response implements FetchResponse {
    #private;
    readonly headers: Record<string, string>;
    readonly ok: boolean;
    readonly redirected: boolean;
    readonly status: number;
    readonly statusText: string;
    readonly type: ResponseType;
    readonly url: string;
    constructor(status: number, url: string, headers: Record<string, string>, data: string);
    json(): Promise<any>;
    text(): Promise<string>;
}
export default function fetch(backend: CustomBackendConfig, ip: string, path: string, init: RequestInit): Promise<Response>;
export {};
