const PptxGenJS = require("pptxgenjs");
const { bodyFont, deckMeta, displayFont, theme } = require("./theme");

const slideModules = [
  require("../slides/slide-01"),
  require("../slides/slide-02"),
  require("../slides/slide-03"),
  require("../slides/slide-04")
];

function populatePresentation(pres, theme, options = {}) {
  const reports = [];

  for (const slideModule of slideModules) {
    const result = slideModule.createSlide(pres, theme, options);
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
