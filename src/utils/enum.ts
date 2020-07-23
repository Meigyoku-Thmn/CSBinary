export function enumize<K extends string>(...args: K[]): { [P in K]: P } {
  const ret = {} as { [P in K]: P };
  args.forEach(k => ret[k] = k);
  Object.freeze(ret);
  return ret;
}