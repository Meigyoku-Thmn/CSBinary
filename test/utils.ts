let { File } = require('../src/addon/file');
import fse from 'fs-extra';
import { IFile } from '../src/addon/file';
import fs from 'fs';
import { SeekOrigin } from '../src/constants/mode';
import path from 'path';

const TmpFilePath = 'tmp/f.tmp';
fse.ensureDirSync(path.join(__dirname, 'tmp'));

const OriginalFile = File;
export function installHookToFile(fileArr: IFile[]) {
  return File = class FileEx extends File {
    constructor(fd: number) {
      super(fd);
      fileArr.push(this as any);
    }
  };
}

export function removeHookFromFile() {
  File = OriginalFile;
}

export function openTruncated(): IFile {
  const fd = fs.openSync(path.join(__dirname, TmpFilePath), 'w+');
  return new File(fd);
}

export function openTruncatedToRead(): IFile {
  fs.writeFileSync(path.join(__dirname, TmpFilePath), '', { flag: 'w' });
  const fd = fs.openSync(path.join(__dirname, TmpFilePath), 'r');
  return new File(fd);
}

export function openWithContent(content: Buffer) {
  fs.writeFileSync(path.join(__dirname, TmpFilePath), content, { flag: 'w' });
  const fd = fs.openSync(path.join(__dirname, TmpFilePath), 'w+');
  return new File(fd);
}

export function openToReadWithContent(content: Buffer) {
  fs.writeFileSync(path.join(__dirname, TmpFilePath), content, { flag: 'w' });
  const fd = fs.openSync(path.join(__dirname, TmpFilePath), 'r');
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
export function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}