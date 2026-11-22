// In-memory access only. The browser's HttpOnly cookie owns durable login.
export function createSessionStore(load) {
  let value = null;
  let generation = 0;
  let pending = null;
  const listeners = new Set();
  const set = next => {generation++; value = next; listeners.forEach(fn => fn(next));};
  const restore = () => {
    if (pending) return pending;
    const version = generation;
    const request = Promise.resolve().then(load).then(next => {
      if (version !== generation) throw new Error('Session changed during refresh');
      value = next; listeners.forEach(fn => fn(next)); return next;
    }).finally(() => {if(pending === request) pending = null;});
    pending = request;
    return request;
  };
  return {get: () => value, set, restore, subscribe: fn => {listeners.add(fn); return () => listeners.delete(fn);}};
}
export function safeReturnPath(next) {
  return typeof next === 'string' && /^\/(account|cart|orders|parcels|groceries|admin)(\?|\/|$)/.test(next) && !next.includes('\\') ? next : '/account';
}
