import assert from 'assert';
import {
  SHORT_MAX, INT_MIN, INT_MAX, SINGLE_MIN, SINGLE_MAX, SINGLE_EPSILON, DOUBLE_EPSILON,
  DOUBLE_MIN, DOUBLE_MAX, SHORT_MIN, LONG_MIN, LONG_MAX, USHORT_MIN, USHORT_MAX, UINT_MIN, UINT_MAX, ULONG_MIN, ULONG_MAX
} from '../src/constants/number';
import { CSCode } from '../src/constants/error';
import { BinaryReader } from '../src/binary-reader';
import { BinaryWriter } from '../src/binary-writer';
import { SeekOrigin } from '../src/constants/mode';
import { openTruncated, installHookToFile, removeHookFromFile } from './utils';
import { IFile } from '../src/addon/file';
import { Encoding } from '../src/encoding';

describe('BinaryWriter | Write Tests', () => {
  const fileArr: IFile[] = [];
  before(() => {
    installHookToFile(fileArr);
  });
  afterEach(() => {
    fileArr.forEach(e => e.close());
    fileArr.length = 0;
  });
  after(() => {
    removeHookFromFile();
  });

  it('Write Boolean', async () => {
    // [] Write a series of booleans to a stream
    const file = openTruncated();
    const dw2 = new BinaryWriter(file, 'utf8', true);
    const dr2 = new BinaryReader(file);

    dw2.writeBoolean(false);
    dw2.writeBoolean(false);
    dw2.writeBoolean(true);
    dw2.writeBoolean(false);
    dw2.writeBoolean(true);
    dw2.writeInt32(5);
    dw2.writeInt32(0);

    dw2.flush();
    file.seek(0, SeekOrigin.Begin);

    assert.ok(!dr2.readBoolean());
    assert.ok(!dr2.readBoolean());
    assert.ok(dr2.readBoolean());
    assert.ok(!dr2.readBoolean());
    assert.ok(dr2.readBoolean());
    assert.strictEqual(dr2.readInt32(), 5);
    assert.strictEqual(dr2.readInt32(), 0);

    dw2.close();
    dr2.close();
  });

  it('Write Single', () => {
    const sglArr = [
      SINGLE_MIN, SINGLE_MAX, SINGLE_EPSILON, Infinity, -Infinity, 0,
      0, Math.fround(-1E20), Math.fround(-3.5E-20), Math.fround(1.4E-10), Math.fround(10000.2), Math.fround(2.3E30),
    ];

    writeTest(sglArr, (bw, s) => bw.writeSingle(s), br => br.readSingle());
  });

  it('Write Double', () => {
    const dblArr = [
      -Infinity, Infinity, DOUBLE_EPSILON, DOUBLE_MIN, DOUBLE_MAX,
      -3E59, -1000.5, -1E-40, 3.4E-37, 0.45, 5.55, 3.4899E233,
    ];

    writeTest(dblArr, (bw, s) => bw.writeDouble(s), br => br.readDouble());
  });

  it('Write Int16', () => {
    const i16Arr = [SHORT_MIN, SHORT_MAX, 0, -10000, 10000, -50, 50];

    writeTest(i16Arr, (bw, s) => bw.writeInt16(s), br => br.readInt16());
  });

  it('Write Int32', () => {
    const i32Arr = [INT_MIN, INT_MAX, 0, -10000, 10000, -50, 50];

    writeTest(i32Arr, (bw, s) => bw.writeInt32(s), br => br.readInt32());
  });

  it('Write 7 Bit Encoded Int', () => {
    const i32Arr = [
      INT_MIN, INT_MAX, 0, -10000, 10000, -50, 50,
      0, -1, -101
    ];

    writeTest(i32Arr, (bw, s) => bw.write7BitEncodedInt(s), br => br.read7BitEncodedInt());
  });

  it('Write Int64', () => {
    const i64Arr = [
      LONG_MIN, LONG_MAX, 0, -10000, 10000, -50, 50
    ].map(e => BigInt(e));

    writeTest(i64Arr, (bw, s) => bw.writeInt64(s), br => br.readInt64());
  });

  it('Write 7 Bit Encoded Int64', () => {
    const i64Arr = [
      LONG_MIN, LONG_MAX, 0, -10000, 10000, -50, 50,
      0, -1, -101,
    ].map(e => BigInt(e));

    writeTest(i64Arr, (bw, s) => bw.write7BitEncodedInt64(s), br => br.read7BitEncodedInt64());
  });

  it('Write UInt16', () => {
    const ui16Arr = [
      USHORT_MIN, USHORT_MAX, 0, 100, 1000, 10000, USHORT_MAX - 100
    ];

    writeTest(ui16Arr, (bw, s) => bw.writeUInt16(s), br => br.readUInt16());
  });

  it('Write UInt32', () => {
    const ui32Arr = [
      UINT_MIN, UINT_MAX, 0, 100, 1000, 10000, UINT_MAX - 100
    ];

    writeTest(ui32Arr, (bw, s) => bw.writeUInt32(s), br => br.readUInt32());
  });

  it('Write UInt64', () => {
    const ui64Arr = [
      ULONG_MIN, ULONG_MAX, 0, 100, 1000, 10000, ULONG_MAX - BigInt(100)
    ].map(e => BigInt(e));

    writeTest(ui64Arr, (bw, s) => bw.writeUInt64(s), br => br.readUInt64());
  });

  it('Write String', () => {
    const sb = 'abc'.repeat(5);
    const strArr = [
      'ABC', '\t\t\n\n\n\0\r\r\v\v\t\0\rHello', 'This is a normal string', '12345667789!@#$%^&&())_+_)@#',
      'ABSDAFJPIRUETROPEWTGRUOGHJDOLJHLDHWEROTYIETYWsdifhsiudyoweurscnkjhdfusiyugjlskdjfoiwueriye', '     ',
      '\0\0\0\t\t\tHey""', '\u0022\u0011', sb, ''
    ];

    const encoding = new Encoding('utf8');
    writeTest(strArr, (bw, s) => bw.writeString(s), br => br.readString());
    writeTest(strArr, (bw, s) => bw.writeRawString(s), (br, s) => br.readRawString(encoding.encode(s ?? ' ').length));
    writeTest(strArr, (bw, s) => bw.writeCString(s), (br, s) => {
      const rs = br.readRawString(encoding.encode(s ?? ' ').length + 1).replace(/\0*$/g, '');
      if (rs.length != s.length)
        assert.fail('String is not null-terminated.');
      return rs;
    });
  });

  it('Write String | Invalid Length', () => {
    const file = openTruncated();
    const dw = new BinaryWriter(file, 'utf8', true);
    dw.write7BitEncodedInt(-1);
    dw.close();
    file.seek(0, SeekOrigin.Begin);
    const dr = new BinaryReader(file);
    assert.throws(() => dr.readString(), { code: CSCode.InvalidEncodedStringLength });
    assert.throws(() => dr.readRawString(-1), { code: CSCode.InvalidEncodedStringLength });
  });

  it('Write String | Null', () => {
    const file = openTruncated();
    const dw2 = new BinaryWriter(file);
    assert.throws(() => dw2.writeString(null), TypeError);
    assert.throws(() => dw2.writeCString(null), TypeError);
    assert.throws(() => dw2.writeRawString(null), TypeError);
    dw2.close();
  });

  function writeTest<T>(testElements: T[], write: (w: BinaryWriter, s: T) => void, read: (r: BinaryReader, s?: T) => T) {
    const file = openTruncated();
    const writer = new BinaryWriter(file, 'utf8', true);
    const reader = new BinaryReader(file);

    for (let i = 0; i < testElements.length; i++) {
      write(writer, testElements[i]);
    }

    writer.flush();
    file.seek(0, SeekOrigin.Begin);

    for (let i = 0; i < testElements.length; i++) {
      assert.strictEqual(read(reader, testElements[i]).toString(), testElements[i].toString());
    }

    // We've reached the end of the stream.  Check for expected EndOfStreamException
    assert.throws(() => read(reader), { code: CSCode.ReadBeyondEndOfFile });

    writer.close();
    reader.close();
  }
});