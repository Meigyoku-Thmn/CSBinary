import fs from 'fs';
import { seekSync, constants } from 'fs-ext'
const { SEEK_CUR } = constants;

export function readByte(fd: number): number {
  let oneByteArray = Buffer.alloc(1);
  let r = fs.readSync(fd, oneByteArray);
  if (r == 0)
    return -1;
  return oneByteArray.readUInt8(0);
}

export function tell(fd: number): number {
  return seekSync(fd, 0, SEEK_CUR);
}