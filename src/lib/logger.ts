/**
 * Debug logging that cannot reach a production user's console.
 *
 * `console.log` calls accumulated across the codebase — 28 of them, several
 * logging payloads (group membership, upload paths, auth events). They ran in
 * every user's browser, leaked internals, and cost time on hot paths like
 * opening a chat.
 *
 * `debug` is compiled out of production builds entirely: the `import.meta.env`
 * check is inlined by Vite, so the body becomes unreachable and the bundler
 * drops it. Warnings and errors stay visible — those are worth keeping.
 *
 * Usage:
 *   import { debug } from '@/lib/logger';
 *   debug('[useMessages] loaded', count);
 */
export const debug = (...args: unknown[]): void => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

export default debug;
