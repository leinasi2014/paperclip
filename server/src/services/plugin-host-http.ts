import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

export const PLUGIN_FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

type ResolvedTarget = {
  url: URL;
  address: string;
  family: 4 | 6;
};

function isPrivateAddress(address: string): boolean {
  if (net.isIP(address) === 4) {
    const parts = address.split(".").map((part) => Number(part));
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  if (net.isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::1"
      || normalized === "::"
      || normalized.startsWith("fe80:")
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
    );
  }

  return true;
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers.map(([key, value]) => [key, String(value)]));
  }
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value)]),
  );
}

function toBodyBuffer(body?: BodyInit | null): Buffer | undefined {
  if (body == null) return undefined;
  if (typeof body === "string") return Buffer.from(body);
  if (body instanceof URLSearchParams) return Buffer.from(body.toString());
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  if (body instanceof Blob) {
    throw new Error("Blob request bodies are not supported for plugin fetch requests");
  }
  if (body instanceof FormData) {
    throw new Error("FormData request bodies are not supported for plugin fetch requests");
  }
  throw new Error("Unsupported request body type for plugin fetch requests");
}

async function resolvePublicTarget(rawUrl: string): Promise<ResolvedTarget> {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed for plugin fetch requests");
  }
  if (!url.hostname) {
    throw new Error("URL hostname is required");
  }

  const literalIpFamily = net.isIP(url.hostname);
  if (literalIpFamily) {
    if (isPrivateAddress(url.hostname)) {
      throw new Error("Plugin fetch target resolves to a private or loopback address");
    }
    return { url, address: url.hostname, family: literalIpFamily as 4 | 6 };
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost") {
    throw new Error("Plugin fetch target resolves to a private or loopback address");
  }

  const resolved = await dns.lookup(hostname, { all: true, verbatim: true });
  const publicEntry = resolved.find((entry) => !isPrivateAddress(entry.address));
  if (!publicEntry || resolved.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("Plugin fetch target resolves to a private or loopback address");
  }

  return {
    url,
    address: publicEntry.address,
    family: publicEntry.family as 4 | 6,
  };
}

async function requestOnce(
  target: ResolvedTarget,
  init?: RequestInit,
  signal?: AbortSignal,
): Promise<{ status: number; statusText: string; headers: Record<string, string>; body: string; location: string | null }> {
  const transport = target.url.protocol === "https:" ? https : http;
  const body = toBodyBuffer(init?.body as BodyInit | null | undefined);
  const headers = normalizeHeaders(init?.headers);
  const requestHeaders: Record<string, string> = {
    ...headers,
    host: target.url.host,
  };
  if (body && !Object.keys(requestHeaders).some((key) => key.toLowerCase() === "content-length")) {
    requestHeaders["content-length"] = String(body.byteLength);
  }

  return new Promise((resolve, reject) => {
    const request = transport.request(
      {
        protocol: target.url.protocol,
        hostname: target.address,
        family: target.family,
        port: target.url.port ? Number(target.url.port) : undefined,
        path: `${target.url.pathname}${target.url.search}`,
        method: init?.method ?? "GET",
        headers: requestHeaders,
        servername: net.isIP(target.url.hostname) ? undefined : target.url.hostname,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          const responseHeaders: Record<string, string> = {};
          Object.entries(response.headers).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              responseHeaders[key] = value.join(", ");
            } else if (value != null) {
              responseHeaders[key] = String(value);
            }
          });
          resolve({
            status: response.statusCode ?? 0,
            statusText: response.statusMessage ?? "",
            headers: responseHeaders,
            body: Buffer.concat(chunks).toString("utf8"),
            location: typeof response.headers.location === "string" ? response.headers.location : null,
          });
        });
      },
    );

    const abortListener = () => {
      request.destroy(new Error("Plugin fetch request aborted"));
    };
    signal?.addEventListener("abort", abortListener, { once: true });

    request.on("error", (error) => {
      signal?.removeEventListener("abort", abortListener);
      reject(error);
    });
    request.on("close", () => {
      signal?.removeEventListener("abort", abortListener);
    });

    if (body) {
      request.write(body);
    }
    request.end();
  });
}

export async function validateAndResolveFetchUrl(rawUrl: string): Promise<ResolvedTarget> {
  return resolvePublicTarget(rawUrl);
}

export async function executePinnedHttpRequest(
  target: ResolvedTarget,
  init?: RequestInit,
  signal?: AbortSignal,
): Promise<{ status: number; statusText: string; headers: Record<string, string>; body: string }> {
  let currentTarget = target;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await requestOnce(currentTarget, init, signal);
    if (
      response.location
      && [301, 302, 303, 307, 308].includes(response.status)
      && redirects < MAX_REDIRECTS
    ) {
      currentTarget = await resolvePublicTarget(new URL(response.location, currentTarget.url).href);
      continue;
    }
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: response.body,
    };
  }

  throw new Error("Plugin fetch request exceeded the maximum redirect limit");
}
