import fse from 'fs-extra';
import { IFile, File as _File } from '../src/addon/file';
import fs from 'fs';
import { SeekOrigin } from '../src/constants/mode';
import path from 'path';

let File = _File;
export const TmpFilePath = path.join(__dirname, 'tmp/f.tmp');
fse.ensureDirSync(path.join(__dirname, 'tmp'));

const OriginalFile = File;
export function installHookToFile(fileArr: IFile[]): typeof File {
  return File = (class FileEx extends _File {
    constructor(fd: number) {
      super(fd);
      fileArr.push(this);
    }
    read(bytes: NodeJS.ArrayBufferView, offset?: number, count?: number): number {
      return super.read(bytes, offset, count);
    }
  }) as never;
}

export function removeHookFromFile(): void {
  File = OriginalFile;
}

export function openTruncated(): IFile {
  const fd = fs.openSync(TmpFilePath, 'w+');
  return new File(fd);
}

export function openTruncatedToRead(): IFile {
  fs.writeFileSync(TmpFilePath, '', { flag: 'w' });
  const fd = fs.openSync(TmpFilePath, 'r');
  return new File(fd);
}

export function openWithContent(content: Buffer): IFile {
  fs.writeFileSync(TmpFilePath, content, { flag: 'w' });
  const fd = fs.openSync(TmpFilePath, 'w+');
  return new File(fd);
}

export function openToReadWithContent(content: Buffer): IFile {
  fs.writeFileSync(TmpFilePath, content, { flag: 'w' });
  const fd = fs.openSync(TmpFilePath, 'r');
  return new File(fd);
}

export function getFileContent(file: IFile): Buffer {
  const lastPos = file.tell();
  file.seek(0, SeekOrigin.End);
  const size = file.tell();
  file.seek(0, SeekOrigin.Begin);
  const buf = Buffer.alloc(size);
  file.read(buf);
  file.seek(lastPos, SeekOrigin.Current);
  return buf;
}

/**
 * The maximum is exclusive and the minimum is inclusive
 */
export function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}