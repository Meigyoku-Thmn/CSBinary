import fs from 'fs';
import { seekSync, constants } from 'fs-ext'
const { SEEK_CUR, SEEK_SET } = constants;
import { StringDecoder } from 'string_decoder';
import { readByte, tell } from './utils/file'
import { subarray, SubArray } from './utils/array';

type char = string;

// this is a port from https://github.com/dotnet/runtime/blob/4fb2a6816c32cde98e916eaf28623a5e314aa438/src/libraries/System.Private.CoreLib/src/System/IO/BinaryReader.cs
const MaxCharBytesSize = 128;
export class BinaryReader {
  private readonly _stream: number;
  private readonly _buffer: Buffer;
  private readonly _decoder: StringDecoder;
  private _charBytes: Buffer;

  // Performance optimization for Read() w/ Unicode.  Speeds us up by ~40%
  private readonly _2BytesPerChar: boolean;
  private readonly _leaveOpen: boolean;
  private _disposed: boolean;

  private _canSeek: boolean;

  constructor(
    input: number,
    encoding: BufferEncoding = 'utf8',
    leaveOpen: boolean = false,
  ) {
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

  get baseStream() {
    return this._stream;
  }

  dispose(disposing: boolean = true): void {
    if (!this._disposed) {
      if (disposing && !this._leaveOpen) {
        fs.closeSync(this._stream);
      }
      this._disposed = true;
    }
  }

  close(): void {
    this.dispose(true);
  }

  private throwIfDisposed(): void {
    if (this._disposed) {
      throw new ReferenceError('This BinaryReader instance is disposed.');
    }
  }

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
      // is for our encoding.  Otherwise for UnicodeEncoding we'd have to
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

  readSByte(): number {
    return this.internalReadByte() - 128; // "cast" byte to sbyte
  }

  readBoolean(): boolean {
    return this.internalReadByte() != 0;
  }

  readChar(): char {
    let value = this.readCharCode();
    if (value == -1) {
      throw new RangeError('Read beyond end-of-file.');
    }
    return String.fromCharCode(value);
  }

  readInt16(): number {
    return this.internalRead(2).readInt16LE();
  }

  readUInt16(): number {
    return this.internalRead(2).readUInt16LE();
  }

  readInt32(): number {
    return this.internalRead(4).readInt32LE();
  }

  readUInt32(): number {
    return this.internalRead(4).readUInt32LE();
  }

  readInt64(): bigint {
    return this.internalRead(8).readBigInt64LE();
  }

  readUInt64(): bigint {
    return this.internalRead(8).readBigUInt64LE();
  }

  readSingle(): number {
    return this.internalRead(8).readFloatLE();
  }

  readDouble(): number {
    return this.internalRead(8).readDoubleLE();
  }

  readDecimal(): number {
    throw new TypeError('Decimal type number is not supported.');
  }

  /**
   * This method is intented for serialized C# string.
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

  readCharsEx(buffer: char[], index: number, count: number): number {
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

  private internalReadChars(buffer: SubArray<char>): number {
    let totalCharsRead = 0;

    while (!buffer.isEmpty) {
      let numBytes = buffer.length;

      // We really want to know what the minimum number of bytes per char
      // is for our encoding.  Otherwise for UnicodeEncoding we'd have to
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

  readSpanEx(buffer: Buffer, index: number, count: number): number {
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

  readSpan(buffer: Buffer): number {
    if (buffer == null) {
      throw new TypeError("buffer is null");
    }
    this.throwIfDisposed();
    return fs.readSync(this._stream, buffer);
  }

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
      // Trim array.  This should happen on EOF & possibly net streams.
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