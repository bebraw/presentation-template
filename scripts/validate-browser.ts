const { runPresentationWorkflowValidation } = require("./validate-presentation-workflow.ts");
const { runStudioLayoutValidation } = require("./validate-studio-layout.ts");

async function main() {
  const { server } = await runPresentationWorkflowValidation({ keepServerOpen: true });

  try {
    await runStudioLayoutValidation({ server });
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
