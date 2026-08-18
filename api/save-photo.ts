import type { IncomingMessage, ServerResponse } from 'node:http';

// See the note in verify-pin.ts: .js specifiers are required under Node ESM.
import { runPost } from './_lib/adapter.js';
import { savePhoto } from './_lib/handlers.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await runPost(req, res, savePhoto);
}
