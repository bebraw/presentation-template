const path = require("path");
const { pdfFile } = require("./output-config");
const {
  createContactSheet,
  renderPdfPages
} = require("./baseline-utils");
const baselineDir = path.join(__dirname, "render-baseline");

function main() {
  const pages = renderPdfPages(baselineDir, pdfFile);
  createContactSheet(pages, path.join(baselineDir, "contact-sheet.png"));
  process.stdout.write(`${baselineDir}\n`);
}

main();
