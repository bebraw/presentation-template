const {
  addCompactCard,
  addPageBadge,
  addSectionTitle
} = require("../generator/helpers");
const {
  createFrame,
  sectionContentFrame,
  splitColumns
} = require("../generator/layout");
const { fontFace } = require("../generator/theme");
const { createSlideCanvas } = require("../generator/validation");

const slideConfig = {
  type: "toc",
  index: 2,
  title: "Demo outline"
};

const outlineCards = [
  {
    body: "Each slide exports a single create function and keeps slide-specific content local.",
    id: "outline-structure",
    title: "Structure"
  },
  {
    body: "Theme, helpers, and layout frames define the shared visual system and spacing rules.",
    id: "outline-theme",
    title: "Shared system"
  },
  {
    body: "Build writes a PDF, while geometry, text, and render checks catch drift early.",
    id: "outline-output",
    title: "Output path"
  }
];

function createSlide(pres, theme, options = {}) {
  const canvas = createSlideCanvas(pres, slideConfig, options);
  const { slide } = canvas;
  slide.background = { color: theme.bg };

  addSectionTitle(
    canvas,
    theme,
    "Contents",
    slideConfig.title,
    "Content stays in slides/. The generator owns shared layout, rendering, and validation."
  );

  const contentFrame = sectionContentFrame({
    bottom: 4.94,
    hasBody: true,
    right: 9.34
  });
  const firstSplit = splitColumns(contentFrame, {
    gap: 0.3,
    leftWidth: 2.74
  });
  const secondSplit = splitColumns(firstSplit.right, {
    gap: 0.3,
    leftWidth: 2.74
  });
  const cardFrames = [
    createFrame({ ...firstSplit.left, y: 2.26, h: 1.84 }),
    createFrame({ ...secondSplit.left, y: 2.26, h: 1.84 }),
    createFrame({ ...secondSplit.right, y: 2.26, h: 1.84 })
  ];

  outlineCards.forEach((card, index) => {
    const frame = cardFrames[index];
    addCompactCard(canvas, pres, theme, {
      body: card.body,
      bodyFontSize: 10.1,
      bodyH: 0.76,
      bodyY: 0.5,
      h: frame.h,
      id: card.id,
      title: card.title,
      titleFontSize: 12.8,
      w: frame.w,
      x: frame.x,
      y: frame.y
    });
  });

  canvas.addText("outline-note", "Deck structure stays declarative: slide files describe content, while the runtime handles layout, rendering, and guardrails.", {
    x: contentFrame.x,
    y: 4.4,
    w: contentFrame.w,
    h: 0.32,
    color: theme.muted,
    fontFace,
    fontSize: 10.4,
    margin: 0
  }, {
    group: "outline-note",
    skipOverlap: true
  });

  addPageBadge(canvas, pres, theme, slideConfig.index);
  return canvas.finalize();
}

module.exports = { createSlide, slideConfig };
