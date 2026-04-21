const { createPresentation } = require("./deck");
const { validateGeometry } = require("./validation");

function main() {
  const { reports } = createPresentation({ trackLayout: true });
  const issues = validateGeometry(reports);

  if (!issues.length) {
    process.stdout.write("Geometry validation passed.\n");
    return;
  }

  for (const issue of issues) {
    process.stderr.write(`slide ${issue.slide}: ${issue.rule}: ${issue.message}\n`);
  }

  process.exitCode = 1;
}

main();

