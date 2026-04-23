function escapeString(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"");
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertNumber(value, label) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${label} must be a number`);
  }
}

function assertArray(value, label, exactLength) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  if (typeof exactLength === "number" && value.length !== exactLength) {
    throw new Error(`${label} must contain ${exactLength} items`);
  }
}

function assertCardItem(item, label) {
  assertObject(item, label);
  assertString(item.id, `${label}.id`);
  assertString(item.title, `${label}.title`);
  assertString(item.body, `${label}.body`);
}

function assertSignalItem(item, label) {
  assertObject(item, label);
  assertString(item.id, `${label}.id`);
  assertString(item.label, `${label}.label`);
  assertNumber(item.value, `${label}.value`);
}

function assertGuardrailItem(item, label) {
  assertObject(item, label);
  assertString(item.id, `${label}.id`);
  assertString(item.label, `${label}.label`);
  assertString(item.value, `${label}.value`);
}

function assertResourceItem(item, label) {
  assertObject(item, label);
  assertString(item.id, `${label}.id`);
  assertString(item.title, `${label}.title`);
  assertString(item.body, `${label}.body`);

  if (item.bodyFontSize !== undefined) {
    assertNumber(item.bodyFontSize, `${label}.bodyFontSize`);
  }
}

function validateSlideSpec(spec) {
  assertObject(spec, "slideSpec");
  assertString(spec.type, "slideSpec.type");
  assertString(spec.title, "slideSpec.title");

  switch (spec.type) {
    case "cover":
      assertString(spec.eyebrow, "slideSpec.eyebrow");
      assertString(spec.summary, "slideSpec.summary");
      assertString(spec.note, "slideSpec.note");
      assertArray(spec.cards, "slideSpec.cards", 3);
      spec.cards.forEach((item, index) => assertCardItem(item, `slideSpec.cards[${index}]`));
      break;
    case "toc":
      assertString(spec.eyebrow, "slideSpec.eyebrow");
      assertString(spec.summary, "slideSpec.summary");
      assertString(spec.note, "slideSpec.note");
      assertArray(spec.cards, "slideSpec.cards", 3);
      spec.cards.forEach((item, index) => assertCardItem(item, `slideSpec.cards[${index}]`));
      break;
    case "content":
      assertString(spec.eyebrow, "slideSpec.eyebrow");
      assertString(spec.summary, "slideSpec.summary");
      assertString(spec.signalsTitle, "slideSpec.signalsTitle");
      assertString(spec.guardrailsTitle, "slideSpec.guardrailsTitle");
      assertArray(spec.signals, "slideSpec.signals", 4);
      assertArray(spec.guardrails, "slideSpec.guardrails", 3);
      spec.signals.forEach((item, index) => assertSignalItem(item, `slideSpec.signals[${index}]`));
      spec.guardrails.forEach((item, index) => assertGuardrailItem(item, `slideSpec.guardrails[${index}]`));
      break;
    case "summary":
      assertString(spec.eyebrow, "slideSpec.eyebrow");
      assertString(spec.summary, "slideSpec.summary");
      assertString(spec.resourcesTitle, "slideSpec.resourcesTitle");
      assertArray(spec.bullets, "slideSpec.bullets", 3);
      assertArray(spec.resources, "slideSpec.resources", 2);
      spec.bullets.forEach((item, index) => assertCardItem(item, `slideSpec.bullets[${index}]`));
      spec.resources.forEach((item, index) => assertResourceItem(item, `slideSpec.resources[${index}]`));
      break;
    default:
      throw new Error(`Unsupported slide spec type "${spec.type}"`);
  }

  return spec;
}

function replaceConstArray(source, constName, items) {
  const pattern = new RegExp(`const ${constName} = \\[[\\s\\S]*?\\n\\];`);
  if (!pattern.test(source)) {
    throw new Error(`Could not find array constant ${constName}`);
  }

  const body = items.map((item) => {
    const lines = Object.entries(item).map(([key, value], index, entries) => {
      if (typeof value === "number") {
        return `    ${key}: ${value}${index < entries.length - 1 ? "," : ""}`;
      }

      return `    ${key}: "${escapeString(value)}"${index < entries.length - 1 ? "," : ""}`;
    });

    return ["  {", ...lines, "  }"].join("\n");
  }).join(",\n");

  return source.replace(pattern, `const ${constName} = [\n${body}\n];`);
}

function replaceSlideTitle(source, nextTitle) {
  return source.replace(
    /(const slideConfig = \{[\s\S]*?title:\s*")([^"]*)(")/,
    `$1${escapeString(nextTitle)}$3`
  );
}

function replaceSectionTitle(source, eyebrow, body) {
  const pattern = /addSectionTitle\(\s*canvas,\s*theme,\s*"[^"]*",\s*slideConfig\.title,\s*"[^"]*"\s*\)/;
  if (!pattern.test(source)) {
    throw new Error("Could not find addSectionTitle call");
  }

  return source.replace(pattern, [
    "addSectionTitle(",
    "    canvas,",
    "    theme,",
    `    "${escapeString(eyebrow)}",`,
    "    slideConfig.title,",
    `    "${escapeString(body)}"`,
    "  )"
  ].join("\n"));
}

function replaceAddTextValue(source, id, nextText) {
  const pattern = new RegExp(`(canvas\\.addText\\("${id}",\\s*")([^"]*)(")`);
  if (!pattern.test(source)) {
    throw new Error(`Could not find text block ${id}`);
  }

  return source.replace(pattern, `$1${escapeString(nextText)}$3`);
}

function extractSlideTypeFromSource(source) {
  const match = source.match(/type:\s*"([^"]+)"/);
  return match ? match[1] : "unknown";
}

function buildCoverSource(source, slideSpec) {
  let next = replaceSlideTitle(source, slideSpec.title);
  next = replaceConstArray(next, "capabilityCards", slideSpec.cards);
  next = replaceAddTextValue(next, "cover-eyebrow", slideSpec.eyebrow);
  next = replaceAddTextValue(next, "cover-summary", slideSpec.summary);
  next = replaceAddTextValue(next, "cover-footnote", slideSpec.note);
  return next;
}

function buildTocSource(source, slideSpec) {
  let next = replaceSlideTitle(source, slideSpec.title);
  next = replaceSectionTitle(next, slideSpec.eyebrow, slideSpec.summary);
  next = replaceConstArray(next, "outlineCards", slideSpec.cards);
  next = replaceAddTextValue(next, "outline-note", slideSpec.note);
  return next;
}

function buildContentSource(source, slideSpec) {
  let next = replaceSlideTitle(source, slideSpec.title);
  next = replaceSectionTitle(next, slideSpec.eyebrow, slideSpec.summary);
  next = replaceConstArray(next, "signalBars", slideSpec.signals);
  next = replaceConstArray(next, "guardrails", slideSpec.guardrails);
  next = replaceAddTextValue(next, "content-signals-title", slideSpec.signalsTitle);
  next = replaceAddTextValue(next, "content-guardrails-title", slideSpec.guardrailsTitle);
  return next;
}

function buildSummarySource(source, slideSpec) {
  let next = replaceSlideTitle(source, slideSpec.title);
  next = replaceSectionTitle(next, slideSpec.eyebrow, slideSpec.summary);
  next = replaceConstArray(next, "checklistItems", slideSpec.bullets);
  next = replaceConstArray(next, "resourceCards", slideSpec.resources);
  next = replaceAddTextValue(next, "summary-resources-title", slideSpec.resourcesTitle);
  return next;
}

function materializeSlideSpec(source, slideSpec) {
  const validated = validateSlideSpec(slideSpec);
  const sourceType = extractSlideTypeFromSource(source);

  if (validated.type !== sourceType) {
    throw new Error(`Slide spec type "${validated.type}" does not match source type "${sourceType}"`);
  }

  switch (validated.type) {
    case "cover":
      return buildCoverSource(source, validated);
    case "toc":
      return buildTocSource(source, validated);
    case "content":
      return buildContentSource(source, validated);
    case "summary":
      return buildSummarySource(source, validated);
    default:
      throw new Error(`Unsupported slide spec type "${validated.type}"`);
  }
}

module.exports = {
  extractSlideTypeFromSource,
  materializeSlideSpec,
  validateSlideSpec
};
