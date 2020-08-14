import fs from 'fs';
import { seekSync, constants, fcntlSync } from 'fs-ext'
const { O_ACCMODE, O_WRONLY, O_RDWR } = constants as any;
import { getFdAccessMask, AccessMask } from '../addon';
import { SeekOrigin } from '../constants/mode';

const poxisPlatforms = new Set<typeof process.platform>([
  'aix', 'android', 'cygwin', 'darwin', 'freebsd', 'linux', 'netbsd', 'openbsd', 'sunos']);
const isPosix = poxisPlatforms.has(process.platform);
const isWin32 = process.platform == 'win32';

export function readByte(fd: number): number {
  let oneByteArray = Buffer.allocUnsafe(1);
  let r = fs.readSync(fd, oneByteArray, 0, oneByteArray.length, null);
  if (r == 0)
    return -1;
  return oneByteArray[0];
}

export function writeByte(fd: number, value: number): void {
  let oneByteArray = Buffer.allocUnsafe(1);
  oneByteArray.writeUInt8(value);
  fs.writeSync(fd, oneByteArray, 0, 1);
}

export function tell(fd: number): number {
  return seekSync(fd, 0, SeekOrigin.Current);
}

export function canSeek(fd: number): boolean {
  try {
    tell(fd);
    return true;
  } catch (err) {
    if (err.code == 'EBADF')
      throw err;
    return false;
  }
}

export function canWrite(fd: number): boolean {
  if (isPosix) {
    const accessMode = fcntlSync(fd, 'getfl' as any) & O_ACCMODE;
    return (accessMode == O_WRONLY || accessMode == O_RDWR);
  }
  else if (isWin32) {
    const mask = getFdAccessMask(fd);
    return (mask & AccessMask.FILE_WRITE_DATA) != 0;
  }
  else
    throw Error("Unable to check if the file can be write or not on your system.");
}

// only write flag makes sense, besides, read flag causes fs crashes on my computer every time
export function openNullDevice(): number {
  if (isPosix)
    return fs.openSync('/dev/null', 'w');
  else if (isWin32)
    return fs.openSync('//./nul', 'w');
  else
    throw Error("I don't know how to open a null device on your system.");
}

export async function flushAsync(fd: number) {
  await new Promise((resolve, reject) => fs.fdatasync(fd, err => err ? reject(err) : resolve()));
}

export async function closeAsync(fd: number) {
  await new Promise((resolve, reject) => fs.close(fd, err => err ? reject(err) : resolve()));
}