const path = require("path");
const { repoRoot } = require("./paths.ts");
const { getActivePresentationId } = require("./presentations.ts");

const outputDir = path.join(repoRoot, "slides", "output");

function getOutputConfig() {
  const outputBaseName = getActivePresentationId();

  return {
    outputBaseName,
    outputDir,
    pdfFile: path.join(outputDir, `${outputBaseName}.pdf`)
  };
}

module.exports = {
  getOutputConfig,
  outputDir
};
