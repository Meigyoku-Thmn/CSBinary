<script src="https://embed.runkit.com"></script>

# Example of using CSBinary

<div class="runkit-example"></div>

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
      var chr = input.readChar();
      if (chr != '\0') fileName += chr;
      else break;
    }
    var paddingSize = 4 - (fileName.length + 1) % 4;
    if (paddingSize != 4)
      input.file.seek(paddingSize, SeekOrigin.Current);
    var fileSize = input.readUInt32();
    input.file.seek(fileSize + 1, SeekOrigin.Current);
    console.log(fileName);
    console.log(fileSize);
  }
})();
```

<script>
let targetElems = Array.from(document.getElementsByClassName("runkit-example"));
targetElems.forEach(targetElem => {
  let sourceElem = targetElem.nextElementSibling;
  let embed = RunKit.createNotebook({
    element: targetElem,
    source: sourceElem.textContent,
  });
  embed.onLoad = function() {
    sourceElem.style.setProperty("display", "none");
  };
});
</script>