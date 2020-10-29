<h1 style="line-height: initial;">CSBinary – Bản port cho BinaryReader và BinaryWriter từ .NET Core sang NodeJS</h1>

[(Click here to read the English version)](https://github.com/Meigyoku-Thmn/CSBinary/blob/master/README.md).

Giả sử bạn muốn viết chương trình đọc, trích xuất dữ liệu từ file nhị phân, chẳng hạn như archive file, file nén, v.v. và NodeJS có vẻ là nền tảng rất gọn nhẹ và tiện lợi để viết nhanh một chương trình làm như vậy. Nhưng đáng buồn thay, nền tảng NodeJS vốn được thiết kế chú trọng vào lập trình server, mang tính tối giản, có API ít ỏi so với những nền tảng khác. Không có nghĩa là NodeJS không có API để đọc file, nhưng để đọc được file nhị phân bằng NodeJS thì phải rất cực khổ bằng module fs như thế này:
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
Module đấy không có sẵn các hàm đọc cụ thể kiểu dữ liệu nào từ file cả mà chỉ có hàm đọc/ghi làm việc với kiểu Buffer (tương đương kiểu array trong các ngôn ngữ khác). Và chưa kể module fs của NodeJS không thực sự có chức năng "seek" riêng lẻ, bạn phải tự bảo quản một biến vị trí riêng để làm tham số cho các hàm đọc/ghi nếu bạn muốn đọc/ghi ở vị trí bất kỳ trong tập tin, và vì NodeJS thiên về server nên nó không hề có cơ chế file buffering dựng sẵn. Thử nghĩ nếu dùng NodeJS để đọc/ghi tập tin nhị phân có cấu trúc rất phức tạp và phi tuyến tính thì code sẽ dài dòng như thế nào?

Thư viện này là bản port của 2 API rất tiện lợi cho việc đọc/ghi tập tin nhị phân từ .NET Core. Bằng thư viện này, code trở nên ngắn gọn và dễ hiểu hơn, bạn có thể xem thêm phần ví dụ bên dưới để biết thêm chi tiết.
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

# Tính năng
Hỗ trợ phương thức "seek" để đưa con trỏ file tới bất kỳ vị trí nào trong tập tin, lập trình viên không cần bảo quản biến vị trí nào cả. Cùng với phương thức "tell" để 
biết con trỏ file đang ở đâu.

Có các phương thức để đọc/ghi nhanh và ngắn gọn nhiều kiểu dữ liệu như Integer (1 byte, 2 byte, 4 byte, 8 byte), Float, Double, Char, String (null-terminated, length-prefix)

Mặc định có chức năng file buffering.

Đọc/ghi chuỗi văn bản ở nhiều encoding khác nhau với khả năng từ thư viện iconv-lite dựng sẵn trong thư viện.

## Cài đặt
```bash
npm i --save csbinary
```
Kể từ version 2.1.0, thư viện này sử dụng native module build sẵn ở kiến trúc [__IA-32__](https://en.wikipedia.org/wiki/IA-32) và [__x86-64__](https://en.wikipedia.org/wiki/X86-64) cho [__Windows__](https://en.wikipedia.org/wiki/Microsoft_Windows), [__Linux-based OS__](https://en.wikipedia.org/wiki/Linux) và [__MacOS__](https://en.wikipedia.org/wiki/MacOS). Nếu bạn sử dụng những hệ thống này thì không cần phải cài trình biên dịch C/C++.

Tuy nhiên nếu bạn sử dụng hệ thống khác với các hệ thống kể trên thì bạn cần toolchain trình biên dịch C/C++ để có thể cài đặt gói thư viện này. Xem [node-gyp repository](https://github.com/nodejs/node-gyp) để biết cách cài đặt toolchain trình biên dịch cho hệ thống mà bạn dùng.

## Tham khảo API
Xin ghé xem [CSBinary API Reference](https://meigyoku-thmn.github.io/CSBinary/) (Tiếng Anh).

## Ví dụ
Xin xem tại [Example page](https://github.com/Meigyoku-Thmn/CSBinary/blob/master/EXAMPLE_VI.md).

## Encoding và File
Mặc định thì thư viện này sử dụng [iconv-lite](https://github.com/ashtuchkin/iconv-lite) làm hệ thống encoding nội bộ. Bạn có thể đưa encoding của chính bạn vào bằng cách "thực hiện" giao diện IEncoding, rồi đưa encoding instance của bạn vào constructor của BinaryReader và BinaryWriter.
Xin hãy xem file [encoding.ts](https://github.com/Meigyoku-Thmn/CSBinary/blob/master/src/encoding.ts) để biết cần phải thực hiện cái gì.

Tương tự vậy, bạn có thể dùng bản thực hiện của riêng mình cho IFile.
Xin hãy xem file [addon/file.ts](https://github.com/Meigyoku-Thmn/CSBinary/blob/master/src/addon/file.ts) để biết cần phải thực hiện những thứ gì.

## Hạn chế
Thư viện này không thể thực thi thao tác nhập/xuất bất đồng bộ.

Không hỗ trợ Dispose Pattern và kiểu dữ liệu Decimal, do những thứ này không tồn tại mặc định trong bất kỳ engine Javascript nào

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
