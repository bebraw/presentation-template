const { createTextMeasurementDoc, measureTextBlock } = require("./text-metrics");

const MIN_BULLET_HEIGHT = 0.2;
const SLIDE_WIDTH = 10;
const SECTION_HEADER = {
  bodyBottom: 1.62,
  titleBottom: 1.32
};

function createFrame(options = {}) {
  const {
    x = 0,
    y = 0,
    w = 0,
    h,
    bottom
  } = options;

  const resolvedHeight = typeof h === "number"
    ? h
    : typeof bottom === "number"
      ? bottom - y
      : 0;

  return {
    x,
    y,
    w,
    h: resolvedHeight
  };
}

function sectionContentFrame(options = {}) {
  const {
    bottom = 5.04,
    gap,
    hasBody = false,
    left = 0.62,
    right = 8.8,
    top
  } = options;

  const resolvedTop = typeof top === "number"
    ? top
    : (hasBody ? SECTION_HEADER.bodyBottom : SECTION_HEADER.titleBottom) +
      (typeof gap === "number" ? gap : hasBody ? 0.34 : 0.58);
  const resolvedRight = typeof right === "number" ? right : SLIDE_WIDTH;

  return createFrame({
    x: left,
    y: resolvedTop,
    w: resolvedRight - left,
    bottom
  });
}

function insetFrame(frame, options = {}) {
  const {
    top = 0,
    right = 0,
    bottom = 0,
    left = 0
  } = options;

  return {
    x: frame.x + left,
    y: frame.y + top,
    w: frame.w - left - right,
    h: frame.h - top - bottom
  };
}

function splitColumns(frame, options = {}) {
  const gap = typeof options.gap === "number" ? options.gap : 0;
  const leftWidth = typeof options.leftWidth === "number"
    ? options.leftWidth
    : typeof options.leftRatio === "number"
      ? frame.w * options.leftRatio
      : (frame.w - gap) / 2;
  const rightWidth = typeof options.rightWidth === "number"
    ? options.rightWidth
    : frame.w - leftWidth - gap;

  return {
    left: createFrame({
      x: frame.x,
      y: frame.y,
      w: leftWidth,
      h: frame.h
    }),
    right: createFrame({
      x: frame.x + leftWidth + gap,
      y: frame.y,
      w: rightWidth,
      h: frame.h
    })
  };
}

function bulletItemHeight(options = {}) {
  const titleH = typeof options.titleH === "number" ? options.titleH : 0.28;
  const bodyOffset = typeof options.bodyOffset === "number" ? options.bodyOffset : 0.26;
  const bodyH = typeof options.bodyH === "number" ? options.bodyH : 0.38;
  const hasBody = Boolean(options.body);

  return Math.max(
    titleH,
    hasBody ? bodyOffset + bodyH : MIN_BULLET_HEIGHT
  );
}

function stackHeight(items, gap = 0) {
  if (!items.length) {
    return 0;
  }

  const contentHeight = items.reduce((sum, item) => sum + item.height, 0);
  return contentHeight + Math.max(items.length - 1, 0) * gap;
}

function stackInFrame(frame, items, options = {}) {
  const gap = typeof options.gap === "number" ? options.gap : 0;
  const justify = options.justify || "center";
  const totalHeight = stackHeight(items, gap);

  let startY = frame.y;

  if (justify === "center") {
    startY = frame.y + (frame.h - totalHeight) / 2;
  } else if (justify === "bottom") {
    startY = frame.y + frame.h - totalHeight;
  }

  let cursor = startY;
  return items.map((item) => {
    const laidOut = {
      ...item,
      x: typeof item.x === "number" ? item.x : frame.x,
      w: typeof item.w === "number" ? item.w : frame.w,
      h: typeof item.h === "number" ? item.h : item.height,
      y: cursor
    };
    cursor += item.height + gap;
    return laidOut;
  });
}

function titleStackLayout(frame, options = {}) {
  const titleHeight = typeof options.titleHeight === "number" ? options.titleHeight : 0;
  const titleGap = typeof options.titleGap === "number" ? options.titleGap : 0;
  const itemGap = typeof options.itemGap === "number" ? options.itemGap : 0;
  const justify = options.justify || "center";
  const items = options.items || [];
  const itemsHeight = stackHeight(items, itemGap);
  const totalHeight = titleHeight + (items.length ? titleGap : 0) + itemsHeight;

  let startY = frame.y;
  if (justify === "center") {
    startY = frame.y + (frame.h - totalHeight) / 2;
  } else if (justify === "bottom") {
    startY = frame.y + frame.h - totalHeight;
  }

  const titleY = startY;
  const itemFrame = createFrame({
    x: frame.x,
    y: titleY + titleHeight + (items.length ? titleGap : 0),
    w: frame.w,
    h: itemsHeight
  });

  return {
    titleY,
    items: stackInFrame(itemFrame, items, {
      gap: itemGap,
      justify: "top"
    })
  };
}

function measureTextHeight(text, options) {
  const measurement = createTextMeasurementDoc();

  try {
    const { measuredHeight } = measureTextBlock(measurement.doc, text, options);
    return measuredHeight / 72;
  } finally {
    measurement.dispose();
  }
}

function centeredTextBlock(frame, text, options = {}) {
  const measuredHeight = measureTextHeight(text, {
    ...options,
    w: frame.w
  });
  const minHeight = typeof options.minHeight === "number" ? options.minHeight : 0;
  const slack = typeof options.slack === "number" ? options.slack : 0.04;
  const height = Math.max(measuredHeight + slack, minHeight);

  return {
    h: height,
    w: frame.w,
    x: frame.x,
    y: frame.y + (frame.h - height) / 2
  };
}

function centerBox(frame, options = {}) {
  const {
    h = frame.h,
    w = frame.w,
    alignX = "center",
    alignY = "center"
  } = options;

  const x = alignX === "left"
    ? frame.x
    : alignX === "right"
      ? frame.x + frame.w - w
      : frame.x + (frame.w - w) / 2;
  const y = alignY === "top"
    ? frame.y
    : alignY === "bottom"
      ? frame.y + frame.h - h
      : frame.y + (frame.h - h) / 2;

  return { x, y, w, h };
}

function fitContainBox(frame, options = {}) {
  const contentWidth = typeof options.contentWidth === "number" ? options.contentWidth : frame.w;
  const contentHeight = typeof options.contentHeight === "number" ? options.contentHeight : frame.h;
  const scale = Math.min(
    frame.w / Math.max(contentWidth, Number.EPSILON),
    frame.h / Math.max(contentHeight, Number.EPSILON)
  );

  return centerBox(frame, {
    alignX: options.alignX || "center",
    alignY: options.alignY || "center",
    h: contentHeight * scale,
    w: contentWidth * scale
  });
}

function boxBelow(box, options = {}) {
  return {
    x: typeof options.x === "number" ? options.x : box.x,
    y: box.y + box.h + (typeof options.gap === "number" ? options.gap : 0),
    w: typeof options.w === "number" ? options.w : box.w,
    h: typeof options.h === "number" ? options.h : 0
  };
}

module.exports = {
  bulletItemHeight,
  boxBelow,
  centerBox,
  centeredTextBlock,
  createFrame,
  sectionContentFrame,
  fitContainBox,
  insetFrame,
  measureTextHeight,
  splitColumns,
  stackHeight,
  stackInFrame,
  titleStackLayout
};
