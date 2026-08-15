import type { IncomingMessage, ServerResponse } from 'node:http';

// Explicit .js extensions: package.json sets "type": "module", and Node's ESM
// loader does not resolve extensionless relative imports. TypeScript maps the
// .js specifier back to the .ts source, so this is correct in both worlds.
import { runPost } from './_lib/adapter.js';
import { verifyPin } from './_lib/handlers.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await runPost(req, res, verifyPin);
}
