const { fontFace } = require("./theme");

function addPageBadge(canvas, pres, theme, number) {
  canvas.addShape("page-badge-circle", pres.ShapeType.ellipse, {
    x: 9.28,
    y: 5.03,
    w: 0.42,
    h: 0.42,
    line: { color: theme.accent, transparency: 100 },
    fill: { color: theme.accent }
  }, {
    group: "page-badge"
  });

  canvas.addText("page-badge-label", String(number).padStart(2, "0"), {
    x: 9.28,
    y: 5.03,
    w: 0.42,
    h: 0.42,
    fontFace,
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
    x: 0.6,
    y: 0.45,
    w: 3.2,
    h: 0.3,
    fontFace,
    fontSize: 12,
    bold: true,
    color: theme.accent,
    charSpace: 1.2,
    allCaps: true,
    margin: 0
  }, {
    group: "section-header"
  });

  canvas.addText("section-title", title, {
    x: 0.6,
    y: 0.82,
    w: 5.2,
    h: 0.52,
    fontFace,
    fontSize: 24,
    bold: true,
    color: theme.primary,
    margin: 0
  }, {
    group: "section-header"
  });

  if (body) {
    canvas.addText("section-body", body, {
      x: 0.6,
      y: 1.45,
      w: 5.2,
      h: 0.42,
      fontFace,
      fontSize: 11.5,
      color: "47627f",
      breakLine: false,
      margin: 0
    }, {
      group: "section-header"
    });
  }
}

module.exports = {
  addPageBadge,
  addSectionTitle
};
