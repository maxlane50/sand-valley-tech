import type { IncomingMessage, ServerResponse } from 'node:http';

import { runPost } from './_lib/adapter';
import { verifyPin } from './_lib/handlers';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await runPost(req, res, verifyPin);
}
