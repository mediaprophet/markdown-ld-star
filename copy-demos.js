const fse = require('fs-extra');

const srcDir = `demos`;
const destDir = `dist/demos`;

// To copy a folder or file
fse.copySync(srcDir, destDir, { overwrite: true }, function (err) {
  if (err) {
    console.error(err);
  } else {
    console.log("Demos copied successfully!");
  }
});