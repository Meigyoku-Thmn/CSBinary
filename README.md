<h1 style="line-height: initial;">CSBinary – A port of BinaryReader and BinaryWriter from .NET Core to NodeJS</h1>

[(Click vào đây để đọc bản Tiếng Việt)](https://github.com/Meigyoku-Thmn/CSBinary/blob/master/README_VI.md).

[(Jump to the example section)](https://github.com/Meigyoku-Thmn/CSBinary/blob/master/README.md#example).

Let's say you want to write a program that reads and extracts data from a binary file, such as archive file, compressed file, etc. and NodeJS seems to be a very convenient platform for quickly writing a program to do so. But sadly, the NodeJS platform, which is designed with a focus on server programming, is minimalistic, it has a meager API compared to other platforms. That does not mean NodeJS doesn't have APIs to read files, but reading and writing binary files in NodeJS is very tedious:
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
The fs module does not have any function to read specific types of data from the file, it can only read/write with the Buffer type (equivalent to array type in other languages). And not to mention the NodeJS fs module doesn't really have a separate "seek" function, you have to maintain a separate position variable for passing as a parameter to the read/write functions if you want to read/write at arbitrary location. Since NodeJS is server-oriented, it doesn't have a built-in file buffering mechanism. Think if you use NodeJS to read/write a binary file with a very complex and non-linear structure, how long would the code be?

This library is a port of two very convenient APIs for reading/writing binary files from .NET Core. With this library, the code becomes concise and easier to understand, please refer to the example section below for more details.

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

## Features
Support a "seek" method to move the file pointer to any position in the file, programmers do not need to maintain any location variable. Along with a "tell" method to know where the file pointer points to.

Has methods to quickly and concisely read/write many data types such as Integer (1 byte, 2 bytes, 4 bytes, 8 bytes), Float, Double, Char, String (null-terminated, length-prefix)

Has file buffering mechanism on by default.

Has the ability to read/write string in various encodings, powered by the built-in iconv-lite.

## Installation
```bash
npm i --save csbinary
```
From version 2.1.0, this library uses prebuilt [__IA-32__](https://en.wikipedia.org/wiki/IA-32) and [__x86-64__](https://en.wikipedia.org/wiki/X86-64) native modules for [__Windows__](https://en.wikipedia.org/wiki/Microsoft_Windows), [__Linux-based OS__](https://en.wikipedia.org/wiki/Linux) and [__MacOS__](https://en.wikipedia.org/wiki/MacOS). You don't have to install any C/C++ compiler if you uses any of these systems.

But if you uses a different system than the above systems, then you need a C/C++ compiler toolchain for installing this package.
Refer to the [node-gyp repository](https://github.com/nodejs/node-gyp) to
know how to setup a compiler toolchain for your system.

## API reference
Please refer to the [CSBinary API Reference](https://meigyoku-thmn.github.io/CSBinary/).

## Examples
Please refer to the [Example page](https://github.com/Meigyoku-Thmn/CSBinary/blob/master/EXAMPLE.md).

## Encoding and File
By default, this library uses [iconv-lite](https://github.com/ashtuchkin/iconv-lite) as the internal encoding system. You can provide your own encoding by implementing the IEncoding interface,
then pass your encoding instance to BinaryReader and BinaryWriter's constructor.
You don't have to implement everything in the IEncoding interface.
Please refer to the [encoding.ts](https://github.com/Meigyoku-Thmn/CSBinary/blob/master/src/encoding.ts) file
to see what can be implemented.

Similarly, you can provide your own IFile implementation.
Please refer to the [addon/file.ts](https://github.com/Meigyoku-Thmn/CSBinary/blob/master/src/addon/file.ts) file
to see what can be implemented.

## Limitations
This libary cannot perform asynchronous i/o operation (not a popular usecase for binary files on disk anyway);

Dispose Pattern and Decimal are not supported (because there is no such thing in any Javascript engine by default);

There is no memory optimization for writing overly long string in BinaryWriter,
so to avoid massive memory allocation you should not write such string;

writeChars and writeCharsEx will concat the array before writing,
this may be slow on your system, I'm still not sure about that;

## Pitfalls
If you are going to use the same file descriptor for BinaryReader and BinaryWriter,
then you should use the same IFile instance for them, using different IFile instances
will lead to unpredictable outcome of the 2 classes:
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
If you manipulate the underlying file's position directly (by fs methods) while
using BinaryReader/BinaryWriter, unexpected error will be bound to happen.
Use the seek method of IFile instead.
But if you [disable file buffering](https://meigyoku-thmn.github.io/CSBinary/interfaces/ifile.html#setbufsize) then this is fine.
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
reader.file.read(buffer, 0, 2);

reader.close();
```
