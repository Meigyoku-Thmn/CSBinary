export class SubArray<T> {
  static from<T>(arr: T[], start = 0, end = arr.length): SubArray<T> {
    /* istanbul ignore if */
    if (!Array.isArray(arr)) throw TypeError('"arr" must be an array.');
    /* istanbul ignore if */
    if (!Number.isSafeInteger(start)) throw TypeError('"number" must be a safe integer.');
    /* istanbul ignore if */
    if (!Number.isSafeInteger(end)) throw TypeError('"end" must be a safe integer.');
    /* istanbul ignore if */
    if (start < 0)
      throw RangeError('"start" must be a non-negative number.');
    /* istanbul ignore if */
    if (start > arr.length)
      throw RangeError('"start" goes out-of-bound.');
    /* istanbul ignore if */
    if (start > end)
      throw RangeError('"start" must not be bigger than end.');
    /* istanbul ignore if */
    if (end > arr.length)
      throw RangeError('"end" goes out-of-bound.');

    return new SubArray(arr, start, end);
  }

  private constructor(private arr: T[], private start: number, private end: number) { }

  get(i: number) {
    return this.arr[i + this.start];
  }
  set(i: number, value: T) {
    return this.arr[i + this.start] = value;
  }
  /* istanbul ignore next */
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