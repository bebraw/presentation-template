const fs = require("fs");
const { getActivePresentationPaths } = require("./presentations.ts");
const {
  ensureAllowedDir,
  writeAllowedJson
} = require("./write-boundary.ts");

const schemaVersion = 1;
const knownTreatments = new Set(["callout", "checklist", "focus", "standard", "steps", "strip"]);
const supportedSlideTypes = new Set(["cover", "toc", "content", "summary"]);
const defaultLayouts = {
  layouts: []
};

function slugPart(value, fallback = "layout") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || fallback;
}

function readJson(fileName, fallback) {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function ensureLayoutState() {
  const paths = getActivePresentationPaths();
  ensureAllowedDir(paths.stateDir);
}

function normalizeLayout(layout) {
  const source = layout && typeof layout === "object" ? layout : {};
  const treatment = String(source.treatment || "").trim() || "standard";
  if (!knownTreatments.has(treatment)) {
    throw new Error(`Layout treatment must be one of: ${Array.from(knownTreatments).join(", ")}`);
  }

  const supportedTypes = Array.isArray(source.supportedTypes)
    ? source.supportedTypes.filter((type) => supportedSlideTypes.has(type))
    : [];

  if (!supportedTypes.length) {
    throw new Error("Layout must support at least one known slide family");
  }

  const now = new Date().toISOString();
  const name = String(source.name || treatment).replace(/\s+/g, " ").trim();
  const id = String(source.id || slugPart(name, treatment)).replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");

  return {
    schemaVersion,
    id: id || slugPart(treatment),
    name: name || treatment,
    description: String(source.description || "").replace(/\s+/g, " ").trim(),
    supportedTypes,
    treatment,
    createdAt: source.createdAt || now,
    updatedAt: source.updatedAt || now
  };
}

function readLayouts() {
  const state = readJson(getActivePresentationPaths().layoutsFile, defaultLayouts);
  const layouts = Array.isArray(state.layouts)
    ? state.layouts.map((layout) => normalizeLayout(layout))
    : [];
  return { layouts };
}

function writeLayouts(nextState) {
  ensureLayoutState();
  const normalized = {
    layouts: Array.isArray(nextState.layouts)
      ? nextState.layouts.map((layout) => normalizeLayout(layout))
      : []
  };
  writeAllowedJson(getActivePresentationPaths().layoutsFile, normalized);
  return normalized;
}

function createLayoutFromSlideSpec(slideSpec, fields: any = {}) {
  const slideType = slideSpec && slideSpec.type ? slideSpec.type : "";
  if (!supportedSlideTypes.has(slideType)) {
    throw new Error(`Saved layouts do not support slide type "${slideType}" yet`);
  }

  const treatment = String(slideSpec.layout || "standard").trim() || "standard";
  const now = new Date().toISOString();
  const name = String(fields.name || `${treatment} ${slideType}`).replace(/\s+/g, " ").trim();
  return normalizeLayout({
    schemaVersion,
    id: fields.id || `${slugPart(name, "layout")}-${Date.now().toString(36)}`,
    name,
    description: fields.description || `Saved ${treatment} treatment for ${slideType} slides.`,
    supportedTypes: [slideType],
    treatment,
    createdAt: now,
    updatedAt: now
  });
}

function saveLayoutFromSlideSpec(slideSpec, fields: any = {}) {
  const current = readLayouts();
  const layout = createLayoutFromSlideSpec(slideSpec, fields);
  const withoutExisting = current.layouts.filter((entry) => entry.id !== layout.id);
  return {
    layout,
    state: writeLayouts({ layouts: [...withoutExisting, layout] })
  };
}

function getLayout(layoutId) {
  const layouts = readLayouts().layouts;
  const layout = layouts.find((entry) => entry.id === layoutId);
  if (!layout) {
    throw new Error(`Unknown layout "${layoutId}"`);
  }
  return layout;
}

function applyLayoutToSlideSpec(slideSpec, layoutId) {
  const layout = getLayout(layoutId);
  const slideType = slideSpec && slideSpec.type ? slideSpec.type : "";
  if (!layout.supportedTypes.includes(slideType)) {
    throw new Error(`Layout "${layout.name}" does not support slide type "${slideType}"`);
  }

  return {
    ...slideSpec,
    layout: layout.treatment
  };
}

module.exports = {
  applyLayoutToSlideSpec,
  knownTreatments,
  readLayouts,
  saveLayoutFromSlideSpec,
  supportedSlideTypes,
  _test: {
    normalizeLayout
  }
};
