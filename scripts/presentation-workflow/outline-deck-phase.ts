import assert from "node:assert/strict";

type Page = import("playwright").Page;

type WorkflowSource = {
  title?: string;
};

type WorkflowMaterial = {
  id?: string;
};

type WorkflowOutlinePlanSection = {
  slides?: unknown[];
};

type WorkflowOutlinePlan = {
  archivedAt?: unknown;
  id?: string;
  name?: string;
  presentationDensity?: string;
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
  context?: {
    deck?: {
      lineage?: {
        outlinePlanId?: string;
        sourcePresentationId?: string;
      };
      visualTheme?: unknown;
    };
  };
  creationDraft?: {
    contentRun?: {
      slideCount?: number;
    } | null;
    createdPresentationId?: string | null;
    deckPlan?: {
      slides?: unknown[];
    };
    fields?: {
      presentationDensity?: string;
      targetSlideCount?: number;
    };
  } | null;
  materials?: WorkflowMaterial[];
  outlinePlans?: WorkflowOutlinePlan[];
  presentations?: {
    activePresentationId?: string;
    presentations?: Array<{ id?: string; title?: string }>;
  };
  slides?: Array<{ id?: string; title?: string }>;
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

async function selectPresentation(page: Page, presentationId: string): Promise<void> {
  await page.evaluate(async (targetPresentationId: string) => {
    const response = await fetch("/api/v1/presentations/select", {
      body: JSON.stringify({ presentationId: targetPresentationId }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
  }, presentationId);
}

async function deletePresentation(page: Page, presentationId: string): Promise<void> {
  await page.evaluate(async (targetPresentationId: string) => {
    const response = await fetch("/api/v1/presentations/delete", {
      body: JSON.stringify({ presentationId: targetPresentationId }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
  }, presentationId);
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

async function validateDerivedDeckCreationFromFlow(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.confirm = () => true;
    window.prompt = () => "Temporary workflow smoke copy";
  });
  const sourceState = await readWorkflowState(page);
  const sourcePresentationId = sourceState.presentations?.activePresentationId || "";
  const sourceActivePlanId = sourceState.activeOutlinePlanId || "";
  const sourceActivePlan = sourceState.outlinePlans?.find((plan) => plan.id === sourceActivePlanId);
  const sourceSlideCount = sourceState.slides?.length || 0;
  const sourceSourceCount = sourceState.sources?.length || 0;
  const sourceMaterialCount = sourceState.materials?.length || 0;
  assert.ok(sourcePresentationId, "derived deck validation needs an active source presentation");
  assert.ok(sourceActivePlan, "derived deck validation needs an active source flow");
  assert.equal(sourceActivePlan?.targetSlideCount, 9, "derived deck validation should start from the edited non-default target length");

  const deriveResponse = waitForJsonResponse(page, "/api/v1/outline-plans/derive", 60_000);
  await page.locator(".outline-plan-card.is-active .outline-plan-derive-button").click();
  await deriveResponse;
  await page.waitForFunction((previousPresentationId: string) => {
    return fetch("/api/v1/state")
      .then((response) => response.json())
      .then((payload) => payload.presentations?.activePresentationId
        && payload.presentations.activePresentationId !== previousPresentationId
        && Array.isArray(payload.slides));
  }, sourcePresentationId);

  const derivedState = await readWorkflowState(page);
  const derivedPresentationId = derivedState.presentations?.activePresentationId || "";
  const derivedActivePlan = derivedState.outlinePlans?.find((plan) => plan.id === derivedState.activeOutlinePlanId);
  assert.ok(derivedPresentationId, "derive deck should activate the derived presentation");
  assert.notEqual(derivedPresentationId, sourcePresentationId, "derive deck should create a separate presentation");
  assert.equal(derivedState.slides?.length || 0, planSlideCount(sourceActivePlan), "derived deck should use one placeholder slide per source flow beat");
  assert.equal(derivedActivePlan?.targetSlideCount, sourceActivePlan?.targetSlideCount, "derived deck should seed its active flow from the source flow target");
  assert.equal(derivedActivePlan?.presentationDensity, sourceActivePlan?.presentationDensity, "derived deck should seed its active flow density from the source flow");
  assert.equal(planSlideCount(derivedActivePlan), planSlideCount(sourceActivePlan), "derived deck active flow should preserve the source flow beat count");
  assert.equal(derivedState.context?.deck?.lineage?.sourcePresentationId, sourcePresentationId, "derived deck lineage should record the source presentation");
  assert.equal(derivedState.context?.deck?.lineage?.outlinePlanId, sourceActivePlanId, "derived deck lineage should record the source flow");
  assert.equal(derivedState.sources?.length || 0, sourceSourceCount, "derive deck copy options should copy source records");
  assert.equal(derivedState.materials?.length || 0, sourceMaterialCount, "derive deck copy options should copy material records");
  assert.ok(derivedState.context?.deck?.visualTheme, "derive deck copy options should copy the active theme");

  await selectPresentation(page, sourcePresentationId);
  const restoredSourceState = await readWorkflowState(page);
  assert.equal(restoredSourceState.presentations?.activePresentationId, sourcePresentationId, "source presentation should be selectable after deriving");
  assert.equal(restoredSourceState.slides?.length || 0, sourceSlideCount, "deriving a deck should not mutate the source deck slides");
  assert.equal(restoredSourceState.activeOutlinePlanId, sourceActivePlanId, "deriving a deck should not mutate the source active flow");
  assert.equal(restoredSourceState.sources?.length || 0, sourceSourceCount, "deriving a deck should not mutate source deck sources");
  await deletePresentation(page, derivedPresentationId);

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
}

async function validateLiveDraftFromActiveFlow(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.prompt = () => "Temporary workflow smoke copy";
  });
  const sourceState = await readWorkflowState(page);
  const sourcePresentationId = sourceState.presentations?.activePresentationId || "";
  const sourceActivePlanId = sourceState.activeOutlinePlanId || "";
  const sourceActivePlan = sourceState.outlinePlans?.find((plan) => plan.id === sourceActivePlanId);
  const sourceBeatCount = planSlideCount(sourceActivePlan);
  assert.ok(sourcePresentationId, "live draft validation needs a source presentation");
  assert.ok(sourceActivePlan, "live draft validation needs an active source flow");
  assert.ok(sourceBeatCount > 0, "live draft validation needs flow beats");

  const stageResponse = waitForJsonResponse(page, "/api/v1/outline-plans/stage-creation", 60_000);
  await page.locator(".outline-plan-active-panel button", { hasText: "Live draft active" }).click();
  await stageResponse;
  await page.waitForFunction(() => {
    const element = document.querySelector("#presentations-page") as HTMLElement | null;
    return element instanceof HTMLElement && !element.hidden;
  });
  await page.waitForFunction((expectedCount: number) => {
    const targetInput = document.querySelector("#presentation-target-slides") as HTMLInputElement | null;
    const densitySelect = document.querySelector("#presentation-density") as HTMLSelectElement | null;
    return targetInput?.value === String(expectedCount)
      && densitySelect?.value === "dense"
      && document.querySelectorAll("#presentation-outline-list .creation-outline-item").length === expectedCount;
  }, sourceBeatCount);
  const stagedState = await readWorkflowState(page);
  assert.equal(stagedState.creationDraft?.fields?.targetSlideCount, sourceBeatCount, "staged live draft should inherit the active flow beat count");
  assert.equal(stagedState.creationDraft?.fields?.presentationDensity, sourceActivePlan?.presentationDensity, "staged live draft should inherit active flow density");
  assert.equal(stagedState.creationDraft?.deckPlan?.slides?.length || 0, sourceBeatCount, "staged live draft should include one outline item per flow beat");

  const createResponse = waitForJsonResponse(page, "/api/v1/presentations/draft/create", 120_000);
  await page.evaluate(() => {
    const details = document.querySelector(".presentation-create-details") as HTMLDetailsElement | null;
    if (details) {
      details.open = true;
    }
  });
  await page.click("[data-creation-stage='content']");
  await page.waitForFunction(() => {
    const contentStage = document.querySelector("#creation-stage-content") as HTMLElement | null;
    return Boolean(contentStage && !contentStage.hidden);
  });
  await page.click("#create-presentation-button");
  await createResponse;
  await page.waitForFunction((expectedCount: number) => {
    return fetch("/api/v1/state")
      .then((response) => response.json())
      .then((payload) => payload.creationDraft?.createdPresentationId
        && Array.isArray(payload.slides)
        && payload.slides.length === expectedCount
        && payload.creationDraft?.contentRun?.slideCount === expectedCount);
  }, sourceBeatCount);
  const liveState = await readWorkflowState(page);
  const livePresentationId = liveState.presentations?.activePresentationId || "";
  const liveActivePlan = liveState.outlinePlans?.find((plan) => plan.id === liveState.activeOutlinePlanId);
  assert.ok(livePresentationId, "live draft should activate the created presentation");
  assert.notEqual(livePresentationId, sourcePresentationId, "live draft should create a separate deck");
  assert.equal(liveState.creationDraft?.createdPresentationId, livePresentationId, "creation draft should point to the live deck");
  assert.equal(liveState.slides?.length || 0, sourceBeatCount, "live deck should contain one slide per flow beat");
  assert.equal(liveActivePlan?.targetSlideCount, sourceBeatCount, "live deck should keep an active flow with the staged target count");
  assert.equal(liveActivePlan?.presentationDensity, sourceActivePlan?.presentationDensity, "live deck active flow should keep the staged density");
  assert.equal(planSlideCount(liveActivePlan), sourceBeatCount, "live deck active flow should keep the staged outline beat count");

  await selectPresentation(page, sourcePresentationId);
  await deletePresentation(page, livePresentationId);
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
  await validateDerivedDeckCreationFromFlow(page);
  await validateLiveDraftFromActiveFlow(page);

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
