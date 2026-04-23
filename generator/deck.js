const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");
const { createSlideFromSpec } = require("../slides/render-slide-spec");
const { bodyFont, deckMeta, displayFont, theme } = require("./theme");

const slidesDir = path.join(__dirname, "..", "slides");

function compareNames(left, right) {
  return left.localeCompare(right, undefined, { numeric: true });
}

function readSlideSpec(fileName) {
  return JSON.parse(fs.readFileSync(fileName, "utf8"));
}

function getJsonSlideSpecs() {
  return fs.readdirSync(slidesDir)
    .filter((fileName) => /^slide-\d+\.json$/.test(fileName))
    .sort(compareNames)
    .map((fileName) => readSlideSpec(path.join(slidesDir, fileName)));
}

function populatePresentation(pres, theme, options = {}) {
  const reports = [];

  for (const slideSpec of getJsonSlideSpecs()) {
    const result = createSlideFromSpec(pres, theme, slideSpec, options);
    if (result && result.report) {
      reports.push(result.report);
    }
    if (result && Array.isArray(result.reports)) {
      reports.push(...result.reports);
    }
  }

  return { pres, reports };
}

function createPresentation(options = {}) {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.author = deckMeta.author;
  pres.company = deckMeta.company;
  pres.subject = deckMeta.subject;
  pres.title = deckMeta.title;
  pres.lang = "en-US";
  pres.theme = {
    headFontFace: displayFont,
    bodyFontFace: bodyFont,
    lang: "en-US"
  };

  return populatePresentation(pres, theme, options);
}

module.exports = {
  createPresentation,
  populatePresentation
};
