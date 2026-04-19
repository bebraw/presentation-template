const { addPageBadge, addSectionTitle } = require("./helpers");
const { fontFace } = require("./theme");
const { createSlideCanvas } = require("./validation");

const slideConfig = {
  type: "summary",
  index: 4,
  title: "Next steps"
};

function createChecklistItem(canvas, pres, theme, y, title, text, group) {
  canvas.addShape(`${group}-bullet`, pres.ShapeType.ellipse, {
    x: 0.72,
    y,
    w: 0.28,
    h: 0.28,
    line: { color: theme.accent, transparency: 100 },
    fill: { color: theme.accent }
  }, {
    group
  });

  canvas.addText(`${group}-title`, title, {
    x: 1.08,
    y: y - 0.01,
    w: 3.2,
    h: 0.24,
    fontFace,
    fontSize: 13,
    bold: true,
    color: theme.primary,
    margin: 0
  }, {
    group
  });

  canvas.addText(`${group}-body`, text, {
    x: 1.08,
    y: y + 0.28,
    w: 4.2,
    h: 0.32,
    fontFace,
    fontSize: 11,
    color: "5e7691",
    margin: 0
  }, {
    group
  });
}

function createSlide(pres, theme, options = {}) {
  const canvas = createSlideCanvas(pres, slideConfig, options);
  const { slide } = canvas;
  slide.background = { color: theme.bg };

  addSectionTitle(
    canvas,
    theme,
    "Summary",
    slideConfig.title,
    "The repository now contains a complete starter path: imported skill guidance, a runnable demo deck, and project-level documentation."
  );

  createChecklistItem(canvas, pres, theme, 2, "Install dependencies", "Run npm install once to pull in pptxgenjs locally.", "checklist-install");
  createChecklistItem(canvas, pres, theme, 2.9, "Build the deck", "Run npm run build to emit slides/output/demo-presentation.pptx.", "checklist-build");
  createChecklistItem(canvas, pres, theme, 3.8, "Extend slide modules", "Duplicate the demo pattern for real covers, content pages, and summaries.", "checklist-extend");

  canvas.addShape("summary-output-panel", pres.ShapeType.roundRect, {
    x: 6.15,
    y: 2,
    w: 3.05,
    h: 2.6,
    rectRadius: 0.08,
    line: { color: theme.light, pt: 1.2 },
    fill: { color: "ffffff" }
  }, {
    group: "summary-output-panel"
  });

  canvas.addText("summary-output-title", "Output", {
    x: 6.45,
    y: 2.28,
    w: 1.2,
    h: 0.25,
    fontFace,
    fontSize: 13,
    bold: true,
    color: theme.accent,
    allCaps: true,
    margin: 0
  }, {
    group: "summary-output-panel"
  });

  canvas.addText("summary-output-path", "slides/output/\ndemo-presentation.pptx", {
    x: 6.45,
    y: 2.66,
    w: 2.25,
    h: 0.55,
    fontFace,
    fontSize: 13,
    bold: true,
    color: theme.primary,
    breakLine: false,
    margin: 0
  }, {
    group: "summary-output-panel"
  });

  canvas.addText("summary-output-body", "The output directory is ignored by git so the generated binary stays local.", {
    x: 6.45,
    y: 3.48,
    w: 2.25,
    h: 0.42,
    fontFace,
    fontSize: 10.5,
    color: "607894",
    margin: 0
  }, {
    group: "summary-output-panel"
  });

  addPageBadge(canvas, pres, theme, slideConfig.index);
  return canvas.finalize();
}

module.exports = { createSlide, slideConfig };
