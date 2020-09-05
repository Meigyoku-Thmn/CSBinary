import { readByte } from './utils/file'
import { SubArray } from './utils/array';
import { raise } from './utils/error';
import { CSCode } from './constants/error';
import { IEncoding, Encoding, IDecoder } from './encoding';
import { SeekOrigin } from './constants/mode';
import { BIG_0, BIG_7Fh, LONG_MAX, LONG_WRAP } from './constants/number';
import { IFile } from './addon/file';

type char = string;

/**@internal */
const MaxCharBytesSize = 128;
/**@internal */
const BufferSize = 16;
/**
 * Reads primitive data types as binary values in a specific encoding.
 */
export class BinaryReader {
  private readonly _file: IFile;
  private readonly _decoder: IDecoder;

  // Performance optimization for Read() w/ Unicode. Speeds us up by ~40%
  private readonly _2BytesPerChar: boolean = false;
  private readonly _leaveOpen: boolean = false;
  private _disposed = false;

  // use for peekChar
  private _nReadBytes = 0;

  /**
   * Initializes a new instance of the BinaryReader class based on the specified file descriptor and character encoding, and optionally leaves the file open.
   * @param input The input file descriptor.
   * @param encoding The character encoding to use, or an object implementing the IEncoding interface. Default to `'utf8'`
   * @param leaveOpen `true` to leave the file open after the BinaryReader object is disposed; otherwise, `false`. Default to `false`.
   */
  constructor(input: IFile, encoding: BufferEncoding | string | IEncoding = 'utf8', leaveOpen = false) {
    if (input == null || typeof input != 'object')
      throw TypeError('"input" must be an object that implement the IFile interface.');
    if (typeof leaveOpen != 'boolean') throw TypeError('"leaveOpen" must be a boolean.');

    if (!input.canRead)
      raise(ReferenceError('Input file is not readable.'), CSCode.FileNotReadable);

    this._file = input;
    if (typeof encoding == 'string')
      this._decoder = new Encoding(encoding).getDecoder();
    else if (encoding != null && typeof encoding == 'object')
      this._decoder = (encoding as IEncoding).getDecoder();
    else
      throw TypeError('"encoding" must be a string or an instance that implements IEncoding.');

    // For Encodings that always use 2 bytes per char (or more),
    // special case them here to make Read() & Peek() faster.
    this._2BytesPerChar = encoding == 'utf16le' || encoding == 'ucs2' || encoding == 'ucs-2';
    this._leaveOpen = leaveOpen;

  }

  /**
   * Get the underlying file descriptor of the BinaryReader.
   */
  get file(): IFile {
    return this._file;
  }

  /**
   * Closes the current reader and the underlying file.
   */
  close(): void {
    if (!this._disposed) {
      if (!this._leaveOpen) {
        this._file.close();
      }
      this._disposed = true;
    }
  }

  private throwIfDisposed(): void {
    if (this._disposed) {
      raise(ReferenceError('This BinaryReader instance is closed.'), CSCode.FileIsClosed);
    }
  }

  /**
   * Returns the next available character and does not advance the byte or character position.
   * @returns The next available character, or -1 if no more characters are available or the file does not support seeking.
   */
  peekChar(): number {
    this.throwIfDisposed();

    if (!this._file.canSeek) {
      return -1;
    }

    let ch = this.readCharCode();
    this._file.seek(-this._nReadBytes, SeekOrigin.Current);
    return ch;
  }

  /**
   * Reads characters from the underlying file and advances the current position of the file in accordance with the `Encoding` used and the specific character being read from the file.
   * @returns The next character from the input file, or -1 if no characters are currently available.
   */
  readCharCode(): number {
    this.throwIfDisposed();
    this._nReadBytes = 0;

    let numBytes: number;

    let _charBytes = Buffer.allocUnsafe(2);

    // there isn't any decoder in JS world that can reuse output buffer
    let singleChar = '';

    while (singleChar.length == 0) {
      // We really want to know what the minimum number of bytes per char
      // is for our encoding. Otherwise for UnicodeEncoding we'd have to
      // do ~1+log(n) reads to read n characters.
      // Assume 1 byte can be 1 char unless _2BytesPerChar is true.
      numBytes = this._2BytesPerChar ? 2 : 1;

      let r = readByte(this._file);
      _charBytes.writeUInt8(r < 0 ? r + 256 : r);
      if (r == -1) {
        numBytes = 0;
      } else {
        this._nReadBytes++;
      }
      if (numBytes == 2) {
        r = readByte(this._file);
        _charBytes.writeUInt8(r < 0 ? r + 256 : r, 1);
        if (r == -1) {
          numBytes = 1;
        } else {
          this._nReadBytes++;
        }
      }

      if (numBytes == 0) {
        return -1;
      }

      try {
        singleChar = this._decoder.write(_charBytes.subarray(0, numBytes));
        if (singleChar.length > 1)
          raise(Error("BinaryReader hit a surrogate char in the read method."), CSCode.SurrogateCharHit);
      }
      catch (err) {
        // Handle surrogate char

        if (err.code == CSCode.SurrogateCharHit && this._file.canSeek) {
          this._file.seek(-this._nReadBytes, SeekOrigin.Current);
        }
        // else - we can't do much here

        throw err;
      }
    }
    return singleChar.charCodeAt(0);
  }

  /**
   * Reads the next byte from the current file and advances the current position of the file by one byte.
   * @returns The next byte read from the current file.
   */
  readByte(): number {
    return this.internalReadByte();
  }

  private internalReadByte(): number {
    this.throwIfDisposed();

    let b = readByte(this._file);
    if (b == -1) {
      raise(RangeError('Read beyond end-of-file.'), CSCode.ReadBeyondEndOfFile);
    }

    return b;
  }

  /**
   * Reads a signed byte from this file and advances the current position of the file by one byte.
   * @returns A signed byte read from the current file.
   */
  readSByte(): number {
    let rs = this.internalReadByte();
    return rs > 127 ? rs - 256 : rs;
  }

  /**
   * Reads a `boolean` value from the current file and advances the current position of the file by one byte.
   * @returns `true` if the byte is nonzero; otherwise, `false`.
   */
  readBoolean(): boolean {
    return this.internalReadByte() != 0;
  }

  /**
   * Reads the next character from the current file and advances the current position of the file in accordance with the `Encoding` used and the specific character being read from the file.
   * @returns A character read from the current file.
   */
  readChar(): char {
    let value = this.readCharCode();
    if (value == -1) {
      raise(RangeError('Read beyond end-of-file.'), CSCode.ReadBeyondEndOfFile);
    }
    return String.fromCharCode(value);
  }

  /**
   * Reads a 2-byte signed integer from the current file and advances the current position of the file by two bytes.
   * @returns A 2-byte signed integer read from the current file.
   */
  readInt16(): number {
    return this.internalRead(2).readInt16LE();
  }
  /**
   * Reads a 2-byte unsigned integer from the current file using little-endian encoding and advances the position of the file by two bytes.
   * @returns A 2-byte unsigned integer read from this file.
   */
  readUInt16(): number {
    return this.internalRead(2).readUInt16LE();
  }

  /**
   * Reads a 4-byte signed integer from the current file and advances the current position of the file by four bytes.
   * @returns A 4-byte signed integer read from the current file.
   */
  readInt32(): number {
    return this.internalRead(4).readInt32LE();
  }

  /**
   * Reads a 4-byte unsigned integer from the current file and advances the position of the file by four bytes.
   * @returns A 4-byte unsigned integer read from this file.
   */
  readUInt32(): number {
    return this.internalRead(4).readUInt32LE();
  }

  /**
   * Reads an 8-byte signed integer from the current file and advances the current position of the file by eight bytes.
   * @returns An 8-byte signed integer read from the current file.
   */
  readInt64(): bigint {
    return this.internalRead(8).readBigInt64LE();
  }

  /**
   * Reads an 8-byte unsigned integer from the current file and advances the position of the file by eight bytes.
   * @returns An 8-byte unsigned integer read from this file.
   */
  readUInt64(): bigint {
    return this.internalRead(8).readBigUInt64LE();
  }

  /**
   * Reads a 4-byte floating point value from the current file and advances the current position of the file by four bytes.
   * @returns A 4-byte floating point value read from the current file.
   */
  readSingle(): number {
    return this.internalRead(4).readFloatLE();
  }

  /**
   * Reads an 8-byte floating point value from the current file and advances the current position of the file by eight bytes.
   * @returns An 8-byte floating point value read from the current file.
   */
  readDouble(): number {
    return this.internalRead(8).readDoubleLE();
  }

  /**
   * Reads a string from the current file. The string is prefixed with the length, encoded as an integer seven bits at a time.
   * @returns The string being read.
   */
  readString(): string {
    this.throwIfDisposed();

    // Length of the string in bytes, not chars
    let stringLength = this.read7BitEncodedInt();
    return this.internalReadString(stringLength);
  }

  readRawString(length: number): string {
    this.throwIfDisposed();

    return this.internalReadString(length);
  }

  private internalReadString(stringLength: number): string {
    if (stringLength < 0) {
      raise(RangeError(`Invalid string\'s length: ${stringLength}.`), CSCode.InvalidEncodedStringLength);
    }

    if (stringLength == 0) {
      return '';
    }

    let currPos = 0;
    let n: number;
    let readLength: number;
    let _charBytes = Buffer.allocUnsafe(MaxCharBytesSize);

    let sb = '';
    do {
      readLength = ((stringLength - currPos) > MaxCharBytesSize) ? MaxCharBytesSize : (stringLength - currPos);

      n = this._file.read(_charBytes, 0, readLength);
      if (n == 0) {
        raise(RangeError('Read beyond end-of-file.'), CSCode.ReadBeyondEndOfFile);
      }

      let strRead = this._decoder.write(_charBytes.subarray(0, n))

      if (currPos == 0 && n == stringLength) {
        return strRead;
      }

      sb += strRead;
      currPos += n;
    } while (currPos < stringLength);

    return sb;
  }

  /**
   * Reads the specified number of characters from the file, starting from a specified point in the character array.
   * @param buffer The buffer to read data into.
   * @param index The starting point in the buffer at which to begin reading into the buffer.
   * @param count The number of characters to read.
   * @returns The total number of characters read into the buffer. This might be less than the number of characters requested if that many characters are not currently available, or it might be zero if the end of the file is reached.
   */
  readIntoCharsEx(buffer: char[], index: number, count: number): number {
    if (!Array.isArray(buffer)) throw TypeError('"buffer" must be a character array.');
    if (!Number.isSafeInteger(index)) throw TypeError('"index" must be a safe integer.');
    if (!Number.isSafeInteger(count)) throw TypeError('"count" must be a safe integer.');
    if (index < 0)
      throw RangeError('"index" need to be a non-negative number.');
    if (count < 0)
      throw RangeError('"count" need to be a non-negative number.');
    if (buffer.length - index < count)
      throw RangeError('This will read into out of buffer.');
    this.throwIfDisposed();
    return this.internalReadChars(SubArray.from(buffer, index, index + count));
  }

  /**
   * Reads, from the current file, the same number of characters as the length of the provided buffer, writes them in the provided buffer, and advances the current position in accordance with the `Encoding` used and the specific character being read from the file.
   * @param buffer A view of characters. When this method returns, the contents of this region are replaced by the characters read from the current source.
   * @returns The total number of characters read into the buffer. This might be less than the number of characters requested if that many characters are not currently available, or it might be zero if the end of the file is reached.
   */
  readIntoChars(buffer: char[]): number {
    if (!Array.isArray(buffer)) throw TypeError('"buffer" must be a character array.');
    this.throwIfDisposed();
    return this.internalReadChars(SubArray.from(buffer));
  }

  private internalReadChars(buffer: SubArray<char>): number {
    let totalCharsRead = 0;

    while (!buffer.isEmpty) {
      let numBytes = buffer.length;

      // We really want to know what the minimum number of bytes per char
      // is for our encoding. Otherwise for UnicodeEncoding we'd have to
      // do ~1+log(n) reads to read n characters.
      if (this._2BytesPerChar) {
        numBytes = numBytes << 1 >>> 0;
      }

      // We do not want to read even a single byte more than necessary.
      //
      // Subtract pending bytes that the decoder may be holding onto. This assumes that each
      // decoded char corresponds to one or more bytes. Note that custom encodings or encodings with
      // a custom replacement sequence may violate this assumption.
      if (numBytes > 1) {
        // Check whether the decoder has any pending state.
        if (this._decoder.hasState) {
          numBytes--;

          // The worst case is charsRemaining = 2 and UTF32Decoder holding onto 3 pending bytes. We need to read just
          // one byte in this case.
          if (this._2BytesPerChar && numBytes > 2)
            numBytes -= 2;
        }
      }

      let _charBytes = Buffer.allocUnsafe(MaxCharBytesSize);

      if (numBytes > MaxCharBytesSize) {
        numBytes = MaxCharBytesSize;
      }
      numBytes = this._file.read(_charBytes, 0, numBytes);
      let byteBuffer = _charBytes.subarray(0, numBytes);

      if (byteBuffer.length == 0) {
        break;
      }

      let strRead = this._decoder.write(byteBuffer);
      for (let i = 0; i < strRead.length; i++)
        buffer.set(i, strRead[i]);
      buffer = buffer.sub(strRead.length);

      totalCharsRead += strRead.length;
    }

    // we may have read fewer than the number of characters requested if end of file reached
    // or if the encoding makes the char count too big for the buffer (e.g. fallback sequence)
    return totalCharsRead;
  }

  /**
   * Reads the specified number of characters from the current file, returns the data in a character array, and advances the current position in accordance with the `Encoding` used and the specific character being read from the file.
   * @param count The number of characters to read.
   * @returns A character array containing data read from the underlying file. This might be less than the number of characters requested if the end of the file is reached.
   */
  readChars(count: number): char[] {
    if (!Number.isSafeInteger(count)) throw TypeError('"count" must be a safe integer.');
    if (count < 0)
      throw RangeError('"count" must be a non-negative value.');
    this.throwIfDisposed();

    if (count == 0) {
      return [];
    }

    let chars = new Array<char>(count);
    let n = this.internalReadChars(SubArray.from(chars));
    if (n != count) {
      chars = chars.slice(0, n);
    }

    return chars;
  }

  /**
   * Reads the specified number of bytes from the file, starting from a specified point in the buffer.
   * @param buffer The buffer to read data into.
   * @param index The starting point in the buffer at which to begin reading into the buffer.
   * @param count The number of bytes to read.
   * @returns The number of bytes read into buffer. This might be less than the number of bytes requested if that many bytes are not available, or it might be zero if the end of the file is reached.
   */
  readIntoBufferEx(buffer: Buffer, index: number, count: number): number {
    if (!Buffer.isBuffer(buffer)) throw TypeError('"buffer" must be a Buffer.');
    if (!Number.isSafeInteger(index)) throw TypeError('"index" must be a safe integer.');
    if (!Number.isSafeInteger(count)) throw TypeError('"count" must be a safe integer.');
    if (index < 0) {
      throw RangeError('"index" must be a non-negative number.');
    }
    if (count < 0) {
      throw RangeError('"count" must be a non-negative number.');
    }
    if (buffer.length - index < count) {
      throw RangeError('This will read into out of buffer.');
    }
    this.throwIfDisposed();

    return this._file.read(buffer, index, count);
  }

  /**
   * Reads a sequence of bytes from the current file and advances the position within the file by the number of bytes read.
   * @param buffer A region of memory. When this method returns, the contents of this region are replaced by the bytes read from the current source.
   * @returns The total number of bytes read into the buffer. This can be less than the number of bytes allocated in the buffer if that many bytes are not currently available, or zero (0) if the end of the file has been reached.
   */
  readIntoBuffer(buffer: Buffer): number {
    if (!Buffer.isBuffer(buffer)) throw TypeError('"buffer" must be a Buffer.');
    this.throwIfDisposed();
    return this._file.read(buffer);
  }

  /**
   * Reads the specified number of bytes from the current file into a buffer and advances the current position by that number of bytes.
   * @param count The number of bytes to read. This value must be 0 or a non-negative number or an exception will occur.
   * @returns A buffer containing data read from the underlying file. This might be less than the number of bytes requested if the end of the file is reached.
   */
  readBytes(count: number): Buffer {
    if (!Number.isSafeInteger(count)) throw TypeError('"count" must be a safe integer.');
    if (count < 0) {
      throw RangeError('"count" must be a non-negative number.');
    }
    this.throwIfDisposed();

    if (count == 0) {
      return Buffer.allocUnsafe(0);
    }

    let result = Buffer.allocUnsafe(count);
    let numRead = 0;
    do {
      let n = this._file.read(result, numRead, count);
      if (n == 0) {
        break;
      }

      numRead += n;
      count -= n;
    } while (count > 0);

    if (numRead != result.length) {
      // Trim array. This should happen on EOF & possibly net streams.
      result = result.subarray(0, numRead);
    }

    return result;
  }

  private internalRead(numBytes: number): Buffer {
    this.throwIfDisposed();

    let buffer = Buffer.allocUnsafe(BufferSize);
    let bytesRead = 0;
    do {
      let n = this._file.read(buffer, bytesRead, numBytes - bytesRead);
      if (n == 0) {
        raise(RangeError('Read beyond end-of-file.'), CSCode.ReadBeyondEndOfFile);
      }
      bytesRead += n;
    } while (bytesRead < numBytes);

    return buffer;
  }

  /**
   * Reads in a 32-bit integer in compressed format.
   * @returns A 32-bit integer in compressed format.
   */
  read7BitEncodedInt(): number {
    // Unlike writing, we can't delegate to the 64-bit read on
    // 64-bit platforms. The reason for this is that we want to
    // stop consuming bytes if we encounter an integer overflow.

    let result = 0;
    let byteReadJustNow: number;

    // Read the integer 7 bits at a time. The high bit
    // of the byte when on means to continue reading more bytes.
    //
    // There are two failure cases: we've read more than 5 bytes,
    // or the fifth byte is about to cause integer overflow.
    // This means that we can read the first 4 bytes without
    // worrying about integer overflow.

    // bitwise OR operation's result is always signed, so there is no need to manually cast to signed number

    const MaxBytesWithoutOverflow = 4;
    for (let shift = 0; shift < MaxBytesWithoutOverflow * 7; shift += 7) { // TODO: check 
      // ReadByte handles end of file cases for us.
      byteReadJustNow = this.readByte();
      result |= (byteReadJustNow & 0x7F) << shift >>> 0;

      if (byteReadJustNow <= 0x7F) {
        return result; // early exit
      }
    }

    // Read the 5th byte. Since we already read 28 bits,
    // the value of this byte must fit within 4 bits (32 - 28),
    // and it must not have the high bit set.

    byteReadJustNow = this.readByte();
    if (byteReadJustNow > 0b1111) {
      raise(TypeError('Bad 7 bit encoded number in file.'), CSCode.BadEncodedIntFormat);
    }

    result |= byteReadJustNow << (MaxBytesWithoutOverflow * 7) >>> 0;
    return result;
  }

  /**
   * Reads in a 64-bit integer in compressed format.
   * @returns A 64-bit integer in compressed format.
   */
  read7BitEncodedInt64(): bigint {
    let result = BIG_0;
    let byteReadJustNow: number;

    // Read the integer 7 bits at a time. The high bit
    // of the byte when on means to continue reading more bytes.
    //
    // There are two failure cases: we've read more than 10 bytes,
    // or the tenth byte is about to cause integer overflow.
    // This means that we can read the first 9 bytes without
    // worrying about integer overflow.

    const MaxBytesWithoutOverflow = 9;
    for (let shift = 0; shift < MaxBytesWithoutOverflow * 7; shift += 7) {
      // ReadByte handles end of file cases for us.
      byteReadJustNow = this.readByte();
      result |= (BigInt(byteReadJustNow) & BIG_7Fh) << BigInt(shift);

      if (byteReadJustNow <= 0x7F) {
        return result; // early exit
      }
    }

    // Read the 10th byte. Since we already read 63 bits,
    // the value of this byte must fit within 1 bit (64 - 63),
    // and it must not have the high bit set.

    byteReadJustNow = this.readByte();
    if (byteReadJustNow > 0b1) {
      raise(TypeError('Bad 7 bit encoded number in file.'), CSCode.BadEncodedIntFormat);
    }

    result |= BigInt(byteReadJustNow) << BigInt(MaxBytesWithoutOverflow * 7);
    return result > LONG_MAX ? result - LONG_WRAP : result;
  }
}