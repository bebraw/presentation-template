const fs = require("fs");
const PDFDocument = require("pdfkit");
const { bodyFont, displayFont } = require("./theme");

const POINTS_PER_INCH = 72;
const SLIDE_WIDTH = 10 * POINTS_PER_INCH;
const SLIDE_HEIGHT = 5.625 * POINTS_PER_INCH;

const embeddedFonts = {
  bodyBold: {
    family: "AvenirNext-Bold",
    path: "/System/Library/Fonts/Avenir Next.ttc"
  },
  bodyRegular: {
    family: "AvenirNext-Regular",
    path: "/System/Library/Fonts/Avenir Next.ttc"
  },
  displayBold: {
    family: "Didot-Bold",
    path: "/System/Library/Fonts/Supplemental/Didot.ttc"
  },
  displayRegular: {
    family: "Didot",
    path: "/System/Library/Fonts/Supplemental/Didot.ttc"
  }
};

function toPoints(value) {
  return Number(value || 0) * POINTS_PER_INCH;
}

function normalizeText(text) {
  if (Array.isArray(text)) {
    return text
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && "text" in item) {
          return String(item.text);
        }
        return "";
      })
      .join("");
  }

  return String(text);
}

function mapFont(fontFace, bold) {
  const face = String(fontFace || "").toLowerCase();
  const isDisplayFace = face === String(displayFont).toLowerCase() || face.includes("didot");
  if (isDisplayFace) {
    return bold ? "displayBold" : "displayRegular";
  }
  return bold ? "bodyBold" : "bodyRegular";
}

function registerEmbeddedFonts(doc) {
  for (const [alias, font] of Object.entries(embeddedFonts)) {
    if (!fs.existsSync(font.path)) {
      throw new Error(`Missing font file for ${alias}: ${font.path}`);
    }
    doc.registerFont(alias, font.path, font.family);
  }
}

function createTextMeasurementDoc() {
  const doc = new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    size: [SLIDE_WIDTH, SLIDE_HEIGHT]
  });

  registerEmbeddedFonts(doc);
  doc.addPage({
    margin: 0,
    size: [SLIDE_WIDTH, SLIDE_HEIGHT]
  });

  return {
    doc,
    dispose() {
      doc.removeAllListeners();
      doc.end();
    }
  };
}

function measureTextBlock(doc, text, options) {
  const width = toPoints(options.w);
  const fontSize = Number(options.fontSize || 12);
  const content = options.allCaps ? normalizeText(text).toUpperCase() : normalizeText(text);
  const fontName = mapFont(options.fontFace || bodyFont, options.bold);

  doc.save();
  doc.font(fontName);
  doc.fontSize(fontSize);

  const textOptions = {
    align: options.align || "left",
    characterSpacing: Number(options.charSpace || 0),
    lineGap: 0,
    width
  };

  const measuredHeight = doc.heightOfString(content, textOptions);
  const measuredWidth = doc.widthOfString(content, {
    characterSpacing: textOptions.characterSpacing
  });

  doc.restore();

  return {
    content,
    fontName,
    fontSize,
    measuredHeight,
    measuredWidth,
    textOptions
  };
}

module.exports = {
  createTextMeasurementDoc,
  mapFont,
  measureTextBlock,
  normalizeText,
  registerEmbeddedFonts,
  toPoints
};
