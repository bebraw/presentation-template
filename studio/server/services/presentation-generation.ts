const { createStructuredResponse, getLlmConfig, getLlmStatus } = require("./llm/client.ts");
const { validateSlideSpec } = require("./slide-specs/index.ts");

const allowedGenerationModes = new Set(["auto", "local", "llm"]);
const defaultSlideCount = 5;
const maximumSlideCount = 30;

function normalizeGenerationMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return allowedGenerationModes.has(mode) ? mode : "auto";
}

function normalizeSlideCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return defaultSlideCount;
  }

  return Math.min(Math.max(1, parsed), maximumSlideCount);
}

function trimWords(value, limit = 12) {
  const words = String(value || "").replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length <= limit) {
    return words.join(" ");
  }

  return `${words.slice(0, limit).join(" ")}...`;
}

function sentence(value, fallback, limit = 14) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return trimWords(normalized || fallback, limit);
}

function slugPart(value, fallback = "item") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);

  return slug || fallback;
}

function splitList(value) {
  return String(value || "")
    .split(/\n|;|\./)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function extractUrls(value) {
  return String(value || "").match(/https?:\/\/[^\s),\]]+/g) || [];
}

function collectProvidedUrls(fields: any = {}) {
  return [
    fields.title,
    fields.audience,
    fields.objective,
    fields.constraints,
    fields.themeBrief,
    fields.outline
  ].flatMap(extractUrls);
}

function uniqueBy(values, getKey) {
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    const key = getKey(value);
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(value);
  });

  return result;
}

function fillToLength(items, length, fallbackFactory) {
  const result = items.filter(Boolean).slice(0, length);

  for (let index = result.length; index < length; index += 1) {
    result.push(fallbackFactory(index));
  }

  return result;
}

function isWeakLabel(value) {
  return /^(summary|title:?|key point|point|item|slide|section|role|body|n\/a|none)$/i.test(String(value || "").trim());
}

function isUnsupportedBibliographicClaim(value) {
  return /\b(et al\.|journal|proceedings|doi:|isbn)\b/i.test(String(value || "")) && !/https?:\/\//.test(String(value || ""));
}

function cleanText(value) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\b(title|summary|body):\s*$/i, "")
    .trim();

  return isUnsupportedBibliographicClaim(normalized) ? "" : normalized;
}

function normalizePoint(point, fallbackTitle, fallbackBody) {
  if (typeof point === "string") {
    return {
      body: cleanText(point) || fallbackBody,
      title: fallbackTitle
    };
  }

  const title = cleanText(point && point.title);
  const body = cleanText(point && point.body);

  return {
    body: body || title || fallbackBody,
    title: title && !isWeakLabel(title) ? title : fallbackTitle
  };
}

function normalizePoints(points, options: any = {}) {
  const fallbackTitle = options.fallbackTitle || "Point";
  const fallbackBody = options.fallbackBody || "Explain the idea with one concrete sentence.";
  const normalized = Array.isArray(points)
    ? points.map((point, index) => normalizePoint(point, `${fallbackTitle} ${index + 1}`, fallbackBody))
    : [];

  return uniqueBy(normalized, (point) => `${point.title.toLowerCase()}|${point.body.toLowerCase()}`);
}

function createPlanSchema(slideCount) {
  const pointSchema = {
    additionalProperties: false,
    properties: {
      body: { type: "string" },
      title: { type: "string" }
    },
    required: ["title", "body"],
    type: "object"
  };

  return {
    additionalProperties: false,
    properties: {
      outline: { type: "string" },
      references: {
        items: {
          additionalProperties: false,
          properties: {
            note: { type: "string" },
            title: { type: "string" },
            url: { type: "string" }
          },
          required: ["title", "url", "note"],
          type: "object"
        },
        maxItems: 4,
        type: "array"
      },
      slides: {
        items: {
          additionalProperties: false,
          properties: {
            keyPoints: {
              items: pointSchema,
              maxItems: 4,
              minItems: 4,
              type: "array"
            },
            role: {
              enum: ["opening", "context", "concept", "mechanics", "example", "tradeoff", "reference", "handoff"],
              type: "string"
            },
            summary: { type: "string" },
            title: { type: "string" }
          },
          required: ["title", "role", "summary", "keyPoints"],
          type: "object"
        },
        maxItems: slideCount,
        minItems: slideCount,
        type: "array"
      },
      summary: { type: "string" }
    },
    required: ["summary", "outline", "references", "slides"],
    type: "object"
  };
}

function resolveGeneration(options: any = {}) {
  const requestedMode = normalizeGenerationMode(options.generationMode || getLlmConfig().defaultGenerationMode);
  const llmStatus = getLlmStatus();

  if (requestedMode === "local") {
    return {
      available: llmStatus.available,
      fallbackReason: null,
      mode: "local",
      model: null,
      provider: "local",
      requestedMode
    };
  }

  if (requestedMode === "llm") {
    if (!llmStatus.available) {
      throw new Error(`LLM presentation generation is not configured. ${llmStatus.configuredReason || "Configure a provider or choose local generation."}`);
    }

    return {
      available: true,
      fallbackReason: null,
      mode: "llm",
      model: llmStatus.model,
      provider: llmStatus.provider,
      requestedMode
    };
  }

  if (llmStatus.available) {
    return {
      available: true,
      fallbackReason: null,
      mode: "llm",
      model: llmStatus.model,
      provider: llmStatus.provider,
      requestedMode
    };
  }

  return {
    available: false,
    fallbackReason: llmStatus.configuredReason
      ? `LLM unavailable, used local presentation generation. ${llmStatus.configuredReason}`
      : "LLM unavailable, used local presentation generation.",
    mode: "local",
    model: null,
    provider: "local",
    requestedMode
  };
}

function createLocalPlan(fields, slideCount) {
  const title = sentence(fields.title, "Untitled presentation", 8);
  const audience = sentence(fields.audience, "the intended audience", 10);
  const objective = sentence(fields.objective, `Help ${audience} understand ${title}.`, 18);
  const constraints = splitList(fields.constraints);
  const themeBrief = sentence(fields.themeBrief, "Keep the deck readable and deliberate.", 14);
  const contentRoles = ["context", "concept", "mechanics", "example", "tradeoff"];
  const slides = [];

  for (let index = 0; index < slideCount; index += 1) {
    const isFirst = index === 0;
    const isLast = index === slideCount - 1 && slideCount > 1;
    const role = isFirst ? "opening" : isLast ? "handoff" : contentRoles[(index - 1) % contentRoles.length];
    const roleTitle = ({
      concept: "Core concept",
      context: "Context and audience",
      example: "Worked example",
      handoff: "Next steps",
      mechanics: "How it works",
      opening: title,
      reference: "References to verify",
      tradeoff: "Tradeoffs and limits"
    })[role];
    const pointSeeds = [
      { title: "Objective", body: objective },
      { title: "Audience", body: audience },
      ...constraints.map((constraint, constraintIndex) => ({
        title: `Constraint ${constraintIndex + 1}`,
        body: constraint
      })),
      { title: "Theme", body: themeBrief }
    ];

    slides.push({
      keyPoints: fillToLength(pointSeeds, 4, (itemIndex) => ({
        body: `${roleTitle} should make ${title} easier to understand.`,
        title: `${roleTitle} ${itemIndex + 1}`
      })),
      role,
      summary: role === "opening"
        ? objective
        : role === "handoff"
          ? `Close with the action ${audience} should take after reviewing ${title}.`
          : `Explain ${roleTitle.toLowerCase()} for ${title}.`,
      title: roleTitle
    });
  }

  return {
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    references: collectProvidedUrls(fields).map((url, index) => ({
      note: "Source URL supplied in the presentation brief.",
      title: `Provided source ${index + 1}`,
      url
    })),
    slides,
    summary: `Generated a ${slideCount}-slide starting deck from the saved brief.`
  };
}

function toCards(planSlide, prefix, count) {
  const points = normalizePoints(planSlide.keyPoints, {
    fallbackBody: sentence(planSlide.summary, "Explain this point clearly.", 16),
    fallbackTitle: sentence(planSlide.title, "Point", 3)
  });

  return fillToLength(points, count, (index) => ({
    body: `${sentence(planSlide.title, "This slide", 6)} needs a concrete supporting point.`,
    title: `Point ${index + 1}`
  }))
    .map((point, index) => ({
      body: sentence(point.body, `Point ${index + 1}`, 13),
      id: `${prefix}-${index + 1}`,
      title: sentence(point.title, `Point ${index + 1}`, 4)
    }));
}

function roleLabel(role) {
  return ({
    concept: "Concept",
    context: "Context",
    example: "Example",
    handoff: "Handoff",
    mechanics: "Mechanics",
    opening: "Opening",
    reference: "Reference",
    tradeoff: "Tradeoff"
  })[role] || "Section";
}

function toContentSlide(planSlide, index, fields) {
  const prefix = slugPart(planSlide.title, `slide-${index}`);
  const constraints = splitList(fields.constraints);
  const guardrailPoints = fillToLength([
    {
      body: fields.audience ? `Keep examples appropriate for ${fields.audience}.` : "Keep examples matched to the intended audience.",
      title: "Audience"
    },
    {
      body: constraints[0] || "Separate factual claims from implementation advice.",
      title: "Scope"
    },
    {
      body: /reference|citation|source/i.test(fields.constraints || "")
        ? "Use only verified source URLs supplied in the brief or checked later."
        : (fields.tone ? `Keep the tone ${fields.tone}.` : "Keep the wording concise."),
      title: "Evidence"
    }
  ], 3, (guardrailIndex) => ({
    body: `Keep slide ${index} concise and evidence-led.`,
    title: `Guardrail ${guardrailIndex + 1}`
  }));

  return validateSlideSpec({
    eyebrow: roleLabel(planSlide.role),
    guardrails: guardrailPoints.map((point, guardrailIndex) => ({
      body: sentence(point.body, "Keep the argument focused.", 13),
      id: `${prefix}-guardrail-${guardrailIndex + 1}`,
      title: sentence(point.title, `Guardrail ${guardrailIndex + 1}`, 4)
    })),
    guardrailsTitle: "Guardrails",
    layout: planSlide.role === "mechanics" || planSlide.role === "example" ? "steps" : planSlide.role === "tradeoff" ? "checklist" : "standard",
    signals: toCards(planSlide, `${prefix}-signal`, 4),
    signalsTitle: "Key points",
    summary: sentence(planSlide.summary, "Explain this section clearly.", 18),
    title: sentence(planSlide.title, `Slide ${index}`, 8),
    type: "content"
  });
}

function materializePlan(fields, plan) {
  const slides = Array.isArray(plan.slides) ? plan.slides : [];
  const title = sentence(fields.title, "Untitled presentation", 8);
  const total = slides.length;
  const suppliedUrls = new Set(collectProvidedUrls(fields));
  const references = Array.isArray(plan.references)
    ? plan.references
      .filter((reference) => reference && suppliedUrls.has(String(reference.url || "").trim()))
      .slice(0, 2)
    : [];

  return slides.map((planSlide, index) => {
    const slideNumber = index + 1;
    const isFirst = index === 0;
    const isLast = index === total - 1 && total > 1;
    const prefix = slugPart(planSlide.title, `slide-${slideNumber}`);

    if (isFirst) {
      return validateSlideSpec({
        cards: toCards(planSlide, `${prefix}-card`, 3),
        eyebrow: "Opening",
        layout: "focus",
        note: sentence(fields.constraints, "Refine constraints before expanding the deck.", 18),
        summary: sentence(planSlide.summary, fields.objective || `Explain ${title}.`, 18),
        title,
        type: "cover"
      });
    }

    if (isLast) {
      const resourceItems = fillToLength(references.map((reference, referenceIndex) => ({
        body: reference.url,
        id: `${prefix}-resource-${referenceIndex + 1}`,
        title: sentence(reference.title, `Source ${referenceIndex + 1}`, 5)
      })), 2, (resourceIndex) => ({
        body: /reference|citation|source/i.test(fields.constraints || "")
          ? "Add a verified source URL before publishing."
          : "Use the saved deck context and slide notes as the next editing source.",
        id: `${prefix}-resource-${resourceIndex + 1}`,
        title: /reference|citation|source/i.test(fields.constraints || "")
          ? `Source needed ${resourceIndex + 1}`
          : `Working note ${resourceIndex + 1}`
      }));

      return validateSlideSpec({
        bullets: toCards(planSlide, `${prefix}-bullet`, 3),
        eyebrow: "Close",
        layout: "checklist",
        resources: resourceItems,
        resourcesTitle: references.length ? "References" : "Sources to verify",
        summary: sentence(planSlide.summary, "Close with the next useful action.", 18),
        title: sentence(planSlide.title, "Next steps", 8),
        type: "summary"
      });
    }

    return toContentSlide(planSlide, slideNumber, fields);
  });
}

function collectVisibleText(slideSpec) {
  return [
    slideSpec.eyebrow,
    slideSpec.title,
    slideSpec.summary,
    slideSpec.note,
    slideSpec.signalsTitle,
    slideSpec.guardrailsTitle,
    slideSpec.resourcesTitle,
    ...(slideSpec.cards || []).flatMap((item) => [item.title, item.body]),
    ...(slideSpec.signals || []).flatMap((item) => [item.title, item.body]),
    ...(slideSpec.guardrails || []).flatMap((item) => [item.title, item.body]),
    ...(slideSpec.bullets || []).flatMap((item) => [item.title, item.body]),
    ...(slideSpec.resources || []).flatMap((item) => [item.title, item.body])
  ].filter(Boolean);
}

function assertGeneratedSlideQuality(slideSpecs) {
  slideSpecs.forEach((slideSpec, slideIndex) => {
    const visibleText = collectVisibleText(slideSpec);
    const weakLabels = visibleText.filter((value) => isWeakLabel(value) || /\b(title|summary|body):\s*$/i.test(String(value)));
    if (weakLabels.length) {
      throw new Error(`Generated slide ${slideIndex + 1} contains placeholder text: ${weakLabels.join(", ")}`);
    }

    [
      slideSpec.cards || [],
      slideSpec.signals || [],
      slideSpec.guardrails || [],
      slideSpec.bullets || []
    ].forEach((items) => {
      const itemBodies = items.map((item) => String(item.body || "").toLowerCase());
      const duplicateBodies = itemBodies.filter((body, index) => body && itemBodies.indexOf(body) !== index);
      if (duplicateBodies.length) {
        throw new Error(`Generated slide ${slideIndex + 1} repeats visible card content.`);
      }
    });

    const fakeBibliographicClaims = visibleText.filter(isUnsupportedBibliographicClaim);
    if (fakeBibliographicClaims.length) {
      throw new Error(`Generated slide ${slideIndex + 1} contains unsourced bibliographic-looking claims.`);
    }
  });

  return slideSpecs;
}

async function createLlmPlan(fields, slideCount) {
  const suppliedUrls = collectProvidedUrls(fields);
  const result = await createStructuredResponse({
    developerPrompt: [
      "You generate first-draft presentation plans for a local structured-deck studio.",
      "Return JSON only and stay within the provided schema.",
      "Every key point must have a specific short title and a concrete body sentence.",
      "Do not use placeholders, dummy metrics, markdown fences, or generic filler.",
      "Do not use field labels such as title, summary, body, key point, or role as visible slide text.",
      "Do not invent academic papers, authors, journals, publication years, citations, or source URLs.",
      "Only include references whose URLs were supplied by the user. If none were supplied, return an empty references array.",
      "Make the deck useful as a first real draft for someone who gave the brief.",
      "Keep each slide concise enough for projected presentation content."
    ].join("\n"),
    maxOutputTokens: Math.max(2600, slideCount * 420),
    schema: createPlanSchema(slideCount),
    schemaName: "initial_presentation_plan",
    userPrompt: [
      `Generate exactly ${slideCount} slides for a new presentation.`,
      "",
      `Title: ${fields.title || "Untitled presentation"}`,
      `Audience: ${fields.audience || "Not specified"}`,
      `Tone: ${fields.tone || "Direct and practical"}`,
      `Objective: ${fields.objective || "Not specified"}`,
      `Constraints and opinions: ${fields.constraints || "Not specified"}`,
      `Theme brief: ${fields.themeBrief || "Not specified"}`,
      `Supplied source URLs: ${suppliedUrls.length ? suppliedUrls.join(", ") : "None"}`,
      "",
      "Use the first slide as the opening frame and the last slide as the closing handoff when there is more than one slide.",
      "For a technical teaching deck, include at least one concrete example slide and one tradeoff/limitations slide when the requested length allows it."
    ].join("\n")
  });

  return {
    model: result.model,
    plan: result.data,
    provider: result.provider,
    responseId: result.responseId
  };
}

async function generateInitialPresentation(fields: any = {}) {
  const slideCount = normalizeSlideCount(fields.targetSlideCount || fields.targetCount);
  const generation = resolveGeneration(fields);
  let plan = null;
  let response = null;

  if (generation.mode === "llm") {
    response = await createLlmPlan(fields, slideCount);
    plan = response.plan;
  } else {
    plan = createLocalPlan(fields, slideCount);
  }

  const slideSpecs = assertGeneratedSlideQuality(materializePlan(fields, plan));

  return {
    generation: {
      ...generation,
      model: response ? response.model : generation.model,
      provider: response ? response.provider : generation.provider,
      responseId: response ? response.responseId : null
    },
    outline: plan.outline || slideSpecs.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slideSpecs,
    summary: generation.mode === "llm"
      ? `Generated ${slideSpecs.length} initial slide${slideSpecs.length === 1 ? "" : "s"} with ${response.provider} ${response.model}.`
      : `Generated ${slideSpecs.length} initial slide${slideSpecs.length === 1 ? "" : "s"} with local rules${generation.fallbackReason ? `; ${generation.fallbackReason.toLowerCase()}` : ""}.`,
    targetSlideCount: slideCount
  };
}

module.exports = {
  generateInitialPresentation,
  materializePlan,
  normalizeSlideCount
};
