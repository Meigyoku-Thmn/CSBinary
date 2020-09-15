# CSBinary
I ported BinaryReader and BinaryWriter from Dotnet Core to NodeJS because reading and writing binary files non-linearly in NodeJS is very tedious.

Non-linear data processing (that means you can jump/"seek" back and forth at will all across a file to read its' data) is not a popular thing in NodeJS world (people usually do streaming instead), but when you have to, then this library will come in handy. Beside, you want to write code in a scripting language for simplicity and convenience.

You don't have to write code like this anymore:
```js
// read one byte, two bytes and four bytes
const fs = require('fs');

const fd = fs.openSync('<put your file path here>', 'r');
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
const { BinaryReader, File } = require('csbinary');

const file = File(fs.openSync('<put your file path here>', 'r'));
const reader = new BinaryReader(file);

console.log(reader.readUInt8());
console.log(reader.readUInt16());
console.log(reader.readUInt32());

reader.close();
```
# Installation
There is no package on npm yet.
```bash
npm i --save github:Meigyoku-Thmn/CSBinary#v2.0.0
```
You need a C/C++ compiler toolchain for installing this package. Refer to https://github.com/nodejs/node-gyp to know how to setup a compiler toolchain for your system.

# API reference
Please refer to the [CSBinary API Reference](https://meigyoku-thmn.github.io/CSBinary/).

# Examples
Please refer to {Create a separate example md file, embedding examples from Runkit}

# Encoding and File
You can provide your own encoding by implementing the IEncoding interface, then pass your encoding instance to BinaryReader and BinaryWriter's constructor. You don't have to implement everything in the IEncoding interface. Please refer to [encoding.ts](https://github.com/Meigyoku-Thmn/CSBinary/blob/master/src/encoding.ts) to see what can be implemented.

Similarly, you can provide your own IFile implementation. Please refer to [addon/file.ts](https://github.com/Meigyoku-Thmn/CSBinary/blob/master/src/addon/file.ts) to see what can be implemented.

# Limitations
* This libary cannot perform asynchronous i/o operation (not a popular usecase for binary files on disk anyway);
* Dispose Pattern and Decimal are not supported (because there is no such thing in any Javascript engine by default);
* There is no memory optimization for writing overly long string in BinaryWriter, so to avoid massive memory allocation you should not write such string;
* writeChars and writeCharsEx will concat the array before writing, this may be slow on your system, I'm still not sure about that;

# Pitfalls
If you are going to use the same file descriptor for BinaryReader and BinaryWriter, then you should use the same IFile instance for them, using different IFile instances will lead to unpredictable outcome of the 2 classes:
```js
const fs = require('fs');
const { BinaryReader, BinaryWriter, File } = require('csbinary');
const fd = fs.openSync(filePath, 'rw');
// this is very wrong
const reader = new BinaryReader(File(fd), 'utf8', true);
const writer = new BinaryWriter(File(fd));
// ***
reader.close();
writer.close();
```
Please use the same IFile instance for them:
```js
const fs = require('fs');
const { BinaryReader, BinaryWriter, File } = require('csbinary');
const fd = fs.openSync(filePath, 'rw');
// this is the right way
const file = File(fd);
const reader = new BinaryReader(file, 'utf8', true);
const writer = new BinaryWriter(file);
// ***
reader.close();
writer.close();
```
If you manipulate the underlying file's position directly (by fs methods) while using BinaryReader/BinaryWriter, unexpected error will be bound to happen. Use the seek method of IFile instead. But if you [disable file buffering](https://meigyoku-thmn.github.io/CSBinary/interfaces/ifile.html#setbufsize) then this is fine.
```js
const fs = require('fs');
const { BinaryReader, BinaryWriter, File, SeekOrigin } = require('csbinary');
const fd = fs.openSync(filePath, 'rw');
const file = File(fd);
const reader = new BinaryReader(file, 'utf8', true);
// don't do this unless you have disabled the file buffering
fs.readSync(fd, buffer, 0, 2, 4); // or any thing that can change the file's position
// you should do this instead
reader.file.seek(4, SeekOrigin.Begin);
// or
reader.file.read(buffer, 0, 2);

reader.close();
```
