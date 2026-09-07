/**
 * A Supabase client whose every read succeeds and returns nothing.
 *
 * That is this account's real state for the tables Today touches, and it is
 * the state the screen has to stay honest in. Test-only.
 */
type Builder = Record<string, unknown> & PromiseLike<{ data: null; error: null }>;

const result = { data: null, error: null };
const builder = new Proxy({} as Builder, {
  get(_target, property) {
    if (property === "then") {
      return (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
    }
    return () => builder;
  },
});

export const supabase = {
  from: () => builder,
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
  removeChannel: () => {},
};
