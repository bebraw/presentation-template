const PptxGenJS = require("pptxgenjs");
const { deckMeta, theme } = require("./theme");

const slideModules = [
  require("./slide-01"),
  require("./slide-02"),
  require("./slide-03"),
  require("./slide-04")
];

function createPresentation(options = {}) {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.author = deckMeta.author;
  pres.company = deckMeta.company;
  pres.subject = deckMeta.subject;
  pres.title = deckMeta.title;
  pres.lang = "en-US";
  pres.theme = {
    headFontFace: "Avenir Next",
    bodyFontFace: "Avenir Next",
    lang: "en-US"
  };

  const reports = [];

  for (const slideModule of slideModules) {
    const result = slideModule.createSlide(pres, theme, options);
    if (result && result.report) {
      reports.push(result.report);
    }
  }

  return { pres, reports };
}

module.exports = {
  createPresentation
};

