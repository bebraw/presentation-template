const SLIDE_BOUNDS = {
  x: 0,
  y: 0,
  w: 10,
  h: 5.625
};

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

function getBox(options) {
  if (!options || typeof options.x !== "number" || typeof options.y !== "number") {
    return null;
  }

  return {
    x: options.x,
    y: options.y,
    w: typeof options.w === "number" ? options.w : 0,
    h: typeof options.h === "number" ? options.h : 0
  };
}

function unionBoxes(current, next) {
  if (!current) {
    return { ...next };
  }

  const x1 = Math.min(current.x, next.x);
  const y1 = Math.min(current.y, next.y);
  const x2 = Math.max(current.x + current.w, next.x + next.w);
  const y2 = Math.max(current.y + current.h, next.y + next.h);

  return {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1
  };
}

function boxesOverlap(a, b, tolerance = 0.01) {
  const overlapWidth = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapHeight = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

  return overlapWidth > tolerance && overlapHeight > tolerance;
}

function outOfBounds(box, bounds, bleed = 0) {
  return (
    box.x < bounds.x - bleed ||
    box.y < bounds.y - bleed ||
    box.x + box.w > bounds.x + bounds.w + bleed ||
    box.y + box.h > bounds.y + bounds.h + bleed
  );
}

function createSlideCanvas(pres, slideConfig, options = {}) {
  const slide = pres.addSlide();
  const trackLayout = options.trackLayout !== false;
  const elements = [];
  const groups = new Map();

  function record(type, id, box, meta = {}) {
    elements.push({
      type,
      id,
      box,
      meta: { ...meta }
    });

    if (!trackLayout || !box) {
      return;
    }

    const groupName = meta.group || id;
    const group = groups.get(groupName) || {
      id: groupName,
      box: null,
      skipBounds: false,
      skipOverlap: false,
      members: []
    };

    group.members.push(id);
    group.skipBounds = group.skipBounds || meta.skipBounds === true;
    group.skipOverlap = group.skipOverlap || meta.skipOverlap === true;

    if (meta.includeInGroup !== false) {
      group.box = unionBoxes(group.box, box);
    }

    groups.set(groupName, group);
  }

  return {
    slide,
    addShape(id, shapeType, optionsForShape, meta = {}) {
      slide.addShape(shapeType, optionsForShape);
      record("shape", id, getBox(optionsForShape), meta);
    },
    addText(id, text, optionsForText, meta = {}) {
      slide.addText(text, optionsForText);
      record("text", id, getBox(optionsForText), {
        ...meta,
        text: normalizeText(text),
        options: { ...optionsForText }
      });
    },
    addChart(id, chartType, data, optionsForChart, meta = {}) {
      slide.addChart(chartType, data, optionsForChart);
      record("chart", id, getBox(optionsForChart), {
        ...meta,
        data,
        options: { ...optionsForChart }
      });
    },
    reserveGroup(id, box, meta = {}) {
      record("reserve", id, box, meta);
    },
    finalize() {
      return {
        slide,
        report: {
          slide: slideConfig,
          bounds: { ...SLIDE_BOUNDS },
          elements,
          groups: Array.from(groups.values()).filter((group) => group.box)
        }
      };
    }
  };
}

function validateGeometry(reports, options = {}) {
  const bleed = options.bleed ?? 0;
  const issues = [];

  for (const report of reports) {
    for (const group of report.groups) {
      if (!group.skipBounds && outOfBounds(group.box, report.bounds, bleed)) {
        issues.push({
          level: "error",
          slide: report.slide.index,
          rule: "bounds",
          message: `Group "${group.id}" exceeds slide bounds`
        });
      }
    }

    for (let index = 0; index < report.groups.length; index += 1) {
      const left = report.groups[index];
      if (left.skipOverlap) {
        continue;
      }

      for (let compareIndex = index + 1; compareIndex < report.groups.length; compareIndex += 1) {
        const right = report.groups[compareIndex];
        if (right.skipOverlap) {
          continue;
        }

        if (boxesOverlap(left.box, right.box)) {
          issues.push({
            level: "error",
            slide: report.slide.index,
            rule: "overlap",
            message: `Groups "${left.id}" and "${right.id}" overlap`
          });
        }
      }
    }
  }

  return issues;
}

module.exports = {
  SLIDE_BOUNDS,
  createSlideCanvas,
  normalizeText,
  validateGeometry
};

