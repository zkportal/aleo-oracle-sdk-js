import https from 'node:https';
import http from 'node:http';

import type { IncomingMessage, OutgoingHttpHeaders } from 'http';
import type { CustomBackendConfig } from './types';

import { getFullAddress } from './address';

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

export class Response implements FetchResponse {
  readonly headers: Record<string, string>;

  readonly ok: boolean;

  readonly redirected: boolean;

  readonly status: number;

  readonly statusText: string;

  readonly type: ResponseType;

  readonly url: string;

  readonly #data: string;

  constructor(status: number, url: string, headers: Record<string, string>, data: string) {
    this.headers = headers;
    this.ok = status === 200;
    this.redirected = false;
    this.status = status;
    this.statusText = `${status}`;
    this.type = 'default';
    this.url = url;
    this.#data = data;
  }

  async json(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const data: any = JSON.parse(this.#data);
        resolve(data);
      } catch (e) {
        reject(e);
      }
    });
  }

  async text(): Promise<string> {
    return Promise.resolve(this.#data);
  }
}

export default async function fetch(backend: CustomBackendConfig, ip: string, path: string, init: RequestInit): Promise<Response> {
  let data = '';

  const reqObj = {
    host: ip,
    path,
    servername: backend.address,
    port: backend.port,
    method: init.method,
    lookup: backend.resolve ? () => {} : undefined,
    headers: {
      ...init.headers,
      host: backend.address,
    } as OutgoingHttpHeaders,
  };

  return new Promise((resolve, reject) => {
    const headersDict: Record<string, string> = {};

    const handleResponse = (res: IncomingMessage) => {
      res.on('data', (d) => {
        data += d;
      });

      res.on('end', () => {
        // build headers dict
        Object.entries(res.headers).forEach(([header, headerValue]) => {
          if (headerValue !== undefined) {
            if (Array.isArray(headerValue)) {
              headersDict[header] = headerValue.join(', ');
            } else {
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
    } else {
      req = http.request(reqObj, handleResponse);
    }

    req.on('error', (e) => reject(e));

    if (init.body) {
      req.write(init.body);
    }

    req.end();
  });
}
