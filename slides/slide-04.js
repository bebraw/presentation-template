const {
  addBulletItem,
  addCompactCard,
  addPageBadge,
  addPanel,
  addSectionTitle
} = require("../generator/helpers");
const {
  bulletItemHeight,
  createFrame,
  sectionContentFrame,
  splitColumns,
  stackInFrame
} = require("../generator/layout");
const { fontFace } = require("../generator/theme");
const { createSlideCanvas } = require("../generator/validation");

const slideConfig = {
  type: "summary",
  index: 4,
  title: "Next steps"
};

const checklistItems = [
  {
    body: "Install once for pdfkit, pptxgenjs, and the deck validation tooling.",
    id: "summary-install",
    title: "Install dependencies"
  },
  {
    body: "Run npm run build to regenerate the deck PDF after slide or helper changes.",
    id: "summary-build",
    title: "Build the deck"
  },
  {
    body: "Refresh the render baseline after intentional visual changes, then rerun the quality gate.",
    id: "summary-validate",
    title: "Validate visual changes"
  }
];

const resourceCards = [
  {
    body: "slides/output/demo-presentation.pdf",
    bodyFontSize: 11.2,
    id: "summary-output",
    title: "Local build output"
  },
  {
    body: "generator/render-baseline/ plus npm run quality:gate",
    bodyFontSize: 10.6,
    id: "summary-gate",
    title: "Approval surface"
  }
];

function createSlide(pres, theme, options = {}) {
  const canvas = createSlideCanvas(pres, slideConfig, options);
  const { slide } = canvas;
  slide.background = { color: theme.bg };

  addSectionTitle(
    canvas,
    theme,
    "Summary",
    slideConfig.title,
    "Starter path: build locally, reuse the shared primitives, and let the validators guard the PDF."
  );

  const contentFrame = sectionContentFrame({
    bottom: 4.96,
    hasBody: true,
    right: 9.28
  });
  const columns = splitColumns(contentFrame, {
    gap: 0.4,
    leftWidth: 5.08
  });

  const bulletLayout = stackInFrame(createFrame({
    x: columns.left.x,
    y: columns.left.y + 0.06,
    w: columns.left.w,
    h: columns.left.h - 0.12
  }), checklistItems.map((item) => ({
    ...item,
    height: bulletItemHeight({
      body: item.body,
      bodyH: 0.42
    })
  })), {
    gap: 0.26,
    justify: "center"
  });

  bulletLayout.forEach((item) => {
    addBulletItem(canvas, pres, theme, {
      body: item.body,
      bodyH: 0.42,
      bodyOffset: 0.28,
      id: item.id,
      title: item.title,
      titleFontSize: 12.6,
      w: item.w,
      x: item.x + 0.04,
      y: item.y
    });
  });

  addPanel(canvas, pres, theme, "summary-resources-panel", {
    fillColor: "FFFFFF",
    group: "summary-resources",
    h: columns.right.h,
    lineColor: theme.light,
    w: columns.right.w,
    x: columns.right.x,
    y: columns.right.y
  });

  canvas.addText("summary-resources-title", "Keep nearby", {
    x: columns.right.x + 0.28,
    y: columns.right.y + 0.24,
    w: columns.right.w - 0.56,
    h: 0.24,
    allCaps: true,
    bold: true,
    charSpace: 1,
    color: theme.secondary,
    fontFace,
    fontSize: 11.2,
    margin: 0
  }, {
    group: "summary-resources"
  });

  const resourceLayout = stackInFrame(createFrame({
    x: columns.right.x + 0.28,
    y: columns.right.y + 0.62,
    w: columns.right.w - 0.56,
    h: 1.92
  }), resourceCards.map((card) => ({
    ...card,
    height: 0.94
  })), {
    gap: 0.24,
    justify: "top"
  });

  resourceLayout.forEach((card) => {
    addCompactCard(canvas, pres, theme, {
      body: card.body,
      bodyFontSize: card.bodyFontSize,
      bodyH: 0.48,
      fillColor: theme.panel,
      group: "summary-resources",
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
