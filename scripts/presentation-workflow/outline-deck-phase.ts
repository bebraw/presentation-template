import assert from "node:assert/strict";

type Page = import("playwright").Page;

type WorkflowSource = {
  title?: string;
};

type WorkflowOutlinePlanSection = {
  slides?: unknown[];
};

type WorkflowOutlinePlan = {
  archivedAt?: unknown;
  id?: string;
  name?: string;
  sourceScope?: {
    sources?: unknown[];
  };
  sections?: WorkflowOutlinePlanSection[];
  targetSlideCount?: number;
};

type WorkflowDeckStructureCandidate = {
  slides?: unknown[];
};

type WorkflowOutlinePlanPayload = {
  deckStructureCandidates?: WorkflowDeckStructureCandidate[];
  outlinePlan?: WorkflowOutlinePlan;
};

type WorkflowStatePayload = {
  activeOutlinePlanId?: string;
  outlinePlans?: WorkflowOutlinePlan[];
  sources?: WorkflowSource[];
};

async function waitForJsonResponse<T = unknown>(page: Page, pathPart: string, timeout = 30_000): Promise<T | null> {
  const response = await page.waitForResponse((candidate) => candidate.url().includes(pathPart), {
    timeout
  });
  const responseText = await response.text();
  assert.ok([200, 202].includes(response.status()), `${pathPart} failed: ${responseText}`);
  return responseText ? JSON.parse(responseText) as T : null;
}

async function readWorkflowState(page: Page): Promise<WorkflowStatePayload> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/state");
    return await response.json();
  });
}

function planSlideCount(plan: WorkflowOutlinePlan | undefined): number {
  return plan?.sections?.reduce((count, section) => count + (section.slides?.length || 0), 0) || 0;
}

async function assertActiveFlowUi(page: Page, expectedPlanId: string): Promise<void> {
  const metrics = await page.evaluate(() => {
    const activeCard = document.querySelector(".outline-plan-card.is-active") as HTMLElement | null;
    const activeSelect = document.querySelector(".outline-plan-active-select") as HTMLSelectElement | null;
    return {
      activeBadgeCount: document.querySelectorAll(".outline-plan-active-badge").length,
      activeCardCount: document.querySelectorAll(".outline-plan-card.is-active").length,
      activeCardTitle: activeCard?.querySelector(".outline-plan-card__title-row strong")?.textContent?.trim() || "",
      activePanelText: document.querySelector(".outline-plan-active-panel")?.textContent || "",
      activeSelectOptions: activeSelect ? Array.from(activeSelect.options).map((option) => option.value) : [],
      activeSelectValue: activeSelect?.value || ""
    };
  });

  assert.equal(metrics.activeSelectValue, expectedPlanId, "active flow selector should match persisted active flow");
  assert.equal(metrics.activeCardCount, 1, "exactly one flow card should be marked active");
  assert.equal(metrics.activeBadgeCount, 1, "exactly one active flow badge should be visible");
  assert.ok(metrics.activeSelectOptions.includes(expectedPlanId), "active flow selector should include the active flow");
  assert.ok(metrics.activePanelText.includes("Active flow:"), "active flow panel should describe the active flow");
  assert.ok(metrics.activeCardTitle, "active flow card should keep a visible title");
}

async function validateFlowLifecycleActions(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.confirm = () => true;
    window.prompt = (_message: string, defaultValue?: string) => defaultValue || "Workflow validation flow";
  });
  const before = await readWorkflowState(page);
  const originalActivePlanId = before.activeOutlinePlanId || "";
  assert.ok(originalActivePlanId, "flow lifecycle validation needs an active outline plan");
  const originalSourceCount = before.sources?.length || 0;
  const originalActivePlan = before.outlinePlans?.find((plan) => plan.id === originalActivePlanId);
  assert.ok(originalActivePlan, "active outline plan should exist before lifecycle validation");

  const duplicateResponse = waitForJsonResponse<WorkflowOutlinePlanPayload>(page, "/api/v1/outline-plans/duplicate", 60_000);
  await page.locator(".outline-plan-card.is-active .outline-plan-duplicate-button").click();
  const duplicatePayload = await duplicateResponse;
  const duplicatePlanId = duplicatePayload?.outlinePlan?.id || "";
  assert.ok(duplicatePlanId, "duplicating a flow should return the duplicate plan id");
  assert.notEqual(duplicatePlanId, originalActivePlanId, "duplicating a flow should create a separate plan");

  const duplicateState = await readWorkflowState(page);
  assert.equal(duplicateState.activeOutlinePlanId, originalActivePlanId, "duplicating a flow should not change the active flow");
  assert.equal(duplicateState.sources?.length || 0, originalSourceCount, "duplicating a flow should not move or clone shared presentation sources");
  assert.equal(
    duplicateState.outlinePlans?.find((plan) => plan.id === duplicatePlanId)?.sourceScope?.sources?.length || 0,
    originalActivePlan?.sourceScope?.sources?.length || 0,
    "flow source scope should remain metadata, not owned source records"
  );

  const setActiveResponse = waitForJsonResponse(page, "/api/v1/outline-plans/active", 60_000);
  await page.locator(".outline-plan-active-select").selectOption(duplicatePlanId);
  await setActiveResponse;
  await page.waitForFunction((expectedPlanId: string) => {
    const activeSelect = document.querySelector(".outline-plan-active-select") as HTMLSelectElement | null;
    return activeSelect?.value === expectedPlanId
      && document.querySelector(".outline-plan-card.is-active .outline-plan-active-badge")?.textContent?.includes("Active flow");
  }, duplicatePlanId);
  assert.equal((await readWorkflowState(page)).activeOutlinePlanId, duplicatePlanId, "selector should persist the duplicate as active flow");
  await assertActiveFlowUi(page, duplicatePlanId);

  const spareDuplicateResponse = waitForJsonResponse<WorkflowOutlinePlanPayload>(page, "/api/v1/outline-plans/duplicate", 60_000);
  await page.locator(".outline-plan-card.is-active .outline-plan-duplicate-button").click();
  const spareDuplicatePayload = await spareDuplicateResponse;
  const spareDuplicatePlanId = spareDuplicatePayload?.outlinePlan?.id || "";
  assert.ok(spareDuplicatePlanId, "duplicating the active flow should create a non-active flow available for deletion");
  assert.notEqual(spareDuplicatePlanId, duplicatePlanId, "spare duplicate should have its own plan id");
  assert.equal((await readWorkflowState(page)).activeOutlinePlanId, duplicatePlanId, "duplicating the active flow should leave it active");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.click("#show-studio-page");
  await page.waitForFunction(() => {
    const element = document.querySelector("#studio-page") as HTMLElement | null;
    return element instanceof HTMLElement && !element.hidden;
  });
  await page.click("#outline-drawer-toggle");
  await page.waitForSelector("#outline-drawer[data-open='true']");
  await page.click("#outline-mode-plans-tab");
  await page.waitForFunction(() => {
    const plansPanel = document.querySelector("#outline-mode-plans") as HTMLElement | null;
    return Boolean(plansPanel && !plansPanel.hidden);
  });
  await assertActiveFlowUi(page, duplicatePlanId);

  const archiveResponse = waitForJsonResponse<WorkflowOutlinePlanPayload>(page, "/api/v1/outline-plans/archive", 60_000);
  await page.locator(".outline-plan-card.is-active .outline-plan-archive-button").click();
  await archiveResponse;
  await page.waitForFunction((archivedPlanId: string) => {
    const activeSelect = document.querySelector(".outline-plan-active-select") as HTMLSelectElement | null;
    const optionValues = activeSelect ? Array.from(activeSelect.options).map((option) => option.value) : [];
    return activeSelect
      && activeSelect.value !== archivedPlanId
      && !optionValues.includes(archivedPlanId);
  }, duplicatePlanId);
  const afterArchive = await readWorkflowState(page);
  assert.notEqual(afterArchive.activeOutlinePlanId, duplicatePlanId, "archiving the active flow should select another visible flow");
  assert.ok(afterArchive.activeOutlinePlanId, "archiving the active flow should keep a non-archived active flow");
  await assertActiveFlowUi(page, afterArchive.activeOutlinePlanId || "");

  const deleteTargetId = afterArchive.outlinePlans
    ?.find((plan) => plan.id && plan.id !== afterArchive.activeOutlinePlanId && !plan.archivedAt)
    ?.id || "";
  const deleteTargetName = afterArchive.outlinePlans
    ?.find((plan) => plan.id === deleteTargetId)
    ?.name || "";
  assert.ok(deleteTargetId, "flow lifecycle validation needs a non-active flow to delete");
  assert.ok(deleteTargetName, "flow lifecycle validation needs the delete target to have a visible name");
  const deleteResponse = waitForJsonResponse<WorkflowOutlinePlanPayload>(page, "/api/v1/outline-plans/delete", 60_000);
  await page.locator(`.outline-plan-card[data-plan-id="${deleteTargetId}"] .outline-plan-delete-button`).click();
  await deleteResponse;
  await page.waitForFunction((deletedPlanId: string) => {
    const activeSelect = document.querySelector(".outline-plan-active-select") as HTMLSelectElement | null;
    const optionValues = activeSelect ? Array.from(activeSelect.options).map((option) => option.value) : [];
    return !optionValues.includes(deletedPlanId);
  }, deleteTargetId);
  const afterDelete = await readWorkflowState(page);
  assert.equal(afterDelete.activeOutlinePlanId, afterArchive.activeOutlinePlanId, "deleting a non-active flow should not change the active flow");
  assert.equal(afterDelete.sources?.length || 0, originalSourceCount, "flow lifecycle actions should keep sources presentation-shared");
}

async function validateOutlineDeckStructurePhase(page: Page): Promise<void> {
  await page.click("#show-studio-page");
  await page.waitForFunction(() => {
    const element = document.querySelector("#studio-page") as HTMLElement | null;
    return element instanceof HTMLElement && !element.hidden;
  });
  await page.click("#outline-drawer-toggle");
  await page.waitForSelector("#outline-drawer[data-open='true']");
  await page.locator(".source-details summary").click();
  await page.fill("#source-title", "Workflow follow-up source");
  await page.fill("#source-text", "Follow-up source material verifies that the Outline drawer can add grounded notes after presentation creation.");
  const addSourceResponse = waitForJsonResponse(page, "/api/v1/sources", 60_000);
  await page.click("#add-source-button");
  await addSourceResponse;
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.sources.length === 2
      && payload.sources.some((source: WorkflowSource) => source.title === "Workflow follow-up source");
  });
  await page.waitForSelector("#source-list .source-card");

  await page.click("#outline-mode-length-tab");
  await page.waitForFunction(() => {
    const lengthPanel = document.querySelector("#outline-mode-length") as HTMLElement | null;
    return Boolean(lengthPanel && !lengthPanel.hidden);
  });
  await page.fill("#deck-length-target", "2");
  const lengthPlanResponse = waitForJsonResponse(page, "/api/v1/deck/scale-length/plan", 60_000);
  await page.click("#deck-length-plan-button");
  await lengthPlanResponse;
  await page.waitForSelector("#deck-length-plan-list .variant-card");
  const applyLengthResponse = waitForJsonResponse(page, "/api/v1/deck/scale-length/apply", 120_000);
  await page.click("#deck-length-apply-button");
  await applyLengthResponse;
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.slides.length === 2 && payload.skippedSlides.length === 5;
  });
  await page.waitForSelector("#deck-length-restore-list [data-action='restore-all']", {
    timeout: 30_000
  });
  const restoreSkippedResponse = waitForJsonResponse(page, "/api/v1/slides/restore-skipped", 120_000);
  await page.click("#deck-length-restore-list [data-action='restore-all']");
  await restoreSkippedResponse;
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.slides.length === 7 && payload.skippedSlides.length === 0;
  });

  await page.click("#outline-mode-plans-tab");
  await page.waitForFunction(() => {
    const plansPanel = document.querySelector("#outline-mode-plans") as HTMLElement | null;
    return Boolean(plansPanel && !plansPanel.hidden);
  });
  const firstFlowCard = page.locator(".outline-plan-card").first();
  await firstFlowCard.locator("summary").filter({ hasText: "Edit flow settings" }).click();
  await firstFlowCard.locator(".outline-plan-settings-input").nth(1).fill("9");
  await firstFlowCard.locator(".outline-plan-settings-input").nth(2).selectOption("dense");
  const saveFlowSettingsResponse = waitForJsonResponse<WorkflowOutlinePlanPayload>(page, "/api/v1/outline-plans", 60_000);
  await firstFlowCard.locator(".outline-plan-settings-save-button").click();
  const saveFlowSettingsPayload = await saveFlowSettingsResponse;
  const savedFlow = saveFlowSettingsPayload?.outlinePlan;
  const savedFlowSlideCount = savedFlow?.sections?.reduce((count, section) => count + (section.slides?.length || 0), 0) || 0;
  assert.equal(savedFlow?.targetSlideCount, 9, "edited flow settings should save the target slide count");
  assert.equal(savedFlowSlideCount, 9, "edited flow settings should resize the structured outline beats");

  const proposeEditedFlowResponse = waitForJsonResponse<WorkflowOutlinePlanPayload>(page, "/api/v1/outline-plans/propose", 60_000);
  await page.locator(".outline-plan-active-panel button", { hasText: "Propose active flow" }).click();
  const proposeEditedFlowPayload = await proposeEditedFlowResponse;
  assert.equal(
    proposeEditedFlowPayload?.deckStructureCandidates?.[0]?.slides?.length,
    9,
    "proposing an edited stretched flow should produce one current-deck step per target slide"
  );
  await validateFlowLifecycleActions(page);

  await page.click("#outline-mode-changes-tab");
  await page.waitForFunction(() => {
    const changesPanel = document.querySelector("#outline-mode-changes") as HTMLElement | null;
    return Boolean(changesPanel && !changesPanel.hidden);
  });
  const deckPlanResponse = waitForJsonResponse(page, "/api/v1/operations/ideate-deck-structure", 120_000);
  await page.click("#ideate-deck-structure-button");
  await deckPlanResponse;
  await page.waitForSelector("#deck-structure-list .deck-plan-card");
  const applyDeckPlanResponse = waitForJsonResponse(page, "/api/v1/context/deck-structure/apply", 120_000);
  await page.locator("#deck-structure-list .deck-plan-card").first().locator("[data-action='apply']").click();
  await applyDeckPlanResponse;
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return Boolean(payload.context && payload.context.deck && payload.context.deck.structureLabel);
  });
}

export { validateOutlineDeckStructurePhase };
