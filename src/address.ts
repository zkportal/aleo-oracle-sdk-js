import dns from 'node:dns';
import net from 'node:net';

import { CustomBackendConfig } from './types';

export async function resolve(hostname: string): Promise<string[]> {
  const { resolve4 } = dns.promises;
  return resolve4(hostname);
}

export function trimPath(path: string): string {
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

type HostAndUrl = { host: string; url: string; path: string };

// Builds a URL based on the backend config and the desired resource path
export function getFullAddress(info: CustomBackendConfig, path: string = ''): HostAndUrl {
  const scheme = info.https ? 'https://' : 'http://';

  const trimmedPath = trimPath(path);
  return {
    host: `${info.address}:${info.port}`,
    url: `${scheme}${info.address}:${info.port}${info.apiPrefix}${trimmedPath}`,
    path: `${info.apiPrefix}${trimmedPath}`,
  };
}

export type IpAndUrl = { ip: string; url: string; path: string };

// Builds a URL based on the backend config and the desired resource path. If the address is not an IP, and
// the backend config enables resolving, then this function tries to resolve the address to an IP, then builds
// the full URLs using all of the resolved IPs.
export async function getOrResolveFullAddress(info: CustomBackendConfig, path: string): Promise<IpAndUrl[]> {
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

export function trimUrl(url: string) {
  let trimmedUrl = url.trim();

  // delete trailing slashes
  while (trimmedUrl.endsWith('/')) {
    trimmedUrl = trimmedUrl.slice(0, -1);
  }

  return trimmedUrl;
}
