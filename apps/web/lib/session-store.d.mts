export function createSessionStore<T>(load: () => Promise<T>): {
  get: () => T | null;
  set: (value: T | null) => void;
  restore: () => Promise<T>;
  subscribe: (fn: (value: T | null) => void) => () => void;
};
export function safeReturnPath(next: unknown): string;
