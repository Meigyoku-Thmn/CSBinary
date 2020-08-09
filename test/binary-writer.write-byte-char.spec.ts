import assert from 'assert';
import { prepareMock, tearDownMock, reloadCriticalModules, flushCriticalModules } from './mock-prepare';
import { openEmtpyFile, getMockFileContent, openLastEmptyFile } from './utils';
import { constants, seekSync as _seekSync } from 'fs-ext';
import { BinaryReader as _BinaryReader } from '../src/binary-reader';
import { BinaryWriter as _BinaryWriter } from '../src/binary-writer';
import { CSCode } from '../src/constants/error';
import { BYTE_MIN, BYTE_MAX, SBYTE_MIN, SBYTE_MAX, INT_MIN, SHORT_MIN, INT_MAX } from '../src/constants/number';
import { vol } from 'memfs';
import _fs from 'fs';
const { SEEK_SET, SEEK_CUR } = constants;
let BinaryWriter = _BinaryWriter;
let BinaryReader = _BinaryReader;
let seekSync = _seekSync;
let fs = _fs;

describe('BinaryReader | Write Byte Char Tests', () => {
  before(() => {
    prepareMock();
    ({ BinaryReader, BinaryWriter, seekSync, fs } = reloadCriticalModules());
  });
  after(() => {
    tearDownMock();
    flushCriticalModules();
  });
  afterEach(() => {
    vol.reset();
  });

  /// <summary>
  /// Cases Tested:
  /// 1) Tests that BinaryWriter properly writes chars into a stream.
  /// 2) Tests that if someone writes surrogate characters, an argument exception is thrown
  /// 3) Casting an int to char and writing it, works.
  /// </summary>
  it('Write Char', () => {
    let mstr = openEmtpyFile();
    let dw2 = new BinaryWriter(mstr, 'utf8', true);
    let dr2 = new BinaryReader(mstr);

    let chArr: string[] = [];
    let ii = 0;

    // [] Write a series of characters to a MemoryStream and read them back
    chArr = ['A', 'c', '\0', '\u2701', '$', '.', '1', 'l', '\u00FF', '\n', '\t', '\v'];
    for (ii = 0; ii < chArr.length; ii++)
      dw2.writeChar(chArr[ii]);

    dw2.flush();
    seekSync(mstr, 0, SEEK_SET);
    for (ii = 0; ii < chArr.length; ii++) {
      let c = dr2.readChar();
      assert.equal(c, chArr[ii]);
    }
    assert.throws(() => dr2.readChar(), { code: CSCode.ReadBeyondEndOfFile });

    dw2.close();
    dr2.close();

    //If someone writes out characters using BinaryWriter's Write(char[]) method, they must use something like BinaryReader's ReadChars(int) method to read it back in.
    //They cannot use BinaryReader's ReadChar().  Similarly, data written using Write(char) can't be read back using ReadChars(int).

    //A high-surrogate is a Unicode code point in the range U+D800 through U+DBFF and a low-surrogate is a Unicode code point in the range U+DC00 through U+DFFF
    let ch: string;
    let mem = openEmtpyFile();
    let writer = new BinaryWriter(mem, 'utf16le');

    //between 1 <= x < 255
    let randomNumbers = [1, 254, 210, 200, 105, 135, 98, 54];
    for (let i = 0; i < randomNumbers.length; i++) {
      ch = String.fromCharCode(randomNumbers[i]);
      writer.writeChar(ch);
    }

    seekSync(mem, 0, SEEK_SET);
    writer.close();
  });

  it('Write Char | Negative', () => {
    //If someone writes out characters using BinaryWriter's Write(char[]) method, they must use something like BinaryReader's ReadChars(int) method to read it back in.
    //They cannot use BinaryReader's ReadChar().  Similarly, data written using Write(char) can't be read back using ReadChars(int).

    //A high-surrogate is a Unicode code point in the range U+D800 through U+DBFF and a low-surrogate is a Unicode code point in the range U+DC00 through U+DFFF
    let ch: string;
    let mem = openEmtpyFile();
    let writer = new BinaryWriter(mem, 'utf16le');
    // between 55296 <= x < 56319
    let randomNumbers = [55296, 56318, 55305, 56019, 55888, 55900, 56251];
    for (let i = 0; i < randomNumbers.length; i++) {
      ch = String.fromCharCode(randomNumbers[i]);
      assert.throws(() => writer.writeChar(ch), RangeError);
    }
    // between 56320 <= x < 57343
    randomNumbers = [56320, 57342, 56431, 57001, 56453, 57245, 57111];
    for (let i = 0; i < randomNumbers.length; i++) {
      ch = String.fromCharCode(randomNumbers[i]);
      assert.throws(() => writer.writeChar(ch), RangeError);
    }
    writer.close();
  });

  /// <summary>
  /// Cases Tested:
  /// Writing bytes casted to chars and using a different encoding; iso-2022-jp.
  /// </summary>
  it.skip('Write Char 2', () => {
    let stream = openEmtpyFile();
    let codepageName = 'iso-2022-jp' as BufferEncoding;
    let writer = new BinaryWriter(stream, codepageName, true);

    let bytes = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);

    writer.writeChar(String.fromCharCode(0x30ca));
    writer.writeBuffer(bytes);
    writer.flush();
    writer.writeChar('\0');

    seekSync(stream, 0, SEEK_SET);
    let reader = new BinaryReader(stream, codepageName);
    let japanese = reader.readChar();
    assert.equal(japanese.charCodeAt(0), 0x30ca);
    let readBytes = reader.readBytes(5);
    for (let i = 0; i < 5; i++) {
      //We pretty much don't expect this to work
      assert.notEqual(bytes[i], readBytes[i]);
    }

    writer.close();
    reader.close();
  });

  /// <summary>
  /// Testing that bytes can be written to a stream with BinaryWriter.
  /// </summary>
  it('Write Byte', () => {
    let ii = 0;
    let byteArr = [BYTE_MIN, BYTE_MAX, 100, 1, 10, Math.floor(BYTE_MAX / 2), BYTE_MAX - 100]

    // [] read/Write with Memorystream
    let mstr = openEmtpyFile();
    let dw2 = new BinaryWriter(mstr, 'utf8', true);

    for (ii = 0; ii < byteArr.length; ii++)
      dw2.writeByte(byteArr[ii]);

    dw2.flush();
    seekSync(mstr, 0, SEEK_SET);
    let dr2 = new BinaryReader(mstr);

    for (ii = 0; ii < byteArr.length; ii++)
      assert.equal(dr2.readByte(), byteArr[ii]);

    // [] Check End Of Stream
    assert.throws(() => dr2.readByte(), { code: CSCode.ReadBeyondEndOfFile });

    dw2.close();
    dr2.close();
  });


  /// <summary>
  /// Testing that SBytes can be written to a stream with BinaryWriter.
  /// </summary>
  it('Write SByte', () => {
    let ii = 0;
    let sbArr = [
      SBYTE_MIN, SBYTE_MAX, -100, 100, 0, Math.floor(SBYTE_MIN / 2), Math.floor(SBYTE_MAX / 2),
      10, 20, 30, -10, -20, -30, SBYTE_MAX - 100
    ];

    // [] read/Write with Memorystream
    let mstr = openEmtpyFile();
    let dw2 = new BinaryWriter(mstr, 'utf8', true);

    for (ii = 0; ii < sbArr.length; ii++)
      dw2.writeSByte(sbArr[ii]);

    dw2.flush();
    seekSync(mstr, 0, SEEK_SET);
    let dr2 = new BinaryReader(mstr)

    for (ii = 0; ii < sbArr.length; ii++)
      assert.equal(dr2.readSByte(), sbArr[ii]);

    dw2.close();
    dr2.close();
  });

  /// <summary>
  /// Testing that an ArgumentException is thrown when Sbytes are written to a stream
  /// and read past the end of that stream.
  /// </summary>
  it('Write SByte | Negative', () => {
    let ii = 0;
    let sbArr = [
      SBYTE_MIN, SBYTE_MAX, -100, 100, 0, Math.floor(SBYTE_MIN / 2), Math.floor(SBYTE_MAX / 2),
      10, 20, 30, -10, -20, -30, SBYTE_MAX - 100
    ];

    let mstr = openEmtpyFile();
    let dw2 = new BinaryWriter(mstr, 'utf8', true);

    for (ii = 0; ii < sbArr.length; ii++)
      dw2.writeSByte(sbArr[ii]);

    dw2.flush();

    let dr2 = new BinaryReader(mstr);
    // [] Check End Of Stream
    assert.throws(() => dr2.readSByte(), { code: CSCode.ReadBeyondEndOfFile });

    dw2.close();
    dr2.close();
  });

  it('Write Buffer', () => {
    let ii = 0;
    let byteArr = Buffer.from([BYTE_MIN, BYTE_MAX, 1, 5, 10, 100, 200]);

    // [] read/Write with Memorystream
    let mstr = openEmtpyFile();
    let dw2 = new BinaryWriter(mstr, 'utf8', true);

    dw2.writeBuffer(byteArr);
    dw2.flush();
    seekSync(mstr, 0, SEEK_SET);

    let dr2 = new BinaryReader(mstr);

    for (ii = 0; ii < byteArr.length; ii++)
      assert.equal(dr2.readByte(), byteArr[ii]);

    // [] Check End Of Stream
    assert.throws(() => dr2.readByte(), { code: CSCode.ReadBeyondEndOfFile });

    dw2.close();
    dr2.close();
  });

  it.skip('Write Buffer | Negative', () => {
    let iArrInvalidValues = [-1, -2, -100, -1000, -10000, -100000, -1000000, -10000000, -100000000, -1000000000, INT_MIN, SHORT_MIN];
    let iArrLargeValues = [INT_MAX, INT_MAX - 1, Math.floor(INT_MAX / 2), Math.floor(INT_MAX / 10), Math.floor(INT_MAX / 100)];
    let bArr = Buffer.alloc(0);
    // [] ArgumentNullException for null argument
    let mstr = openEmtpyFile();
    let dw2 = new BinaryWriter(mstr);

    assert.throws(() => dw2.writeBuffer(null), TypeError);
    dw2.close();

    // [] ArgumentNullException for null argument
    mstr = openEmtpyFile()
    dw2 = new BinaryWriter(mstr);
    assert.throws(() => dw2.writeBufferEx(null, 0, 0), TypeError);

    dw2.close();

    mstr = openEmtpyFile();
    dw2 = new BinaryWriter(mstr);
    for (let iLoop = 0; iLoop < iArrInvalidValues.length; iLoop++) {
      // [] ArgumentOutOfRange for negative offset
      assert.throws(() => dw2.writeBufferEx(bArr, iArrInvalidValues[iLoop], 0), RangeError);
      // [] ArgumentOutOfRangeException for negative count
      assert.throws(() => dw2.writeBufferEx(bArr, 0, iArrInvalidValues[iLoop]), RangeError);
    }
    dw2.close();

    mstr = openEmtpyFile();
    dw2 = new BinaryWriter(mstr);
    for (let iLoop = 0; iLoop < iArrLargeValues.length; iLoop++) {
      // [] Offset out of range
      assert.throws(() => dw2.writeBufferEx(bArr, iArrLargeValues[iLoop], 0), RangeError);
      // [] Invalid count value
      assert.throws(() => dw2.writeBufferEx(bArr, 0, iArrLargeValues[iLoop]), RangeError);
    }
    dw2.close();
  });

  /// <summary>
  /// Cases Tested:
  /// 1) Testing that bytes can be written to a stream with BinaryWriter.
  /// 2) Tests exceptional scenarios.
  /// </summary>
  it('Write Buffer 2', () => {
    let dw2: _BinaryWriter;
    let dr2: _BinaryReader;
    let mstr: number;
    let bArr = Buffer.alloc(0);
    let ii = 0;
    let bReadArr = Buffer.alloc(0);
    let returnValue: number;

    bArr = Buffer.alloc(1000);
    bArr[0] = BYTE_MIN;
    bArr[1] = BYTE_MAX;

    for (ii = 2; ii < 1000; ii++)
      bArr[ii] = ii % 255;

    // []read/ Write character values 0-1000 with  Memorystream
    mstr = openEmtpyFile();
    dw2 = new BinaryWriter(mstr, 'utf8', true);

    dw2.writeBufferEx(bArr, 0, bArr.length);
    dw2.flush();
    seekSync(mstr, 0, SEEK_SET);

    dr2 = new BinaryReader(mstr);
    bReadArr = Buffer.alloc(bArr.length);
    returnValue = dr2.readIntoBufferEx(bReadArr, 0, bArr.length);

    assert.equal(returnValue, bArr.length);

    for (ii = 0; ii < bArr.length; ii++)
      assert.equal(bReadArr[ii], bArr[ii]);

    dw2.close();
    dr2.close();
  });

  /// <summary>
  /// Cases Tested:
  /// 1) Testing that char[] can be written to a stream with BinaryWriter.
  /// 2) Tests exceptional scenarios.
  /// </summary>
  it('Write Char Array', () => {
    let ii = 0;
    let chArr = new Array<string>(1000);
    chArr[0] = '\0';
    chArr[1] = String.fromCharCode(65535);
    chArr[2] = '1';
    chArr[3] = 'A';
    chArr[4] = '\0';
    chArr[5] = '#';
    chArr[6] = '\t';

    for (ii = 7; ii < 1000; ii++)
      chArr[ii] = String.fromCharCode(ii);

    // [] read/Write with Memorystream
    let mstr = openEmtpyFile();
    let dw2 = new BinaryWriter(mstr, 'utf8', true);

    dw2.writeChars(chArr);
    dw2.flush();
    seekSync(mstr, 0, SEEK_SET);

    let dr2 = new BinaryReader(mstr);

    for (ii = 0; ii < chArr.length; ii++)
      assert.equal(dr2.readChar(), chArr[ii]);

    // [] Check End Of Stream
    assert.throws(() => dr2.readChar(), { code: CSCode.ReadBeyondEndOfFile });

    dw2.close();
    dr2.close();
  });

  it.skip('Write Char Array | Negative', () => {
    let iArrInvalidValues = [-1, -2, -100, -1000, -10000, -100000, -1000000, -10000000, -100000000, -1000000000, INT_MIN, SHORT_MIN];
    let iArrLargeValues = [INT_MAX, INT_MAX - 1, Math.floor(INT_MAX / 2), Math.floor(INT_MAX / 10), Math.floor(INT_MAX / 100)];
    let chArr = new Array<string>(1000);

    // [] ArgumentNullException for null argument
    let mstr = openEmtpyFile();
    let dw2 = new BinaryWriter(mstr);
    assert.throws(() => dw2.writeChars(null), TypeError);
    dw2.close();

    // [] ArgumentNullException for null argument
    mstr = openEmtpyFile();
    dw2 = new BinaryWriter(mstr);
    assert.throws(() => dw2.writeChars(null), TypeError);

    dw2.close();

    mstr = openEmtpyFile();
    dw2 = new BinaryWriter(mstr);

    for (let iLoop = 0; iLoop < iArrInvalidValues.length; iLoop++) {
      // [] ArgumentOutOfRange for negative offset
      assert.throws(() => dw2.writeCharsEx(chArr, iArrInvalidValues[iLoop], 0), ReferenceError);
      // [] negative count.
      assert.throws(() => dw2.writeCharsEx(chArr, 0, iArrInvalidValues[iLoop]), ReferenceError);
    }
    dw2.close();

    mstr = openEmtpyFile();
    dw2 = new BinaryWriter(mstr);
    for (let iLoop = 0; iLoop < iArrLargeValues.length; iLoop++) {
      // [] Offset out of range
      assert.throws(() => dw2.writeCharsEx(chArr, iArrLargeValues[iLoop], 0), ReferenceError);
      // [] Invalid count value
      assert.throws(() => dw2.writeCharsEx(chArr, 0, iArrLargeValues[iLoop]), ReferenceError);
    }
    dw2.close();
  });

  /// <summary>
  /// Cases Tested:
  /// If someone writes out characters using BinaryWriter's Write(char[]) method, they must use something like BinaryReader's ReadChars(int) method to read it back in.
  /// They cannot use BinaryReader's ReadChar().  Similarly, data written using Write(char) can't be read back using ReadChars(int).
  /// A high-surrogate is a Unicode code point in the range U+D800 through U+DBFF and a low-surrogate is a Unicode code point in the range U+DC00 through U+DFFF
  ///
  /// We don't throw on the second read but then throws continuously - note the loop count difference in the 2 loops
  ///
  /// BinaryReader was reverting to its original location instead of advancing. This was changed to skip past the char in the surrogate range.
  /// The affected method is InternalReadOneChar (IROC). Note that the work here is slightly complicated by the way surrogates are handled by
  /// the decoding classes. When IROC calls decoder.GetChars(), if the bytes passed in are surrogates, UnicodeEncoding doesn't report it.
  /// charsRead would end up being one value, and since BinaryReader doesn't have the logic telling it exactly how many bytes total to expect,
  /// it calls GetChars in a second loop. In that loop, UnicodeEncoding matches up a surrogate pair. If it realizes it's too big for the encoding,
  /// then it throws an ArgumentException (chars overflow). This meant that BinaryReader.IROC is advancing past two chars in the surrogate
  /// range, which is why the position actually needs to be moved back (but not past the first surrogate char).
  ///
  /// Note that UnicodeEncoding doesn't always throw when it encounters two successive chars in the surrogate range. The exception
  /// encountered here happens if it finds a valid pair but then determines it's too long. If the pair isn't valid (a low then a high),
  /// then it returns 0xfffd, which is why BinaryReader.ReadChar needs to do an explicit check. (It always throws when it encounters a surrogate)
  /// </summary>
  it('Write Char Array 2', () => {
    let mem = openEmtpyFile();
    let writer = new BinaryWriter(mem, 'utf16le', true);

    // between 55296 <= x < 56319

    // between 56320 <= x < 57343
    let randomChars = [
      55296, 57297, 55513, 56624, 55334, 56957, 55857,
      56355, 56095, 56887, 56126, 56735, 55748, 56405,
      55787, 56707, 56300, 56417, 55465, 56944
    ].map(e => String.fromCharCode(e));

    writer.writeChars(randomChars);
    seekSync(mem, 0, SEEK_SET);
    let reader = new BinaryReader(mem, 'utf16le');

    for (let i = 0; i < 50; i++) {
      try {
        reader.readChar();
        assert.equal(i, 1);
      } catch (err) {
        if (err.code != CSCode.SurrogateCharHit)
          throw err;
        // ArgumentException is sometimes thrown on ReadChar() due to the
        // behavior outlined in the method summary.
      }
    }

    let chars = reader.readChars(randomChars.length);
    for (let i = 0; i < randomChars.length; i++)
      assert.equal(chars[i], randomChars[i]);

    writer.close();
    reader.close();
  });

  /// <summary>
  /// Cases Tested:
  /// 1) Tests that char[] can be written to a stream with BinaryWriter.
  /// 2) Tests Exceptional cases.
  /// </summary>
  it('Write Char Array 3', () => {
    let chArr = new Array<string>(1000);
    chArr[0] = '\0';
    chArr[1] = String.fromCharCode(65535);
    chArr[2] = '1';
    chArr[3] = 'A';
    chArr[4] = '\0';
    chArr[5] = '#';
    chArr[6] = '\t';

    for (let ii = 7; ii < 1000; ii++)
      chArr[ii] = String.fromCharCode(ii);

    // []read/ Write character values 0-1000 with  Memorystream

    let mstr = openEmtpyFile();
    let dw2 = new BinaryWriter(mstr, 'utf8', true);

    dw2.writeCharsEx(chArr, 0, chArr.length);
    dw2.flush();
    seekSync(mstr, 0, SEEK_SET);

    let dr2 = new BinaryReader(mstr);
    let chReadArr = new Array<string>(chArr.length);
    let charsRead = dr2.readIntoCharsEx(chReadArr, 0, chArr.length);
    assert.equal(charsRead, chArr.length);

    for (let ii = 0; ii < chArr.length; ii++)
      assert.equal(chReadArr[ii], chArr[ii]);

    dw2.close();
    dr2.close();
  });

  it('Write Span', () => {
    let bytes = Buffer.from([4, 2, 7, 0xFF]);
    let chars = ['a', '7', String.fromCharCode(65535)];

    let memoryStream = openEmtpyFile();
    let binaryWriter = new BinaryWriter(memoryStream, 'utf16le');
    binaryWriter.writeBuffer(bytes);
    binaryWriter.writeChars(chars);

    let baseStream = binaryWriter.baseFd;
    seekSync(baseStream, 2, SEEK_SET);

    let b = Buffer.alloc(1);
    fs.readSync(baseStream, b, 0, b.length, null);
    assert.equal(b.readUInt8(), 7);
    fs.readSync(baseStream, b, 0, b.length, null);
    assert.equal(b.readUInt8(), 0xFF);

    let testChar: string;
    b = Buffer.alloc(2);

    fs.readSync(baseStream, b, 0, b.length, null);
    testChar = b.toString('utf16le');
    assert.equal(testChar, 'a');

    fs.readSync(baseStream, b, 0, b.length, null);
    testChar = b.toString('utf16le');
    assert.equal(testChar, '7');

    fs.readSync(baseStream, b, 0, b.length, null);
    testChar = b.toString('utf16le');
    assert.equal(testChar, String.fromCharCode(65535));
  });
});