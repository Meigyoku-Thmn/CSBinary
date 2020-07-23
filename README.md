# CSBinary
I ported BinaryReader and BinaryWriter from Dotnet Core to NodeJS because reading and writing binary files non-linearly in NodeJS is very tedious.

Non-linear data processing (that means you can jump/"seek" all across a file to read its' data) is not a popular thing in NodeJS worlds (people usually do streaming instead), but when you have to, then this library will come in handy. Beside, you want to write code in a scripting language for simplicity and convenience.

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
