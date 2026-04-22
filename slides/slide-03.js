const {
  addPageBadge,
  addPanel,
  addSectionTitle,
  addStatChip
} = require("../generator/helpers");
const {
  createFrame,
  sectionContentFrame,
  splitColumns,
  stackInFrame
} = require("../generator/layout");
const { fontFace } = require("../generator/theme");
const { createSlideCanvas } = require("../generator/validation");

const slideConfig = {
  type: "content",
  index: 3,
  title: "Why this setup works"
};

const signalBars = [
  { id: "signal-slides", label: "Slides", value: 0.94 },
  { id: "signal-runtime", label: "Runtime", value: 0.89 },
  { id: "signal-layout", label: "Layout", value: 0.91 },
  { id: "signal-validation", label: "Validation", value: 0.87 }
];

const statChips = [
  { id: "stat-modules", label: "slide modules", value: "4" },
  { id: "stat-build", label: "PDF build path", value: "1" },
  { id: "stat-pptx", label: "PPTX outputs", value: "0" }
];

function addSignalBar(canvas, pres, theme, options = {}) {
  const {
    group,
    label,
    value,
    x,
    y,
    w
  } = options;
  const trackX = x + 1.1;
  const trackW = w - 1.74;

  canvas.addText(`${group}-label`, label, {
    x,
    y,
    w: 1,
    h: 0.22,
    color: theme.primary,
    fontFace,
    fontSize: 10.2,
    margin: 0
  }, {
    group: "content-signals"
  });

  canvas.addShape(`${group}-track`, pres.ShapeType.roundRect, {
    x: trackX,
    y: y + 0.04,
    w: trackW,
    h: 0.14,
    rectRadius: 0.04,
    line: { color: theme.light, transparency: 100 },
    fill: { color: theme.light }
  }, {
    group: "content-signals"
  });

  canvas.addShape(`${group}-fill`, pres.ShapeType.roundRect, {
    x: trackX,
    y: y + 0.04,
    w: trackW * value,
    h: 0.14,
    rectRadius: 0.04,
    line: { color: theme.secondary, transparency: 100 },
    fill: { color: theme.secondary }
  }, {
    group: "content-signals"
  });

  canvas.addText(`${group}-value`, `${Math.round(value * 100)}%`, {
    x: x + w - 0.48,
    y: y - 0.02,
    w: 0.48,
    h: 0.24,
    align: "right",
    color: theme.muted,
    fontFace,
    fontSize: 10,
    margin: 0
  }, {
    group: "content-signals"
  });
}

function createSlide(pres, theme, options = {}) {
  const canvas = createSlideCanvas(pres, slideConfig, options);
  const { slide } = canvas;
  slide.background = { color: "ffffff" };

  addSectionTitle(
    canvas,
    theme,
    "Signals",
    slideConfig.title,
    "Repeatability comes from native PDF rendering, explicit slide modules, and a render-based gate."
  );

  const contentFrame = sectionContentFrame({
    bottom: 4.96,
    hasBody: true,
    right: 9.28
  });
  const columns = splitColumns(contentFrame, {
    gap: 0.36,
    leftWidth: 4.58
  });

  addPanel(canvas, pres, theme, "content-signals-panel", {
    fillColor: theme.panel,
    group: "content-signals",
    h: columns.left.h,
    lineColor: theme.light,
    w: columns.left.w,
    x: columns.left.x,
    y: columns.left.y
  });

  canvas.addText("content-signals-title", "Migration signals", {
    x: columns.left.x + 0.28,
    y: columns.left.y + 0.24,
    w: 2.2,
    h: 0.26,
    color: theme.primary,
    fontFace,
    fontSize: 12.2,
    bold: true,
    margin: 0
  }, {
    group: "content-signals"
  });

  const signalLayout = stackInFrame(createFrame({
    x: columns.left.x + 0.28,
    y: columns.left.y + 0.72,
    w: columns.left.w - 0.56,
    h: 1.42
  }), signalBars.map((bar) => ({
    ...bar,
    height: 0.22
  })), {
    gap: 0.26,
    justify: "top"
  });

  signalLayout.forEach((bar) => {
    addSignalBar(canvas, pres, theme, {
      group: bar.id,
      label: bar.label,
      value: bar.value,
      w: bar.w,
      x: bar.x,
      y: bar.y
    });
  });

  canvas.addText("content-signals-note", "The shared generator now owns layout frames as well, so slide code can stay focused on message and hierarchy.", {
    x: columns.left.x + 0.28,
    y: columns.left.y + 2.32,
    w: columns.left.w - 0.56,
    h: 0.42,
    color: theme.muted,
    fontFace,
    fontSize: 10.3,
    margin: 0
  }, {
    group: "content-signals"
  });

  addPanel(canvas, pres, theme, "content-stats-panel", {
    fillColor: "FFFFFF",
    group: "content-stats",
    h: columns.right.h,
    lineColor: theme.secondary,
    linePt: 1.1,
    w: columns.right.w,
    x: columns.right.x,
    y: columns.right.y
  });

  canvas.addText("content-stats-title", "Operational guardrails", {
    x: columns.right.x + 0.28,
    y: columns.right.y + 0.24,
    w: columns.right.w - 0.56,
    h: 0.26,
    color: theme.primary,
    fontFace,
    fontSize: 12.2,
    bold: true,
    margin: 0
  }, {
    group: "content-stats"
  });

  const chipLayout = stackInFrame(createFrame({
    x: columns.right.x + 0.28,
    y: columns.right.y + 0.66,
    w: columns.right.w - 0.56,
    h: 1.92
  }), statChips.map((chip) => ({
    ...chip,
    height: 0.68
  })), {
    gap: 0.18,
    justify: "top"
  });

  chipLayout.forEach((chip) => {
    addStatChip(canvas, pres, theme, {
      group: "content-stats",
      id: chip.id,
      label: chip.label,
      value: chip.value,
      valueFontSize: 13.8,
      w: chip.w,
      x: chip.x,
      y: chip.y
    });
  });

  addPageBadge(canvas, pres, theme, slideConfig.index);
  return canvas.finalize();
}

module.exports = { createSlide, slideConfig };
