export function raise(error: Error, code?: string) {
  error['code'] = code;
  throw error;
}