<script src="https://embed.runkit.com"></script>

# Example of using CSBinary



<div class="runkit-example"></div>

```js
// prepare the file
const http = require('https');
const fs = require('fs');
const file = fs.createWriteStream("example");
const url = "https://github.com/Meigyoku-Thmn/CSBinary/raw/master/sample/0example.dar";
const request = http.get(url, response => response.pipe(file));
await new Promise(resolve => file.on('close', resolve));

// read the file
const { BinaryReader, File } = require('csbinary');
const br = new BinaryReader(File(fs.openSync('example')), 'ascii');

const nFiles = br.readUInt32();
nFiles;
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