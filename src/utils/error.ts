export function raise(error: Error, code?: string): Error {
  error['code'] = code;
  throw error;
}