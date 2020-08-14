import { constants } from 'fs-ext'
export const { SEEK_CUR, SEEK_SET, SEEK_END } = constants;

export enum StringMode {
  CStr = 1,
  RawStr = 2,
}