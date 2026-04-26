function safeJson(value) {
  return JSON.stringify(value, null, 2);
}

function buildSlideTypeGuidance(slideType) {
  switch (slideType) {
    case "divider":
      return [
        "The slide family is divider.",
        "Return the requested number of variants and keep the divider structure intact.",
        "Each slideSpec must include: title."
      ].join("\n");
    case "quote":
      return [
        "The slide family is quote.",
        "Return the requested number of variants and keep one dominant quote as the visible content.",
        "Each slideSpec must include: title and quote. Attribution, source, and context are optional, but sourced quotes should keep attribution/source compact."
      ].join("\n");
    case "photo":
      return [
        "The slide family is photo.",
        "Return the requested number of variants and keep one dominant image as the visible content.",
        "Each slideSpec must include: title. Preserve the existing media object unless the current slide spec already includes a safe replacement media object. Caption is optional and should stay compact."
      ].join("\n");
    case "photoGrid":
      return [
        "The slide family is photoGrid.",
        "Return the requested number of variants and keep two to four images as the visible content.",
        "Each slideSpec must include: title and mediaItems. Preserve existing mediaItems unless the current slide spec already includes safe replacement mediaItems. Caption or summary is optional and should stay compact."
      ].join("\n");
    case "cover":
      return [
        "The slide family is cover.",
        "Return the requested number of variants and keep the cover structure intact.",
        "Each slideSpec must include: title, eyebrow, summary, note, and exactly three cards."
      ].join("\n");
    case "toc":
      return [
        "The slide family is toc.",
        "Return the requested number of variants and preserve the outline-slide structure.",
        "Each slideSpec must include: title, eyebrow, summary, note, and exactly three cards."
      ].join("\n");
    case "content":
      return [
        "The slide family is content.",
        "Return the requested number of variants and preserve the two-column evidence structure.",
        "Each slideSpec must include: title, eyebrow, summary, signalsTitle, guardrailsTitle, exactly four signals with title/body, and exactly three guardrails with title/body."
      ].join("\n");
    case "summary":
      return [
        "The slide family is summary.",
        "Return the requested number of variants and preserve the checklist-plus-resources structure.",
        "Each slideSpec must include: title, eyebrow, summary, resourcesTitle, exactly three bullets, and exactly two resources."
      ].join("\n");
    default:
      return `The slide family is ${slideType}. Preserve the current slide family structure.`;
  }
}

function buildIdeateSlidePrompts(options) {
  const developerPrompt = [
    "You are generating presentation slide variants for a local studio workflow.",
    "Return structured data only and stay within the provided schema.",
    "Do not emit JavaScript, markdown fences, or explanatory prose outside the schema.",
    "Keep the slide concise, presentation-scaled, and compatible with the existing slide family.",
    "Favor materially different framings rather than cosmetic rewrites.",
    buildSlideTypeGuidance(options.slideType)
  ].join("\n\n");

  const userPrompt = [
    `Generate ${options.candidateCount} slide variants from the current presentation context.`,
    "",
    `Slide id: ${options.slide.id}`,
    `Slide title: ${options.slide.title}`,
    `Slide type: ${options.slideType}`,
    "",
    "Deck context:",
    safeJson(options.context.deck || {}),
    "",
    "Selected slide context:",
    safeJson((options.context.slides && options.context.slides[options.slide.id]) || {}),
    "",
    "Current slide spec:",
    options.source,
    "",
    `Produce ${options.candidateCount} variants that keep the slide family structure intact, differ meaningfully in framing, and stay readable at presentation scale.`
  ].join("\n");

  return {
    developerPrompt,
    userPrompt
  };
}

function buildRedoLayoutPrompts(options) {
  const developerPrompt = [
    "You are generating presentation slide layout candidates for a local studio workflow.",
    "Return structured data only and stay within the provided schema.",
    "Do not emit JavaScript, markdown fences, or explanatory prose outside the schema.",
    "You may change the slide family only when the new family better fits the available content or media.",
    "Every family change must be explicit: identify the old family, new family, dropped fields, preserved fields, and rationale.",
    "Keep the slide concise, presentation-scaled, and compatible with the allowed structured slide families."
  ].join("\n\n");

  const userPrompt = [
    `Generate ${options.candidateCount} redo-layout candidates from the current presentation context.`,
    "",
    `Slide id: ${options.slide.id}`,
    `Slide title: ${options.slide.title}`,
    `Current slide type: ${options.slideType}`,
    "",
    "Deck context:",
    safeJson(options.context.deck || {}),
    "",
    "Selected slide context:",
    safeJson((options.context.slides && options.context.slides[options.slide.id]) || {}),
    "",
    "Current slide spec:",
    options.source,
    "",
    "Allowed slide families: divider, quote, photo, photoGrid, cover, toc, content, summary.",
    "Prefer a family-changing candidate when it improves the slide: text-heavy claims can become quote slides, image-backed slides can become photo or photoGrid slides, and section markers can become divider slides.",
    "For each candidate, state oldFamily, newFamily, droppedFields, preservedFields, and rationale. The slideSpec.type must match newFamily."
  ].join("\n");

  return {
    developerPrompt,
    userPrompt
  };
}

module.exports = {
  buildIdeateSlidePrompts,
  buildRedoLayoutPrompts
};
