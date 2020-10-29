# Ví dụ về cách sử dụng CSBinary
[(Click here to read the English version)](https://github.com/Meigyoku-Thmn/CSBinary/blob/master/EXAMPLE.md).
## Viết dữ liệu vào file, rồi đọc lên lại
[***(Thử trên Repl.it)***](https://repl.it/@Meigyoku_Thmn/CSBinary-Example)
```js
const fs = require('fs');
const { BinaryReader, BinaryWriter, File } = require('csbinary');

const bw = new BinaryWriter(File(fs.openSync('example', 'w')));
bw.writeInt32(123);
bw.writeDouble(49.25);
bw.writeBoolean(true);
bw.writeString("Hello CSBinary");

bw.close();

const br = new BinaryReader(File(fs.openSync('example')));

console.log(`Mục dữ liệu Integer: ${br.readInt32()}`);
console.log(`Mục dữ liệu Double: ${br.readDouble()}`);
console.log(`Mục dữ liệu Boolean: ${br.readBoolean()}`);
console.log(`Mục dữ liệu String: ${br.readString()}`);

br.close();
```
## Đọc với trích xuất dữ liệu từ DAR archive format 
Đọc archive file dựa trên [DAR archive format](https://wiki.xentax.com/index.php/Metal_Gear_Solid_DAR),
có được sử dụng trong game [Metal Gear Solid](https://en.wikipedia.org/wiki/Metal_Gear_Solid_(1998_video_game)).<br>
[***(Thử trên Repl.it)***](https://repl.it/@Meigyoku_Thmn/CSBinary-Example-Read-DAR-archive-format)
```js
const https = require('follow-redirects').https;
const fs = require('fs');
const file = fs.createWriteStream("example");
const { BinaryReader, File, SeekOrigin } = require('csbinary');
const url = "https://github.com/Meigyoku-Thmn/CSBinary/raw/master/sample/0example.dar";

(async function main() {
  // prepare the file
  https.get(url, response => response.pipe(file));
  await new Promise(resolve => file.on('close', resolve));

  // read the file
  const input = new BinaryReader(File(fs.openSync('example')), 'ascii');

  const nFiles = input.readUInt32();
  console.log(nFiles);
  let fileName = "";
  for (let i = 0; i < nFiles; i++) {
    fileName = "";
    while (true) {
      const chr = input.readChar();
      if (chr != '\0') fileName += chr;
      else break;
    }
    const paddingSize = 4 - (fileName.length + 1) % 4;
    if (paddingSize != 4)
      input.file.seek(paddingSize, SeekOrigin.Current);
    const fileSize = input.readUInt32();
    console.log(fileName);
    console.log(fileSize);
    const fileData = input.readBytes(fileSize);
    fs.writeFileSync(fileName, fileData);
    input.file.seek(1, SeekOrigin.Current);
  }
})();
```
## Đọc với trích xuất dữ liệu từ IWAD archive format
Đọc archive file dựa trên [IWAD archive format](https://wiki.xentax.com/index.php/WAD_IWAD),
có được sử dụng trong các game [Doom](https://en.wikipedia.org/wiki/Doom_(1993_video_game)) cũ, [Duke Nukem 3D](https://en.wikipedia.org/wiki/Duke_Nukem_3D)...<br>
Độ dài cố định của tên file ở đây là 32 byte thay vì là 8 byte.<br>
[***(Thử trên Repl.it)***](https://repl.it/@Meigyoku_Thmn/CSBinary-Example-Read-IWAD-archive-format)
```js
const https = require('follow-redirects').https;
const fs = require('fs');
const file = fs.createWriteStream("example");
const { BinaryReader, File, SeekOrigin } = require('csbinary');
const url = "https://github.com/Meigyoku-Thmn/CSBinary/raw/master/sample/0example.wad";

(async function main() {
  // prepare the file
  https.get(url, response => response.pipe(file));
  await new Promise(resolve => file.on('close', resolve));

  // read the file
  const input = new BinaryReader(File(fs.openSync('example')), 'ascii');

  input.file.seek(4, SeekOrigin.Current);
  const nFiles = input.readUInt32();
  console.log(nFiles);
  const directoryOffset = input.readUInt32();
  input.file.seek(directoryOffset, SeekOrigin.Begin);
  for (let i = 0; i < nFiles; i++) {
    const fileOffset = input.readUInt32();
    const fileSize = input.readUInt32();
    let fileName = input.readRawString(32);
    fileName = fileName.substring(0, fileName.indexOf('\0'));
    fileName = fileName.replace(/\0+$/g, '');
    const lastOffset = input.file.tell();
    input.file.seek(fileOffset, SeekOrigin.Begin);
    const fileData = input.readBytes(fileSize);
    fs.writeFileSync(fileName, fileData);
    input.file.seek(lastOffset, SeekOrigin.Begin);
    console.log(fileName);
    console.log(fileSize);
  }
})();
```
