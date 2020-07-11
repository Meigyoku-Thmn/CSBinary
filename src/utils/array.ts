export type SubArray<T> = {
  get: (i: number) => T,
  set: (i: number, value: string) => void,
  slice: (start: number, length?: number) => SubArray<T>,
  readonly length: number,
  readonly isEmpty: boolean,
};
export function subarray<T>(arr: Array<T>, start: number = 0, end: number = arr.length - start): SubArray<T> {
  if (!Array.isArray(arr))
    throw new Error('arr is not an array.');
  if (start < 0)
    throw new Error('start must be a non-negative number.');
  if (start > arr.length)
    throw new Error('start goes out-of-bound.');
  if (start > end)
    throw new Error('start must not be bigger than end.');
  if (end > arr.length)
    throw new Error('end goes out-of-bound.');
  
  return {
    get: (i: number) => arr[i + start],
    set: (i: number, value: any) => arr[i + start] = value,
    slice: (innerStart: number, length: number = 0) => subarray(arr, start + innerStart, start + innerStart + length),
    get length() {
      return end - start;
    },
    get isEmpty() {
      return 0 >= arr.length;
    }
  }
};