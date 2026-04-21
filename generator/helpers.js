const { bodyFont, displayFont } = require("./theme");

const liveDemoUrl = "https://french-cheese-shop-demo.survivejs.workers.dev";

function addPageBadge(canvas, pres, theme, number) {
  canvas.addShape("page-badge-circle", pres.ShapeType.ellipse, {
    x: 9.24,
    y: 5.01,
    w: 0.44,
    h: 0.44,
    line: { color: theme.secondary, transparency: 100 },
    fill: { color: theme.secondary }
  }, {
    group: "page-badge"
  });

  canvas.addText("page-badge-label", String(number).padStart(2, "0"), {
    x: 9.24,
    y: 5.01,
    w: 0.44,
    h: 0.44,
    fontFace: bodyFont,
    fontSize: 11,
    bold: true,
    color: "FFFFFF",
    align: "center",
    valign: "middle",
    margin: 0
  }, {
    group: "page-badge"
  });
}

function addSectionTitle(canvas, theme, eyebrow, title, body) {
  canvas.addText("section-eyebrow", eyebrow, {
    x: 0.62,
    y: 0.46,
    w: 3.8,
    h: 0.26,
    fontFace: bodyFont,
    fontSize: 11.5,
    bold: true,
    color: theme.secondary,
    charSpace: 1.2,
    allCaps: true,
    margin: 0
  }, {
    group: "section-header"
  });

  canvas.addText("section-title", title, {
    x: 0.62,
    y: 0.78,
    w: 6.6,
    h: 0.64,
    fontFace: displayFont,
    fontSize: 24,
    bold: false,
    color: theme.primary,
    margin: 0
  }, {
    group: "section-header"
  });

  if (body) {
    canvas.addText("section-body", body, {
      x: 0.64,
      y: 1.48,
      w: 5.95,
      h: 0.5,
      fontFace: bodyFont,
      fontSize: 11.2,
      color: "56677C",
      margin: 0
    }, {
      group: "section-header"
    });
  }
}

function addReferenceNote(canvas, theme, text, options = {}) {
  const {
    x = 0.72,
    y = 5.06,
    w = 4.9,
    h = 0.18,
    align = "left",
    group = "reference-note"
  } = options;

  canvas.addText(`${group}-text`, text, {
    x,
    y,
    w,
    h,
    fontFace: bodyFont,
    fontSize: 9.2,
    color: theme.secondary,
    align,
    margin: 0
  }, {
    group,
    skipOverlap: true
  });
}

module.exports = {
  addPageBadge,
  addReferenceNote,
  addSectionTitle,
  liveDemoUrl
};
