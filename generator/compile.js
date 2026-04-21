const fs = require("fs");
const { createPdfPresentation } = require("./pdf-renderer");
const { outputDir, pdfFile } = require("./output-config");

async function main() {
  const { pres } = createPdfPresentation();
  fs.mkdirSync(outputDir, { recursive: true });
  await pres.writeFile({ fileName: pdfFile });
  process.stdout.write(`${pdfFile}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
