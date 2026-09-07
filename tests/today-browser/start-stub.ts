/**
 * Stands in for the TanStack Start runtime, which only exists inside a running
 * server. Every builder call returns the same chainable stand-in. Test-only.
 */
type Chain = ((...args: unknown[]) => Chain) & Record<string, unknown>;

const chain = new Proxy((() => chain) as unknown as Chain, {
  get: () => chain,
  apply: () => chain,
});

export const useServerFn = (fn: unknown) => fn;
export const createServerFn = () => chain;
export const createMiddleware = () => chain;
export const createIsomorphicFn = () => chain;
export const serverOnly = (fn: unknown) => fn;
export const clientOnly = (fn: unknown) => fn;
export const getRequest = () => new Request("http://localhost/");
export const getWebRequest = () => new Request("http://localhost/");
export const getRequestHeaders = () => ({});
export const setResponseStatus = () => {};
