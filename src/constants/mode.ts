import { constants } from "../addon";
const { SEEK_CUR, SEEK_SET, SEEK_END } = constants;

export enum SeekOrigin {
  Begin = SEEK_SET,
  Current = SEEK_CUR,
  End = SEEK_END,
}
