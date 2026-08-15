import type { IncomingMessage, ServerResponse } from 'node:http';

import type { ApiResult } from './handlers';

/**
 * Shared plumbing between the Vercel handlers and the local dev middleware:
 * method check, body parsing, client identification, JSON response.
 */

export function clientId(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return first?.trim() || req.socket?.remoteAddress || 'unknown';
}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  // Vercel parses JSON bodies for us; the dev middleware does not.
  const parsed = (req as IncomingMessage & { body?: unknown }).body;
  if (parsed !== undefined && typeof parsed !== 'string') return parsed;

  const raw =
    typeof parsed === 'string'
      ? parsed
      : await new Promise<string>((resolve, reject) => {
          let data = '';
          req.on('data', (chunk) => {
            data += chunk;
            if (data.length > 64_000) reject(new Error('Body too large.'));
          });
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });

  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Body is not valid JSON.');
  }
}

export function sendJson(res: ServerResponse, result: ApiResult): void {
  res.statusCode = result.status;
  res.setHeader('content-type', 'application/json');
  // Nothing here should ever be cached.
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(result.body));
}

/** Runs a handler with method checking and uniform error handling. */
export async function runPost(
  req: IncomingMessage,
  res: ServerResponse,
  handler: (body: unknown, client: string) => Promise<ApiResult>,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    sendJson(res, { status: 405, body: { ok: false, error: 'Use POST.' } });
    return;
  }
  try {
    const body = await readJsonBody(req);
    sendJson(res, await handler(body, clientId(req)));
  } catch (error) {
    sendJson(res, { status: 400, body: { ok: false, error: (error as Error).message } });
  }
}
