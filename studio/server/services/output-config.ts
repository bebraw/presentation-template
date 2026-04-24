const path = require("path");
const { archiveDir, baselineRootDir, repoRoot } = require("./paths.ts");
const { getActivePresentationId } = require("./presentations.ts");

const outputDir = path.join(repoRoot, "slides", "output");

function getOutputConfig() {
  const outputBaseName = getActivePresentationId();

  return {
    archiveFile: path.join(archiveDir, `${outputBaseName}.pdf`),
    baselineDir: path.join(baselineRootDir, outputBaseName),
    outputBaseName,
    outputDir,
    pdfFile: path.join(outputDir, `${outputBaseName}.pdf`)
  };
}

module.exports = {
  archiveDir,
  getOutputConfig,
  outputDir
};
