const {
  addAccentRule,
  addCompactCard,
  addPageBadge
} = require("../generator/helpers");
const {
  boxBelow,
  centeredTextBlock,
  createFrame,
  insetFrame,
  splitColumns,
  stackInFrame
} = require("../generator/layout");
const { fontFace } = require("../generator/theme");
const { createSlideCanvas } = require("../generator/validation");

const slideConfig = {
  type: "cover",
  index: 1,
  title: "Presentation Template Demo"
};

const capabilityCards = [
  {
    body: "Slides stay as small CommonJS modules with one exported entry point.",
    id: "cover-card-slides",
    title: "Slide modules"
  },
  {
    body: "Shared helpers and layout frames keep spacing decisions out of individual slides.",
    id: "cover-card-layout",
    title: "Layout primitives"
  },
  {
    body: "Geometry, text-fit, and render checks keep PDF output stable as the deck evolves.",
    id: "cover-card-validation",
    title: "Validation gate"
  }
];

function createSlide(pres, theme, options = {}) {
  const canvas = createSlideCanvas(pres, slideConfig, options);
  const { slide } = canvas;
  slide.background = { color: theme.bg };

  const mainFrame = createFrame({
    x: 0.62,
    y: 0.46,
    w: 8.76,
    h: 4.72
  });
  const columns = splitColumns(mainFrame, {
    gap: 0.42,
    leftWidth: 5.28
  });
  const copyFrame = insetFrame(columns.left, {
    bottom: 0.24,
    right: 0.18,
    top: 0.06
  });
  const cardsFrame = insetFrame(columns.right, {
    bottom: 0.28,
    top: 0.22
  });

  addAccentRule(canvas, pres, theme, {
    force: true,
    group: "cover-header",
    id: "cover-rule",
    w: 2.18,
    x: copyFrame.x,
    y: copyFrame.y
  });

  canvas.addText("cover-eyebrow", "pdf-slide-generator skill", {
    x: copyFrame.x,
    y: 0.82,
    w: 3.5,
    h: 0.24,
    allCaps: true,
    bold: true,
    charSpace: 1.1,
    color: theme.secondary,
    fontFace,
    fontSize: 11.2,
    margin: 0
  }, {
    group: "cover-header"
  });

  const titleBox = centeredTextBlock(createFrame({
    x: copyFrame.x,
    y: 1.16,
    w: 4.96,
    h: 0.96
  }), slideConfig.title, {
    bold: true,
    fontFace,
    fontSize: 26,
    minHeight: 0.74
  });

  canvas.addText("cover-title", slideConfig.title, {
    ...titleBox,
    color: theme.primary,
    fontFace,
    fontSize: 26,
    bold: true,
    margin: 0
  }, {
    group: "cover-header"
  });

  const summaryBox = boxBelow(titleBox, {
    gap: 0.34,
    h: 0.76,
    w: 4.7
  });

  canvas.addText("cover-summary", "A compact deck showing the imported skill, the new layout engine, and the native PDF build flow.", {
    ...summaryBox,
    color: theme.muted,
    fontFace,
    fontSize: 12.3,
    margin: 0
  }, {
    group: "cover-summary"
  });

  canvas.addText("cover-footnote", "Slides are authored once and reused across PDF rendering, geometry checks, and render validation.", {
    x: copyFrame.x,
    y: 4.28,
    w: 4.96,
    h: 0.42,
    color: theme.muted,
    fontFace,
    fontSize: 10.5,
    margin: 0
  }, {
    group: "cover-footer"
  });

  const cardLayout = stackInFrame(cardsFrame, capabilityCards.map((card) => ({
    ...card,
    height: 0.94
  })), {
    gap: 0.22,
    justify: "center"
  });

  cardLayout.forEach((card) => {
    addCompactCard(canvas, pres, theme, {
      body: card.body,
      bodyFontSize: 10,
      bodyH: 0.4,
      h: 0.94,
      id: card.id,
      title: card.title,
      titleFontSize: 12,
      w: card.w,
      x: card.x,
      y: card.y
    });
  });

  addPageBadge(canvas, pres, theme, slideConfig.index);
  return canvas.finalize();
}

module.exports = { createSlide, slideConfig };
