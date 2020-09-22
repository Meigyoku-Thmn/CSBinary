const HIGH_SURROGATE_START = '\ud800'.charCodeAt(0);
const LOW_SURROGATE_END = '\udfff'.charCodeAt(0);

export function isSurrogate(s: string): boolean {
  const c = s.charCodeAt(0);
  return (c >= HIGH_SURROGATE_START && c <= LOW_SURROGATE_END);
}