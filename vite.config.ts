import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

import { runPost } from './api/_lib/adapter';
import { saveCard, savePlayers, verifyPin } from './api/_lib/handlers';

/**
 * The real environment, captured before any .env file is merged in. A variable
 * exported in your shell keeps priority over the same name in a file, which is
 * how it behaves on Vercel.
 */
const shellEnv = { ...process.env };

/**
 * Reads .env then .env.local (later wins) directly.
 *
 * Vite's own loadEnv is deliberately not used here: it runs values through
 * dotenv-expand, which prefers whatever is already in process.env. Once a value
 * has been copied into process.env, re-reading returns the stale one forever —
 * so editing ENTRY_PIN made a correct PIN report as "Wrong PIN" until restart.
 * These are flat secrets with no interpolation, so a plain parse is both
 * sufficient and predictable.
 */
function readEnvFiles(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const file of ['.env', '.env.local']) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = /^\s*([\w.-]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (!match || line.trimStart().startsWith('#')) continue;
      let value = match[2] ?? '';
      const quoted =
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"));
      values[match[1]!] = quoted ? value.slice(1, -1) : value;
    }
  }
  return values;
}

/** Refreshes server-side vars from disk. Cheap, and always current. */
function refreshServerEnv(): void {
  for (const [key, value] of Object.entries(readEnvFiles())) {
    if (shellEnv[key] === undefined) process.env[key] = value;
  }
}

/**
 * `vite dev` doesn't know about Vercel's /api directory, so mount the same
 * handlers as middleware. Local dev and production therefore run identical
 * server-side logic — including the PIN check and the checksum.
 */
function localApi(): Plugin {
  const routes = {
    '/api/verify-pin': verifyPin,
    '/api/save-card': saveCard,
    '/api/save-players': savePlayers,
  } as const;

  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0];
        const handler = path ? routes[path as keyof typeof routes] : undefined;
        if (!handler) return next();

        // Per request, so editing .env.local never needs a dev server restart.
        refreshServerEnv();
        void runPost(req, res, handler);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
});
