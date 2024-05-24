import { CustomBackendConfig } from './types';
export declare function resolve(hostname: string): Promise<string[]>;
export declare function trimPath(path: string): string;
type HostAndUrl = {
    host: string;
    url: string;
    path: string;
};
export declare function getFullAddress(info: CustomBackendConfig, path?: string): HostAndUrl;
type IpAndUrl = {
    ip: string;
    url: string;
    path: string;
};
export declare function getOrResolveFullAddress(info: CustomBackendConfig, path: string): Promise<IpAndUrl[]>;
export declare function trimUrl(url: string): string;
export {};
