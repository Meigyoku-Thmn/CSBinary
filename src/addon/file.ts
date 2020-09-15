import { _File } from '.';
import { SeekOrigin } from '../constants/mode';

/**  */
export interface IFile {
  readonly fd: number;
  /** Closes the file associated with the stream and disassociates it. */
  close(): void;
  /**
   * Sets the position indicator associated with the stream to a new position.
   * @param offset Number of bytes to offset from origin.
   * @param origin Position used as reference for the offset.
   */
  seek(offset: number, origin: SeekOrigin): void;
  /** Returns the current value of the position indicator of the stream. */
  tell(): number;
  /**
   * Reads an array of count elements in bytes, from the stream and stores them in a buffer.
   * @param bytes A buffer to read data into.
   * @param offset The starting point in the buffer at which to begin reading into the buffer.
   * @param count The number of bytes to read.
   */
  read(bytes: NodeJS.ArrayBufferView, offset?: number, count?: number): number;
  /**
   * Writes an array of count elements in bytes, from the buffer to the current position in the stream.
   * @param bytes A byte array containing the data to write.
   * @param offset The index of the first byte to read from `buffer` and to write to the file.
   * @param count The number of bytes to read from `buffer` and to write to the file.
   */
  write(bytes: NodeJS.ArrayBufferView, offset?: number, count?: number): void;
  /**
   * Flush the stream. If the given stream was open for writing (or if it was open for updating and the last i/o operation was an output operation) any unwritten data in its output buffer is written to the file.
   */
  flush(): void;
  /**
   * Specify the size of the underlying buffer for file buffering. The default size is probably 4096 on most systems.
   * @param size Desired size of the underlying buffer. Use the value 0 to disable file buffering.
   */
  setBufSize(size: number): void;
  /**
   * Check if the stream is seekable.
   */
  readonly canSeek: boolean;
  /**
   * Check if the stream is in read mode.
   */
  readonly canRead: boolean;
  /**
   * Check if the stream is in write mode
   */
  readonly canWrite: boolean;
  /**
   * Check if the stream is in append mode.
   */
  readonly canAppend: boolean;
}

/** A thin wrapper of \<cstdio\>, implementing the IFile interface. It uses binary mode only. */
export const File = _File as (new (fd: number) => IFile) & ((fd: number) => IFile);
