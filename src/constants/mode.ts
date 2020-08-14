import { constants } from 'fs-ext'
const { SEEK_CUR, SEEK_SET, SEEK_END } = constants;

export enum SeekOrigin {
  Begin = SEEK_SET,
  Current = SEEK_CUR,
  End = SEEK_END,
}

export enum StringMode {
  CStr = 1,
  RawStr = 2,
}