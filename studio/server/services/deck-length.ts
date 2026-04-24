const {
  compactActiveSlideIndices,
  getSlides,
  readSlideSpec,
  restoreSkippedSlide,
  skipStructuredSlide
} = require("./slides.ts");

const allowedModes = new Set(["appendix-first", "balanced", "front-loaded", "manual"]);

function normalizeMode(value) {
  return allowedModes.has(value) ? value : "balanced";
}

function normalizeTargetCount(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, parsed);
}

function getSkippedSlides() {
  return getSlides({ includeSkipped: true })
    .filter((slide) => slide.skipped && !slide.archived)
    .sort((left, right) => {
      const leftIndex = Number(left.skipMeta && left.skipMeta.previousIndex);
      const rightIndex = Number(right.skipMeta && right.skipMeta.previousIndex);

      if (Number.isFinite(leftIndex) && Number.isFinite(rightIndex) && leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      if (left.index !== right.index) {
        return left.index - right.index;
      }

      return left.id.localeCompare(right.id);
    });
}

function classifySlide(slide, slideSpec) {
  const text = [
    slide.title,
    slideSpec.eyebrow,
    slideSpec.summary,
    slideSpec.note,
    slideSpec.resourcesTitle
  ].join(" ").toLowerCase();

  if (/(appendix|reference|resource|archive|implementation|codebase|technical|detail|diagnostic|maintenance|roadmap|next improvement)/.test(text)) {
    return "supporting detail";
  }

  if (/(summary|closing|next step|handoff|decision|validation|workflow|overview|tour|map)/.test(text)) {
    return "narrative anchor";
  }

  return "supporting slide";
}

function scoreSkipCandidate(slide, slideSpec, activeCount, mode) {
  const label = classifySlide(slide, slideSpec);
  let score = 0;

  if (label === "supporting detail") {
    score += 40;
  } else if (label === "narrative anchor") {
    score -= 30;
  } else {
    score += 10;
  }

  if (slideSpec.type === "content") {
    score += 12;
  }
  if (slideSpec.type === "summary" || slideSpec.type === "cover") {
    score -= 35;
  }

  const midpoint = (activeCount + 1) / 2;
  score += Math.max(0, 12 - Math.abs(slide.index - midpoint));

  if (mode === "front-loaded") {
    score += slide.index > midpoint ? 16 : -8;
  }

  if (mode === "appendix-first" && label === "supporting detail") {
    score += 24;
  }

  if (slide.index === 1 || slide.index === activeCount) {
    score -= 200;
  }

  return score;
}

function reasonForSkip(slide, slideSpec, mode) {
  const label = classifySlide(slide, slideSpec);

  if (label === "supporting detail") {
    return "Supporting detail can be restored when the deck has more room.";
  }

  if (mode === "front-loaded") {
    return "Later narrative detail can be skipped for a shorter front-loaded version.";
  }

  if (mode === "appendix-first") {
    return "Reference-like material is a good first candidate for a shorter deck.";
  }

  return "Balanced scaling keeps the deck arc while trimming secondary material.";
}

function createSkipActions(activeSlides, targetCount, mode) {
  const skipCount = Math.max(0, activeSlides.length - targetCount);
  if (!skipCount) {
    return [];
  }

  return activeSlides
    .map((slide) => {
      const slideSpec = readSlideSpec(slide.id);
      const score = scoreSkipCandidate(slide, slideSpec, activeSlides.length, mode);

      return {
        action: "skip",
        confidence: score > 45 ? "high" : score > 15 ? "medium" : "low",
        reason: reasonForSkip(slide, slideSpec, mode),
        score,
        slideId: slide.id,
        title: slide.title
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.slideId.localeCompare(left.slideId);
    })
    .slice(0, skipCount)
    .map(({ score, ...entry }) => entry);
}

function createRestoreActions(skippedSlides, restoreCount) {
  return skippedSlides.slice(0, Math.max(0, restoreCount)).map((slide) => ({
    action: "restore",
    confidence: "medium",
    reason: slide.skipReason || "Restores a slide hidden by a previous length-scaling pass.",
    slideId: slide.id,
    title: slide.title
  }));
}

function planDeckLength(options: any = {}) {
  const activeSlides = getSlides();
  const skippedSlides = getSkippedSlides();
  const targetCount = normalizeTargetCount(options.targetCount, activeSlides.length);
  const mode = normalizeMode(options.mode);
  const restoreCount = Math.max(0, targetCount - activeSlides.length);
  const actions = targetCount < activeSlides.length
    ? createSkipActions(activeSlides, targetCount, mode)
    : createRestoreActions(skippedSlides, restoreCount);
  const nextCount = activeSlides.length
    - actions.filter((entry) => entry.action === "skip").length
    + actions.filter((entry) => entry.action === "restore").length;

  return {
    actions,
    currentCount: activeSlides.length,
    mode,
    nextCount,
    restoreCandidates: options.includeSkippedForRestore === false ? [] : skippedSlides.map((slide) => ({
      previousIndex: slide.skipMeta && slide.skipMeta.previousIndex,
      reason: slide.skipReason || "",
      slideId: slide.id,
      skippedAt: slide.skipMeta && slide.skipMeta.skippedAt,
      title: slide.title
    })),
    skippedCount: skippedSlides.length,
    summary: actions.length
      ? `${actions.filter((entry) => entry.action === "skip").length} slide${actions.filter((entry) => entry.action === "skip").length === 1 ? "" : "s"} to skip, ${actions.filter((entry) => entry.action === "restore").length} to restore.`
      : "The active deck already matches the requested length.",
    targetCount
  };
}

function createLengthProfile(targetCount) {
  const activeSlides = getSlides();
  const skippedSlides = getSkippedSlides();

  return {
    activeCount: activeSlides.length,
    skippedCount: skippedSlides.length,
    targetCount,
    updatedAt: new Date().toISOString()
  };
}

function applyDeckLengthPlan(options: any = {}) {
  const targetCount = normalizeTargetCount(options.targetCount, getSlides().length);
  const actions = Array.isArray(options.actions) && options.actions.length
    ? options.actions
    : planDeckLength({
        includeSkippedForRestore: true,
        mode: options.mode,
        targetCount
      }).actions;
  let restoredSlides = 0;
  let skippedSlides = 0;

  actions.forEach((entry) => {
    if (!entry || typeof entry.slideId !== "string" || !entry.slideId) {
      return;
    }

    if (entry.action === "skip") {
      skipStructuredSlide(entry.slideId, {
        reason: entry.reason,
        targetCount
      });
      skippedSlides += 1;
      return;
    }

    if (entry.action === "restore") {
      restoreSkippedSlide(entry.slideId);
      restoredSlides += 1;
    }
  });

  compactActiveSlideIndices();

  return {
    actions,
    lengthProfile: createLengthProfile(targetCount),
    restoredSlides,
    skippedSlides,
    slides: getSlides()
  };
}

function restoreSkippedSlides(options: any = {}) {
  const skippedSlides = getSkippedSlides();
  const skippedIds = new Set(skippedSlides.map((slide) => slide.id));
  const ids = options.all === true
    ? skippedSlides.map((slide) => slide.id)
    : Array.isArray(options.slideIds)
      ? options.slideIds
      : typeof options.slideId === "string" && options.slideId
        ? [options.slideId]
        : [];
  const uniqueIds = [...new Set(ids)];

  let restoredSlides = 0;

  uniqueIds.forEach((slideId) => {
    if (skippedIds.has(slideId)) {
      restoredSlides += 1;
    }

    restoreSkippedSlide(slideId);
  });
  compactActiveSlideIndices();

  return {
    lengthProfile: createLengthProfile(getSlides().length),
    restoredSlides,
    slides: getSlides()
  };
}

module.exports = {
  applyDeckLengthPlan,
  planDeckLength,
  restoreSkippedSlides
};
