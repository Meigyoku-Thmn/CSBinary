import { constants } from "../addon";
const {
  /** @internal */
  SEEK_CUR,
  /** @internal */
  SEEK_SET,
  /** @internal */
  SEEK_END
} = constants;

/** Specifies the position in a file to use for seeking. */
export enum SeekOrigin {
  /** Specifies the beginning of a file. */
  Begin = SEEK_SET,
  /** Specifies the current position of a file. */
  Current = SEEK_CUR,
  /** Specifies the end of a file. */
  End = SEEK_END,
}
