# CSBinary
I ported BinaryReader and BinaryWriter from Dotnet Core to NodeJS because reading and writing binary files non-linearly in NodeJS is very tedious.

Non-linear data processing (that means you can jump/"seek" back and forth at will all across a file to read its' data) is not a popular thing in NodeJS world (people usually do streaming instead), but when you have to, then this library will come in handy. Beside, you want to write code in a scripting language for simplicity and convenience.

You don't have to write code like this anymore:
```js
// read one byte, two bytes and four bytes
const fs = require('fs');
const filePath = '<put your file path here>';
const fd = fs.openSync(filePath, 'r');
const buffer = Buffer.alloc(4);
fs.readSync(fd, buffer, 0, 1);
console.log(buffer.readUInt8());
fs.readSync(fd, buffer, 0, 2);
console.log(buffer.readUInt16LE());
fs.readSync(fd, buffer, 0, 4);
console.log(buffer.readUInt32LE());
fs.closeSync(fd);
```
With this library, you can just write:
```js
// read one byte, two bytes and four bytes
const fs = require('fs');
const { BinaryReader } = require('csbinary');
const filePath = '<put your file path here>';
const reader = new BinaryReader(fs.openSync(filePath, 'r'));
console.log(reader.readUInt8());
console.log(reader.readUInt16());
console.log(reader.readUInt32());
reader.close();
```
# Install
There is no package on npm yet.
```bash
npm i --save github:Meigyoku-Thmn/CSBinary#v1.1.0
```

# Usage
Almost the same as .NET's BinaryReader and BinaryWriter.<br>

Please refer to [entry.ts](entry.ts) to know what are exported.

## BinaryReader
Mapping table of BinaryReader's methods from .NET to NodeJS:
| Method in .NET                                                | Method in NodeJS |
|---------------------------------------------------------------|------------------|
| BinaryReader(Stream input, Encoding encoding, bool leaveOpen) | constructor(input: number, encoding: BufferEncoding \| string \| IEncoding = 'utf8', leaveOpen = false)               |
| Stream BaseStream { get; }                                    | get baseFd(): number |
| void Close()                                                  | close(): void |
|                                                               | seek(offset: number, origin: number): number |
| int PeekChar()                                                | peekChar(): number
| int Read()                                                    | readCharCode(): number
| byte ReadByte()                                               | readByte(): number
| sbyte ReadSByte()                                             | readSByte(): number
| bool ReadBoolean()                                            | readBoolean(): boolean
| char ReadChar()                                               | readChar(): char
| short ReadInt16()                                             | readInt16(): number
| ushort ReadUInt16()                                           | readUInt16(): number
| int ReadInt32()                                               | readInt32(): number
| uint ReadUInt32()                                             | readUInt32(): number
| long ReadInt64()                                              | readInt64(): bigint
| ulong ReadUInt64()                                            | readUInt64(): bigint
| float ReadSingle()                                            | readSingle(): number
| double ReadDouble()                                           | readDouble(): number
| string ReadString()                                           | readString(): string
| int Read(char[] buffer, int index, int count)                 | readIntoCharsEx(buffer: char[], index: number, count: number): number
| int Read(Span<char> buffer)                                   | readIntoChars(buffer: char[]): number
| char[] ReadChars(int count)                                   | readChars(count: number): char[]
| int Read(byte[] buffer, int index, int count)                 | readIntoBufferEx(buffer: Buffer, index: number, count: number): number
| int Read(Span<byte> buffer)                                   | readIntoBuffer(buffer: Buffer): number
| byte[] ReadBytes(int count)                                   | readBytes(count: number): Buffer
| int Read7BitEncodedInt()                                      | read7BitEncodedInt(): number
| long Read7BitEncodedInt64()                                   | read7BitEncodedInt64(): bigint

## BinaryWriter
Mapping table of BinaryWriter's method from .NET to NodeJS:
| Method in .NET                                                 | Method in NodeJS |
|----------------------------------------------------------------|------------------|
| BinaryWriter(Stream output, Encoding encoding, bool leaveOpen) | constructor(output: number, encoding: BufferEncoding \| string \| IEncoding = 'utf8', leaveOpen = false) |
| static readonly BinaryWriter Null                              | static get null(): BinaryWriter
| Stream BaseStream { get; }                                     | get baseFd(): number
| void Close()                                                   | close(): void
|                                                                | async closeAsync(): Promise\<void\>
| void Flush()                                                   | flush(): void
| long Seek(int offset, SeekOrigin origin)                       | seek(offset: number, origin: number): number
| void Write(bool value)                                         | writeBoolean(value: boolean): void
| void Write(byte value)                                         | writeByte(value: number): void
| void Write(sbyte value)                                        | writeSByte(value: number): void
| void Write(byte[] buffer)                                      | writeBuffer(buffer: Buffer): void
| void Write(byte[] buffer, int index, int count)                | writeBufferEx(buffer: Buffer, index: number, count: number): void
| void Write(char ch)                                            | writeChar(ch: char): void
| void Write(char[] chars)                                       | writeChars(chars: char[]): void
| void Write(char[] chars, int index, int count)                 | writeCharsEx(chars: char[], index: number, count: number): void
| void Write(double value)                                       | writeDouble(value: number): void
| void Write(short value)                                        | writeInt16(value: number): void
| void Write(ushort value)                                       | writeUInt16(value: number): void
| void Write(int value)                                          | writeInt32(value: number): void
| void Write(uint value)                                         | writeUInt32(value: number): void
| void Write(long value)                                         | writeInt64(value: bigint): void
| void Write(ulong value)                                        | writeUInt64(value: bigint): void
| void Write(float value)                                        | writeSingle(value: number): void
| void Write(string value)                                       | writeString(value: string, mode?: StringMode): void
| void Write7BitEncodedInt(int value)                            | write7BitEncodedInt(value: number): void
| void Write7BitEncodedInt64(long value)                         | write7BitEncodedInt64(value: bigint): void

# Encoding
You can provide your own encoding by implementing the IEncoding interface, then pass your encoding instance to BinaryReader and BinaryWriter's constructor. You don't have to implement everything in the IEncoding interface.

# Limitations
* Dispose Pattern and Decimal are not supported.<br>
* File Buffering is not supported (please don't confuse this with Buffer class in NodeJS, they are different things).
* There is no memory optimization for writing overly long string in BinaryWriter, so to avoid massive memory allocation you should not write such string.
* writeChars and writeCharsEx will concat the array before writing, this may be slow on your system, I'm still not sure about that.
