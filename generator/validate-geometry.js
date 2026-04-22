const { createPresentation } = require("./deck");
const {
  validateCaptionSpacing,
  validateGeometry,
  validateVerticalBalance
} = require("./validation");

function main() {
  const { reports } = createPresentation({ trackLayout: true });
  const issues = [
    ...validateGeometry(reports),
    ...validateVerticalBalance(reports),
    ...validateCaptionSpacing(reports)
  ];
  const errors = issues.filter((issue) => issue.level === "error");

  if (!issues.length) {
    process.stdout.write("Geometry validation passed.\n");
    return;
  }

  for (const issue of issues) {
    const writer = issue.level === "error" ? process.stderr : process.stdout;
    writer.write(`slide ${issue.slide}: ${issue.rule}: ${issue.message}\n`);
  }

  if (errors.length) {
    process.exitCode = 1;
  }
}

main();
