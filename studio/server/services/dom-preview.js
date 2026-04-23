const { resolveTheme } = require("../../../generator/theme");
const { getDeckContext } = require("./state");
const { getSlides, readSlideSpec } = require("./slides");
const { renderDeckDocument } = require("../../client/slide-dom");

function getDomPreviewState() {
  const context = getDeckContext();
  const slides = getSlides().map((slide) => {
    try {
      return {
        id: slide.id,
        index: slide.index,
        slideSpec: readSlideSpec(slide.id),
        title: slide.title
      };
    } catch (error) {
      return {
        id: slide.id,
        index: slide.index,
        slideSpec: null,
        title: slide.title
      };
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    slides,
    theme: resolveTheme(context && context.deck && context.deck.visualTheme),
    title: context && context.deck && context.deck.title ? context.deck.title : "Presentation Studio"
  };
}

function renderDomPreviewDocument() {
  const previewState = getDomPreviewState();
  return renderDeckDocument(previewState);
}

module.exports = {
  getDomPreviewState,
  renderDomPreviewDocument
};
