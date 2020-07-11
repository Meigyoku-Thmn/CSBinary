import fs from 'fs';
import { seekSync, constants } from 'fs-ext'
const { SEEK_CUR, SEEK_SET } = constants;
import { StringDecoder } from 'string_decoder';
import { readByte, tell } from './utils/file'
import { subarray, SubArray } from './utils/array';

type char = string;

const MaxCharBytesSize = 128;
export class BinaryReader {
  private readonly _stream: number;
  private readonly _buffer: Buffer;
  private readonly _decoder: StringDecoder;
  private _charBytes: Buffer;

  // Performance optimization for Read() w/ Unicode. Speeds us up by ~40%
  private readonly _2BytesPerChar: boolean;
  private readonly _leaveOpen: boolean;
  private _disposed: boolean;

  private _canSeek: boolean;

  /**
   * Initializes a new instance of the BinaryReader class based on the specified file descriptor and character encoding, and optionally leaves the file open.
   * @param input The input file descriptor.
   * @param encoding The character encoding to use. Default to `'utf8'`
   * @param leaveOpen `true` to leave the file open after the BinaryReader object is disposed; otherwise, `false`. Default to `false`.
   */
  constructor(input: number, encoding: BufferEncoding = 'utf8', leaveOpen = false) {
    if (typeof input != 'number')
      throw new TypeError('input must be a file descriptor');

    this._stream = input;
    this._decoder = new StringDecoder(encoding);
    if (this._decoder['lastNeed'] == null)
      throw new ReferenceError('"StringDecoder" from "string_decoder" module doesn\'t have "lastNeed" field.');
    this._buffer = Buffer.alloc(16);
    // _charBuffer and _charBytes will be left null.
    // For Encodings that always use 2 bytes per char (or more),
    // special case them here to make Read() & Peek() faster.
    this._2BytesPerChar = encoding == 'utf16le';
    this._leaveOpen = leaveOpen;

    this._canSeek = tell(this._stream) >= 0;
  }

  /**
   * Get the underlying file descriptor of the BinaryReader.
   */
  get baseStream() {
    return this._stream;
  }

  /**
   * Releases the unmanaged resources used by the BinaryReader class and optionally releases the managed resources.
   * @param disposing `true` to release both managed and unmanaged resources; `false` to release only unmanaged resources. Default to `true`.
   */
  dispose(disposing = true): void {
    if (!this._disposed) {
      if (disposing && !this._leaveOpen) {
        fs.closeSync(this._stream);
      }
      this._disposed = true;
    }
  }

  /**
   * Closes the current reader and the underlying file.
   */
  close(): void {
    this.dispose(true);
  }

  private throwIfDisposed(): void {
    if (this._disposed) {
      throw new ReferenceError('This BinaryReader instance is disposed.');
    }
  }
  
  /**
   * Returns the next available character and does not advance the byte or character position.
   * @returns The next available character, or -1 if no more characters are available or the file does not support seeking.
   */
  peekChar(): number {
    this.throwIfDisposed();

    if (!this._canSeek) {
      return -1;
    }

    var origPos = tell(this._stream);
    let ch = this.readCharCode();
    seekSync(this._stream, origPos, SEEK_SET);
    return ch;
  }

  /**
   * Reads characters from the underlying file and advances the current position of the file in accordance with the `Encoding` used and the specific character being read from the file.
   * @returns The next character from the input file, or -1 if no characters are currently available.
   */
  readCharCode(): number {
    this.throwIfDisposed();

    let numBytes: number;
    let posSav = 0;

    if (this._canSeek) {
      posSav = tell(this._stream);
    }

    this._charBytes ? 0 : (this._charBytes = Buffer.alloc(MaxCharBytesSize));

    // there isn't any decoder in JS world that can reuse output buffer
    let singleChar = '';

    while (singleChar.length == 0) {
      // We really want to know what the minimum number of bytes per char
      // is for our encoding. Otherwise for UnicodeEncoding we'd have to
      // do ~1+log(n) reads to read n characters.
      // Assume 1 byte can be 1 char unless _2BytesPerChar is true.
      numBytes = this._2BytesPerChar ? 2 : 1;

      let r = readByte(this._stream);
      this._charBytes.writeUInt8(r, 0);
      if (r == -1) {
        numBytes = 0;
      }
      if (numBytes == 2) {
        r = readByte(this._stream);
        this._charBytes.writeUInt8(r, 1);
        if (r == -1) {
          numBytes = 1;
        }
      }

      if (numBytes == 0) {
        return -1;
      }

      try {
        singleChar = this._decoder.write(this._charBytes.subarray(0, numBytes));
        if (singleChar.length > 1)
          throw new Error("BinaryReader hit a surrogate char in the read method.");
      }
      catch (err) {
        // Handle surrogate char

        if (this._canSeek) {
          seekSync(this._stream, posSav - tell(this._stream), SEEK_CUR);
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

    let b = readByte(this._stream);
    if (b == -1) {
      throw new RangeError('Read beyond end-of-file.');
    }

    return b;
  }

  /**
   * Reads a signed byte from this file and advances the current position of the file by one byte.
   * @returns A signed byte read from the current file.
   */
  readSByte(): number {
    return this.internalReadByte() - 128; // "cast" byte to sbyte
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
      throw new RangeError('Read beyond end-of-file.');
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
    return this.internalRead(8).readFloatLE();
  }

  /**
   * Reads an 8-byte floating point value from the current file and advances the current position of the file by eight bytes.
   * @returns An 8-byte floating point value read from the current file.
   */
  readDouble(): number {
    return this.internalRead(8).readDoubleLE();
  }

  /** Not supported */
  readDecimal(): number {
    throw new TypeError('Decimal type number is not supported.');
  }

  /**
   * Reads a string from the current file. The string is prefixed with the length, encoded as an integer seven bits at a time.
   * @returns The string being read.
   */
  readString(): string {
    this.throwIfDisposed();

    let currPos = 0;
    let n: number;
    let stringLength: number;
    let readLength: number;

    // Length of the string in bytes, not chars
    stringLength = this.read7BitEncodedInt();
    if (stringLength < 0) {
      throw new RangeError('Invalid string\'s length: ' + stringLength);
    }

    if (stringLength == 0) {
      return '';
    }

    this._charBytes ? 0 : (this._charBytes = Buffer.alloc(MaxCharBytesSize));

    let sb = '';
    do {
      readLength = ((stringLength - currPos) > MaxCharBytesSize) ? MaxCharBytesSize : (stringLength - currPos);

      n = fs.readSync(this._stream, this._charBytes, 0, readLength, null);
      if (n == 0) {
        throw new RangeError('Read beyond end-of-file.');
      }

      let strRead = this._decoder.write(this._charBytes.subarray(0, n))

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
    if (buffer == null) {
      throw new TypeError('buffer is null.')
    }
    if (index == null) {
      throw new TypeError('index is null.');
    }
    if (count == null) {
      throw new TypeError('count is null');
    }
    if (index < 0) {
      throw new RangeError('index need to be a non-negative number.');
    }
    if (count < 0) {
      throw new RangeError('count need to be a non-negative number.');
    }
    if (buffer.length - index < count) {
      throw new RangeError('This will read into out of buffer.');
    }
    this.throwIfDisposed();
    return this.internalReadChars(subarray(buffer, index, index + count));
  }

  /**
   * Reads, from the current file, the same number of characters as the length of the provided buffer, writes them in the provided buffer, and advances the current position in accordance with the `Encoding` used and the specific character being read from the file.
   * @param buffer A view of characters. When this method returns, the contents of this region are replaced by the characters read from the current source.
   * @returns The total number of characters read into the buffer. This might be less than the number of characters requested if that many characters are not currently available, or it might be zero if the end of the file is reached.
   */
  readIntoChars(buffer: SubArray<char>): number {
    if (buffer == null) {
      throw new TypeError('buffer is null.')
    }
    this.throwIfDisposed();
    return this.internalReadChars(buffer);
  }

  private internalReadChars(buffer: SubArray<char>): number {
    let totalCharsRead = 0;

    while (!buffer.isEmpty) {
      let numBytes = buffer.length;

      // We really want to know what the minimum number of bytes per char
      // is for our encoding. Otherwise for UnicodeEncoding we'd have to
      // do ~1+log(n) reads to read n characters.
      if (this._2BytesPerChar) {
        numBytes <<= 1;
      }

      // We do not want to read even a single byte more than necessary.
      //
      // Subtract pending bytes that the decoder may be holding onto. This assumes that each
      // decoded char corresponds to one or more bytes. Note that custom encodings or encodings with
      // a custom replacement sequence may violate this assumption.
      if (numBytes > 1) {
        // Check whether the decoder has any pending state.
        if (this._decoder['lastNeed'] != 0) {
          numBytes--;

          // The worst case is charsRemaining = 2 and UTF32Decoder holding onto 3 pending bytes. We need to read just
          // one byte in this case.
          if (this._2BytesPerChar && numBytes > 2)
            numBytes -= 2;
        }
      }

      this._charBytes ? 0 : (this._charBytes = Buffer.alloc(MaxCharBytesSize));

      if (numBytes > MaxCharBytesSize) {
        numBytes = MaxCharBytesSize;
      }
      numBytes = fs.readSync(this._stream, this._charBytes, 0, numBytes, null);
      let byteBuffer = this._charBytes.subarray(0, numBytes);

      if (byteBuffer.length == 0) {
        break;
      }

      let strRead = this._decoder.write(byteBuffer);
      for (let i = 0; i < strRead.length; i++)
        buffer.set(i, strRead[i]);
      buffer = buffer.slice(strRead.length);

      totalCharsRead += strRead.length;
    }

    // we may have read fewer than the number of characters requested if end of stream reached
    // or if the encoding makes the char count too big for the buffer (e.g. fallback sequence)
    return totalCharsRead;
  }

  /**
   * Reads the specified number of characters from the current file, returns the data in a character array, and advances the current position in accordance with the `Encoding` used and the specific character being read from the file.
   * @param count The number of characters to read.
   * @returns A character array containing data read from the underlying file. This might be less than the number of characters requested if the end of the file is reached.
   */
  readChars(count: number): char[] {
    if (count == null) {
      throw new TypeError('count is null.');
    }
    if (count < 0) {
      throw new RangeError('count must be a non-negative value.');
    }
    this.throwIfDisposed();

    if (count == 0) {
      return [];
    }

    let chars = new Array<char>(count);
    let n = this.internalReadChars(subarray(chars));
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
    if (buffer == null) {
      throw new TypeError('buffer is null or undefined.');
    }
    if (index == null) {
      throw new TypeError('index is null');
    }
    if (count == null) {
      throw new TypeError('count is null');
    }
    if (index < 0) {
      throw new RangeError('index must be a non-negative number.');
    }
    if (count < 0) {
      throw new RangeError('count must be a non-negative number.');
    }
    if (buffer.length - index < count) {
      throw new RangeError('This will read into out of buffer.');
    }
    this.throwIfDisposed();

    return fs.readSync(this._stream, buffer, index, count, null);
  }

  /**
   * Reads a sequence of bytes from the current file and advances the position within the file by the number of bytes read.
   * @param buffer A region of memory. When this method returns, the contents of this region are replaced by the bytes read from the current source.
   * @returns The total number of bytes read into the buffer. This can be less than the number of bytes allocated in the buffer if that many bytes are not currently available, or zero (0) if the end of the file has been reached.
   */
  readIntoBuffer(buffer: Buffer): number {
    if (buffer == null) {
      throw new TypeError("buffer is null");
    }
    this.throwIfDisposed();
    return fs.readSync(this._stream, buffer);
  }

  /**
   * Reads the specified number of bytes from the current file into a buffer and advances the current position by that number of bytes.
   * @param count The number of bytes to read. This value must be 0 or a non-negative number or an exception will occur.
   * @returns A buffer containing data read from the underlying file. This might be less than the number of bytes requested if the end of the file is reached.
   */
  readBytes(count: number): Buffer {
    if (count == null) {
      throw new TypeError('count is null');
    }
    if (count < 0) {
      throw new RangeError('count must be a non-negative number.');
    }
    this.throwIfDisposed();

    if (count == 0) {
      return Buffer.alloc(0);
    }

    let result = Buffer.alloc(count);
    let numRead = 0;
    do {
      let n = fs.readSync(this._stream, result, numRead, count, null);
      if (n == 0) {
        break;
      }

      numRead += n;
      count -= n;
    } while (count > 0);

    if (numRead != result.length) {
      // Trim array. This should happen on EOF & possibly net streams.
      let copy = Buffer.alloc(numRead);
      result.copy(copy, 0, 0, numRead);
      result = copy;
    }

    return result;
  }

  private internalRead(numBytes: number): Buffer {
    this.throwIfDisposed();

    let bytesRead = 0;
    do {
      let n = fs.readSync(this._stream, this._buffer, bytesRead, numBytes - bytesRead, null);
      if (n == 0) {
        throw new RangeError('Read beyond end-of-file.');
      }
      bytesRead += n;
    } while (bytesRead < numBytes);

    return this._buffer;
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

    const MaxBytesWithoutOverflow = 4;
    for (let shift = 0; shift < MaxBytesWithoutOverflow * 7; shift += 7) { // TODO: check 
      // ReadByte handles end of stream cases for us.
      byteReadJustNow = this.readByte();
      result |= (byteReadJustNow & 0x7F) << shift;

      if (byteReadJustNow <= 0x7F) {
        return result; // early exit
      }
    }

    // Read the 5th byte. Since we already read 28 bits,
    // the value of this byte must fit within 4 bits (32 - 28),
    // and it must not have the high bit set.

    byteReadJustNow = this.readByte();
    if (byteReadJustNow > 0b1111) {
      throw new TypeError('SR.Format_Bad7BitInt');
    }

    result |= byteReadJustNow << (MaxBytesWithoutOverflow * 7);
    return result;
  }

  /**
   * Reads in a 64-bit integer in compressed format.
   * @returns A 64-bit integer in compressed format.
   */
  read7BitEncodedInt64(): bigint {
    let result = BigInt(0);
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
      // ReadByte handles end of stream cases for us.
      byteReadJustNow = this.readByte();
      result |= (BigInt(byteReadJustNow) & BigInt(0x7F)) << BigInt(shift);

      if (byteReadJustNow <= 0x7F) {
        return result; // early exit
      }
    }

    // Read the 10th byte. Since we already read 63 bits,
    // the value of this byte must fit within 1 bit (64 - 63),
    // and it must not have the high bit set.

    byteReadJustNow = this.readByte();
    if (byteReadJustNow > 0b1) {
      throw new TypeError('SR.Format_Bad7BitInt');
    }

    result |= BigInt(byteReadJustNow) << BigInt(MaxBytesWithoutOverflow * 7);
    return result;
  }
}