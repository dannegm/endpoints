Put here the files from the `resdata` folder, called `bookinfo{LETTER}.js`
The file structure must match the following payload:

```js
var binfo = {
    <cover_id>: [
        description,   // [0] text
        pagecount,     // [1] number
        published,     // [2] year
        filename,      // [3] path with no .epub
        bitmask1,      // [4] subjects bits 0-31
        bitmask2,      // [5] subjects bits 32-63
        bitmask3,      // [6] subjects bits 64-95
    ]
  }
```
