const { getValidationConstraintOptions, readDesignConstraints } = require("../../../generator/design-constraints");
const { createStandaloneSlideHtml, withBrowser } = require("./dom-export");
const { getDomPreviewState } = require("./dom-preview");

const PX_PER_INCH = 96;
const PT_PER_PX = 72 / 96;
function countWords(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function createIssue(slide, level, rule, message) {
  return {
    level,
    message,
    rule,
    slide
  };
}

function summarizeIssues(issues) {
  return {
    errors: issues.filter((issue) => issue.level === "error"),
    issues,
    ok: !issues.some((issue) => issue.level === "error")
  };
}

function normalizeRect(rect) {
  return {
    bottom: Number(rect.bottom || 0),
    height: Number(rect.height || 0),
    left: Number(rect.left || 0),
    right: Number(rect.right || 0),
    top: Number(rect.top || 0),
    width: Number(rect.width || 0)
  };
}

function evaluateSlideInDom(slideEntry, previewState) {
  const html = createStandaloneSlideHtml(previewState, slideEntry);

  return async (page) => {
    await page.setViewportSize({ width: 960, height: 540 });
    await page.setContent(html, { waitUntil: "load" });

    return page.evaluate(() => {
      function countWords(value) {
        return String(value || "")
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .length;
      }

      const slide = document.querySelector(".dom-slide");
      if (!slide) {
        return {
          panelBoxes: [],
          slideRect: null,
          textItems: [],
          wordCount: 0,
          workflowRegions: {}
        };
      }

      const slideRect = slide.getBoundingClientRect();
      const textSelector = ".dom-slide h1, .dom-slide h2, .dom-slide h3, .dom-slide p, .dom-slide span, .dom-slide strong";
      const textItems = Array.from(document.querySelectorAll(textSelector))
        .map((element) => {
          const text = (element.textContent || "").replace(/\s+/g, " ").trim();
          if (!text) {
            return null;
          }

          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);

          return {
            className: element.className || element.tagName.toLowerCase(),
            clientHeight: element.clientHeight || rect.height,
            clientWidth: element.clientWidth || rect.width,
            fontSizePx: Number.parseFloat(style.fontSize) || 0,
            parentClassName: element.parentElement && element.parentElement.className
              ? element.parentElement.className
              : "",
            rect: {
              bottom: rect.bottom,
              height: rect.height,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              width: rect.width
            },
            scrollHeight: element.scrollHeight || rect.height,
            scrollWidth: element.scrollWidth || rect.width,
            text
          };
        })
        .filter(Boolean);

      const panelBoxes = Array.from(document.querySelectorAll(".dom-card, .dom-panel"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const textRects = Array.from(element.querySelectorAll("h1, h2, h3, p, span, strong"))
            .map((textElement) => {
              const text = (textElement.textContent || "").replace(/\s+/g, " ").trim();
              if (!text) {
                return null;
              }
              const textRect = textElement.getBoundingClientRect();
              return {
                bottom: textRect.bottom,
                left: textRect.left,
                right: textRect.right,
                top: textRect.top
              };
            })
            .filter(Boolean);

          return {
            className: element.className || "panel",
            rect: {
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
              top: rect.top
            },
            textRects
          };
        });

      function getRect(selector) {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }
        const rect = element.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          top: rect.top
        };
      }

      return {
        panelBoxes,
        slideRect: {
          bottom: slideRect.bottom,
          left: slideRect.left,
          right: slideRect.right,
          top: slideRect.top
        },
        textItems,
        wordCount: countWords(slide.textContent || "")
      };
    });
  };
}

function collectGeometryIssues(slideEntry, domData, validationOptions) {
  const issues = [];
  const slideRect = domData.slideRect ? normalizeRect(domData.slideRect) : null;
  if (!slideRect) {
    return issues;
  }

  domData.textItems.forEach((item) => {
    const rect = normalizeRect(item.rect);
    const outside = (
      rect.left < slideRect.left - 1 ||
      rect.top < slideRect.top - 1 ||
      rect.right > slideRect.right + 1 ||
      rect.bottom > slideRect.bottom + 1
    );

    if (outside) {
      issues.push(createIssue(
        slideEntry.index,
        "error",
        "bounds",
        `Text block "${item.className}" exceeds the slide viewport`
      ));
    }
  });

  const minHorizontal = ((validationOptions.textPadding && validationOptions.textPadding.minHorizontal) || 0.08) * PX_PER_INCH;
  const minTop = ((validationOptions.textPadding && validationOptions.textPadding.minTop) || 0.08) * PX_PER_INCH;
  const minBottom = ((validationOptions.textPadding && validationOptions.textPadding.minBottom) || 0.05) * PX_PER_INCH;

  domData.panelBoxes.forEach((panel) => {
    if (!panel.textRects.length) {
      return;
    }

    const rect = normalizeRect(panel.rect);
    const leftInset = Math.min(...panel.textRects.map((textRect) => textRect.left - rect.left));
    const rightInset = Math.min(...panel.textRects.map((textRect) => rect.right - textRect.right));
    const topInset = Math.min(...panel.textRects.map((textRect) => textRect.top - rect.top));
    const bottomInset = Math.min(...panel.textRects.map((textRect) => rect.bottom - textRect.bottom));

    if (leftInset < minHorizontal || rightInset < minHorizontal || topInset < minTop || bottomInset < minBottom) {
      issues.push(createIssue(
        slideEntry.index,
        "warn",
        "text-padding",
        `Panel "${panel.className}" has tight text insets (${(leftInset / PX_PER_INCH).toFixed(2)}/${(topInset / PX_PER_INCH).toFixed(2)}/${(rightInset / PX_PER_INCH).toFixed(2)}/${(bottomInset / PX_PER_INCH).toFixed(2)}in)`
      ));
    }
  });

  return issues;
}

function collectTextIssues(slideEntry, domData, validationOptions) {
  const issues = [];
  const minFontSizePt = validationOptions.minimumFontSize && validationOptions.minimumFontSize.minFontSizePt
    ? validationOptions.minimumFontSize.minFontSizePt
    : 10;
  const maxWordsPerSlide = validationOptions.slideWordCount && validationOptions.slideWordCount.maxWordsPerSlide
    ? validationOptions.slideWordCount.maxWordsPerSlide
    : 80;

  domData.textItems.forEach((item) => {
    const className = String(item.className || "");
    const parentClassName = String(item.parentClassName || "");
    const isMicrocopy = (
      /eyebrow|badge-label/.test(className) ||
      /eyebrow|badge/.test(parentClassName) ||
      parentClassName.includes("dom-signal__meta")
    );

    if (isMicrocopy) {
      return;
    }

    const fontSizePt = item.fontSizePx * PT_PER_PX;
    if (fontSizePt < minFontSizePt) {
      issues.push(createIssue(
        slideEntry.index,
        "warn",
        "font-size-small",
        `Text block "${item.className}" uses ${fontSizePt.toFixed(1)}pt text below the ${minFontSizePt.toFixed(1)}pt minimum`
      ));
    }
  });

  if (domData.wordCount > maxWordsPerSlide) {
    issues.push(createIssue(
      slideEntry.index,
      "warn",
      "slide-word-count",
      `Slide carries ${domData.wordCount} visible words above the ${maxWordsPerSlide}-word maximum`
    ));
  }

  return issues;
}

async function validateDeckInDom() {
  const previewState = getDomPreviewState();
  const validationOptions = getValidationConstraintOptions(readDesignConstraints());
  const geometryIssues = [];
  const textIssues = [];

  await withBrowser(async (browser) => {
    const page = await browser.newPage({
      viewport: {
        height: 540,
        width: 960
      }
    });

    for (const slideEntry of previewState.slides) {
      if (!slideEntry || !slideEntry.slideSpec) {
        continue;
      }

      const domData = await evaluateSlideInDom(slideEntry, previewState)(page);
      geometryIssues.push(...collectGeometryIssues(slideEntry, domData, validationOptions));
      textIssues.push(...collectTextIssues(slideEntry, domData, validationOptions));
    }

    await page.close();
  });

  return {
    geometry: summarizeIssues(geometryIssues),
    text: summarizeIssues(textIssues)
  };
}

module.exports = {
  validateDeckInDom
};
