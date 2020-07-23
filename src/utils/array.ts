export class SubArray<T> {
  static from<T>(arr: T[], start = 0, end = arr.length): SubArray<T> {
    if (!Array.isArray(arr)) throw TypeError('"arr" must be an array.');
    if (!Number.isSafeInteger(start)) throw TypeError('"number" must be a safe integer.');
    if (!Number.isSafeInteger(end)) throw TypeError('"end" must be a safe integer.');
    if (start < 0)
      throw Error('"start" must be a non-negative number.');
    if (start > arr.length)
      throw Error('"start" goes out-of-bound.');
    if (start > end)
      throw Error('"start" must not be bigger than end.');
    if (end > arr.length)
      throw Error('"end" goes out-of-bound.');

    return new SubArray(arr, start, end);
  }

  private constructor(private arr: T[], private start: number, private end: number) { }

  get(i: number) {
    return this.arr[i + this.start];
  }
  set(i: number, value: T) {
    return this.arr[i + this.start] = value;
  }
  sub(start = 0, length = this.length - start) {
    return SubArray.from(this.arr, this.start + start, this.start + start + length);
  }
  get length() {
    return this.end - this.start;
  }
  get isEmpty() {
    return 0 >= this.length;
  }
};