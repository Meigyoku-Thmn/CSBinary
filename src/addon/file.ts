import { _File } from '.';
import { SeekOrigin } from '../constants/mode';

export interface IFile {
  readonly fd: number;
  close(): void;
  seek(offset: number, origin: SeekOrigin): void;
  tell(): number;
  read(bytes: NodeJS.ArrayBufferView, offset?: number, count?: number): number;
  write(bytes: NodeJS.ArrayBufferView, offset?: number, count?: number): void;
  flush(): void;
  setBufSize(size: number): void;
  readonly canSeek: boolean;
  readonly canRead: boolean;
  readonly canWrite: boolean;
  readonly canAppend: boolean;
}

export const File = _File as (new (fd: number) => IFile) & ((fd: number) => IFile);
