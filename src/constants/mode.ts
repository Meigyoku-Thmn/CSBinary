import { constants } from "../addon";
const {
  /** @internal */
  SEEK_CUR,
  /** @internal */
  SEEK_SET,
  /** @internal */
  SEEK_END
} = constants;

export enum SeekOrigin {
  Begin = SEEK_SET,
  Current = SEEK_CUR,
  End = SEEK_END,
}
