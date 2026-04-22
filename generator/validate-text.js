const { createPresentation } = require("./deck");
const {
  validateImageAspectRatio,
  validateTextContrast,
  validateTextFit,
  validateTextPadding
} = require("./validation");

function main() {
  const { reports } = createPresentation({ trackLayout: true });
  const issues = [
    ...validateImageAspectRatio(reports),
    ...validateTextContrast(reports),
    ...validateTextFit(reports),
    ...validateTextPadding(reports)
  ];
  const errors = issues.filter((issue) => issue.level === "error");

  for (const issue of issues) {
    const writer = issue.level === "error" ? process.stderr : process.stdout;
    writer.write(`slide ${issue.slide}: ${issue.rule}: ${issue.message}\n`);
  }

  if (!issues.length) {
    process.stdout.write("Text-fit validation passed.\n");
  }

  if (errors.length) {
    process.exitCode = 1;
  }
}

main();
