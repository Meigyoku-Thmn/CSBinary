import fs from 'fs';
import { IFile, File } from '../addon/file';

const poxisPlatforms = new Set<typeof process.platform>([
  'aix', 'android', 'cygwin', 'darwin', 'freebsd', 'linux', 'netbsd', 'openbsd', 'sunos']);
const isPosix = poxisPlatforms.has(process.platform);
const isWin32 = process.platform == 'win32';

export function readByte(file: IFile): number {
  const oneByteArray = Buffer.allocUnsafe(1);
  const r = file.read(oneByteArray);
  if (r == 0)
    return -1;
  return oneByteArray[0];
}

export function writeByte(file: IFile, value: number): void {
  const oneByteArray = Buffer.allocUnsafe(1);
  oneByteArray.writeUInt8(value);
  file.write(oneByteArray);
}

// only write flag makes sense, besides, read flag causes fs crashes on my computer every time
export function openNullDevice(): IFile {
  let fd: number;
  if (isPosix)
    fd = fs.openSync('/dev/null', 'w');
  else if (isWin32)
    fd = fs.openSync('//./nul', 'w');
  else
    throw Error('I don\'t know how to open a null device on your system.');
  return new File(fd);
}
