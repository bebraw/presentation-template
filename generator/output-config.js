const path = require("path");

const outputDir = path.join(__dirname, "..", "slides", "output");
const outputBaseName = "demo-presentation";
const pdfFile = path.join(outputDir, `${outputBaseName}.pdf`);

module.exports = {
  outputBaseName,
  outputDir,
  pdfFile
};
