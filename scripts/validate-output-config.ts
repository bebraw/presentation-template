const assert = require("node:assert/strict");
const path = require("node:path");
const { getOutputConfig } = require("../studio/server/services/output-config.ts");
const { listPresentations } = require("../studio/server/services/presentations.ts");

function main() {
  const presentationsState = listPresentations();
  const outputConfig = getOutputConfig();
  const expectedArchive = path.join(path.dirname(outputConfig.archiveFile), `${presentationsState.activePresentationId}.pdf`);
  const expectedBaseline = path.join(path.dirname(outputConfig.baselineDir), presentationsState.activePresentationId);
  const expectedPdf = path.join(outputConfig.outputDir, `${presentationsState.activePresentationId}.pdf`);

  assert.equal(
    outputConfig.outputBaseName,
    presentationsState.activePresentationId,
    "Output base name should follow the active presentation id"
  );
  assert.equal(
    outputConfig.pdfFile,
    expectedPdf,
    "PDF output path should be derived from the active presentation id"
  );
  assert.equal(
    outputConfig.archiveFile,
    expectedArchive,
    "Archive output path should be derived from the active presentation id"
  );
  assert.equal(
    outputConfig.baselineDir,
    expectedBaseline,
    "Render baseline path should be derived from the active presentation id"
  );

  process.stdout.write("Output config validation passed.\n");
}

main();
