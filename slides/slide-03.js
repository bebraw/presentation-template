const { addPageBadge, addSectionTitle } = require("./helpers");
const { fontFace } = require("./theme");
const { createSlideCanvas } = require("./validation");

const slideConfig = {
  type: "content",
  index: 3,
  title: "Why this setup works"
};

function addMetric(canvas, theme, x, y, value, label, id) {
  canvas.addText(`${id}-value`, value, {
    x,
    y,
    w: 1.2,
    h: 0.4,
    fontFace,
    fontSize: 20,
    bold: true,
    color: theme.primary,
    margin: 0
  }, {
    group: "content-stats-panel"
  });

  canvas.addText(`${id}-label`, label, {
    x,
    y: y + 0.42,
    w: 1.6,
    h: 0.3,
    fontFace,
    fontSize: 10.5,
    color: "5d7591",
    margin: 0
  }, {
    group: "content-stats-panel"
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
    "The demo emphasizes repeatability: local dependencies, explicit slide modules, and a compile command that fits CI."
  );

  canvas.addShape("content-chart-panel", pres.ShapeType.roundRect, {
    x: 0.6,
    y: 2,
    w: 4.65,
    h: 2.45,
    rectRadius: 0.08,
    line: { color: "dbe7f1", pt: 1 },
    fill: { color: "f8fbfe" }
  }, {
    group: "content-chart-panel"
  });

  canvas.addChart("content-chart", pres.ChartType.bar, [
    {
      name: "Deck setup",
      labels: ["Skill", "Theme", "Slides", "Docs"],
      values: [75, 82, 94, 88]
    }
  ], {
    x: 0.88,
    y: 2.28,
    w: 3.92,
    h: 1.62,
    catAxisLabelFontFace: fontFace,
    catAxisLabelFontSize: 9,
    valAxisLabelFontFace: fontFace,
    valAxisLabelFontSize: 9,
    valAxisMinVal: 0,
    valAxisMaxVal: 100,
    valGridLine: { color: "d7e6f5", pt: 1 },
    chartColors: [theme.secondary],
    showLegend: false,
    showTitle: false,
    showValue: true,
    dataLabelColor: theme.primary,
    dataLabelPosition: "outEnd",
    showCatName: false,
    showValAxisTitle: false,
    showCatAxisTitle: false
  }, {
    group: "content-chart-panel"
  });

  canvas.addShape("content-stats-panel", pres.ShapeType.roundRect, {
    x: 5.65,
    y: 2,
    w: 3.75,
    h: 2.45,
    rectRadius: 0.08,
    line: { color: theme.primary, transparency: 100 },
    fill: { color: theme.primary }
  }, {
    group: "content-stats-panel"
  });

  canvas.addText("content-stats-title", "Key properties", {
    x: 5.95,
    y: 2.24,
    w: 2,
    h: 0.3,
    fontFace,
    fontSize: 15,
    bold: true,
    color: "FFFFFF",
    margin: 0
  }, {
    group: "content-stats-panel"
  });

  addMetric(canvas, theme, 5.95, 2.9, "4", "Slide modules", "metric-modules");
  addMetric(canvas, theme, 7.35, 2.9, "1", "Compile script", "metric-compile");
  addMetric(canvas, theme, 5.95, 3.72, "5", "Theme keys", "metric-theme");
  addMetric(canvas, theme, 7.35, 3.72, "1", "README guide", "metric-readme");

  addPageBadge(canvas, pres, theme, slideConfig.index);
  return canvas.finalize();
}

module.exports = { createSlide, slideConfig };
