/**
 * Breadcrumb navigation stack.
 *
 * Every route the user visits (plus whatever overlay state was open at the
 * time) is recorded here, so a Back action can always return to the exact
 * previous screen *and* re-open the popup that was showing on it — even when
 * the browser history stack is unreliable (deep links, PWA cold starts).
 */
export interface NavEntry {
  path: string;
  state?: unknown;
}

const KEY = 'postup_nav_stack';
const MAX = 30;

const read = (): NavEntry[] => {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as NavEntry[]) : [];
  } catch {
    return [];
  }
};

const write = (stack: NavEntry[]) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-MAX)));
  } catch {
    // storage unavailable — breadcrumbs degrade to browser history
  }
};

export const pushNavEntry = (entry: NavEntry) => {
  const stack = read();
  const top = stack[stack.length - 1];
  if (top && top.path === entry.path) {
    // Same route, refreshed state (e.g. a popup opened) — update in place.
    stack[stack.length - 1] = entry;
  } else {
    stack.push(entry);
  }
  write(stack);
};

/** Removes the current entry and returns the one before it. */
export const popNavEntry = (): NavEntry | null => {
  const stack = read();
  if (stack.length < 2) return null;
  stack.pop();
  const previous = stack[stack.length - 1];
  write(stack);
  return previous ?? null;
};

export const peekPreviousEntry = (): NavEntry | null => {
  const stack = read();
  return stack.length >= 2 ? stack[stack.length - 2] : null;
};

export const clearNavHistory = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
};
