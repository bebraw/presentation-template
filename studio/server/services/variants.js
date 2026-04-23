const { getVariants, saveVariants } = require("./state");
const { extractSlideSpec, validateSlideSpec } = require("./slide-specs");
const {
  getSlide,
  getSlides,
  readSlideSource,
  readSlideSpec,
  readStructuredSlideVariants,
  writeSlideSource,
  writeSlideSpec,
  writeStructuredSlideVariants
} = require("./slides");

function serializeSlideSpec(slideSpec) {
  return `${JSON.stringify(slideSpec, null, 2)}\n`;
}

function assertValidSource(source) {
  try {
    new Function(source);
  } catch (error) {
    throw new Error(`Variant source is invalid: ${error.message}`);
  }
}

function parseStructuredSource(source) {
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Structured variant source is invalid JSON: ${error.message}`);
  }
}

function repairLegacyStructuredSource(source) {
  const lines = String(source || "").split("\n");

  for (let index = 0; index < lines.length - 1; index += 1) {
    const current = lines[index];
    const next = lines[index + 1];
    const trimmed = current.trim();
    const nextTrimmed = next.trim();

    if (!trimmed || !nextTrimmed) {
      continue;
    }

    const looksLikeProperty = /^[A-Za-z_][\w-]*:\s*/.test(trimmed);
    const nextLooksLikeProperty = /^[A-Za-z_][\w-]*:\s*/.test(nextTrimmed);
    const alreadyClosed = /[,([{]$/.test(trimmed);

    if (looksLikeProperty && nextLooksLikeProperty && !alreadyClosed) {
      lines[index] = `${current},`;
    }
  }

  return lines.join("\n");
}

function sortVariants(variants) {
  return [...variants].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt || left.createdAt || 0);
    const rightTime = Date.parse(right.updatedAt || right.createdAt || 0);
    return rightTime - leftTime;
  });
}

function createVariantRecord(options) {
  const timestamp = new Date().toISOString();
  const slideSpec = options.slideSpec || null;
  const source = typeof options.source === "string"
    ? options.source
    : slideSpec
      ? serializeSlideSpec(slideSpec)
      : null;

  return {
    changeSummary: Array.isArray(options.changeSummary) ? options.changeSummary : [],
    createdAt: options.createdAt || timestamp,
    generator: options.generator || null,
    id: options.id || createVariantId(),
    kind: options.kind || "snapshot",
    label: options.label || "",
    model: options.model || null,
    notes: options.notes || "",
    operation: options.operation || null,
    persisted: options.persisted !== false,
    previewImage: options.previewImage || null,
    promptSummary: options.promptSummary || "",
    provider: options.provider || null,
    slideId: options.slideId,
    slideSpec,
    source,
    updatedAt: options.updatedAt || timestamp
  };
}

function toStoredStructuredVariant(variant) {
  return {
    changeSummary: variant.changeSummary,
    createdAt: variant.createdAt,
    generator: variant.generator,
    id: variant.id,
    kind: variant.kind,
    label: variant.label,
    model: variant.model,
    notes: variant.notes,
    operation: variant.operation,
    previewImage: variant.previewImage,
    promptSummary: variant.promptSummary,
    provider: variant.provider,
    slideSpec: variant.slideSpec,
    updatedAt: variant.updatedAt
  };
}

function normalizeStructuredVariant(storedVariant, slideId) {
  if (!storedVariant || typeof storedVariant !== "object" || Array.isArray(storedVariant)) {
    return null;
  }

  try {
    let slideSpec = null;
    if (storedVariant.slideSpec && typeof storedVariant.slideSpec === "object" && !Array.isArray(storedVariant.slideSpec)) {
      slideSpec = readStructuredVariantSlideSpec(storedVariant.slideSpec);
    } else if (typeof storedVariant.source === "string" && storedVariant.source.trim()) {
      slideSpec = readStructuredVariantSlideSpec(parseStructuredSource(storedVariant.source));
    }

    if (!slideSpec) {
      return null;
    }

    return createVariantRecord({
      ...storedVariant,
      persisted: true,
      slideId,
      slideSpec,
      source: serializeSlideSpec(slideSpec)
    });
  } catch (error) {
    return null;
  }
}

function readStructuredVariantSlideSpec(slideSpec) {
  return validateSlideSpec(slideSpec);
}

function readLegacyStructuredVariantSlideSpec(variant) {
  if (variant.slideSpec && typeof variant.slideSpec === "object" && !Array.isArray(variant.slideSpec)) {
    return readStructuredVariantSlideSpec(variant.slideSpec);
  }

  if (typeof variant.source !== "string" || !variant.source.trim()) {
    throw new Error("Legacy structured variant is missing source.");
  }

  const source = variant.source.trim();

  if (source.startsWith("{")) {
    return readStructuredVariantSlideSpec(parseStructuredSource(source));
  }

  try {
    return readStructuredVariantSlideSpec(extractSlideSpec(source));
  } catch (error) {
    return readStructuredVariantSlideSpec(extractSlideSpec(repairLegacyStructuredSource(source)));
  }
}

function listLegacyVariants() {
  return getVariants().variants.map((variant) => ({
    ...variant,
    persisted: variant.persisted !== false
  }));
}

function listStructuredVariantsForSlide(slideId) {
  return sortVariants(
    readStructuredSlideVariants(slideId)
      .map((variant) => normalizeStructuredVariant(variant, slideId))
      .filter(Boolean)
  );
}

function listVariantsForSlide(slideId) {
  migrateLegacyStructuredVariants();
  return sortVariants([
    ...listStructuredVariantsForSlide(slideId),
    ...listLegacyVariants().filter((variant) => variant.slideId === slideId)
  ]);
}

function listAllVariants() {
  migrateLegacyStructuredVariants();
  const slideVariants = getSlides()
    .filter((slide) => slide.structured)
    .flatMap((slide) => listStructuredVariantsForSlide(slide.id));

  return sortVariants([
    ...slideVariants,
    ...listLegacyVariants()
  ]);
}

function findStructuredVariantLocation(variantId) {
  const structuredSlides = getSlides().filter((slide) => slide.structured);

  for (const slide of structuredSlides) {
    const variants = readStructuredSlideVariants(slide.id);
    const index = variants.findIndex((variant) => variant && variant.id === variantId);

    if (index >= 0) {
      return {
        index,
        slide,
        variants
      };
    }
  }

  return null;
}

function normalizeLegacyStructuredVariant(variant) {
  if (!variant || typeof variant !== "object" || Array.isArray(variant)) {
    return null;
  }

  try {
    const slide = getSlide(variant.slideId, { includeArchived: true });
    if (!slide.structured) {
      return null;
    }

    const slideSpec = readLegacyStructuredVariantSlideSpec(variant);
    return createVariantRecord({
      ...variant,
      persisted: true,
      slideId: slide.id,
      slideSpec,
      source: serializeSlideSpec(slideSpec)
    });
  } catch (error) {
    return null;
  }
}

function migrateLegacyStructuredVariants() {
  const store = getVariants();
  const variants = Array.isArray(store.variants) ? store.variants : [];

  if (!variants.length) {
    return {
      blocked: 0,
      migrated: 0,
      remainingLegacy: 0
    };
  }

  const groupedStructuredVariants = new Map();
  const remainingVariants = [];
  let blocked = 0;
  let migrated = 0;

  variants.forEach((variant) => {
    const normalized = normalizeLegacyStructuredVariant(variant);

    if (!normalized) {
      if (variant && typeof variant.slideId === "string") {
        try {
          const slide = getSlide(variant.slideId, { includeArchived: true });
          if (slide.structured) {
            blocked += 1;
            remainingVariants.push(variant);
            return;
          }
        } catch (error) {
          // Keep legacy entries for unknown slides untouched.
        }
      }

      remainingVariants.push(variant);
      return;
    }

    migrated += 1;
    const nextVariants = groupedStructuredVariants.get(normalized.slideId) || [];
    nextVariants.push(normalized);
    groupedStructuredVariants.set(normalized.slideId, nextVariants);
  });

  if (groupedStructuredVariants.size) {
    groupedStructuredVariants.forEach((normalizedVariants, slideId) => {
      const existingVariants = listStructuredVariantsForSlide(slideId);
      const mergedById = new Map();

      normalizedVariants.forEach((variant) => {
        mergedById.set(variant.id, toStoredStructuredVariant(variant));
      });
      existingVariants.forEach((variant) => {
        if (!mergedById.has(variant.id)) {
          mergedById.set(variant.id, toStoredStructuredVariant(variant));
        }
      });

      writeStructuredSlideVariants(slideId, Array.from(mergedById.values()));
    });
  }

  if (migrated > 0 || remainingVariants.length !== variants.length) {
    saveVariants({
      variants: remainingVariants
    });
  }

  return {
    blocked,
    migrated,
    remainingLegacy: remainingVariants.length
  };
}

function getVariantStorageStatus() {
  const store = getVariants();
  const variants = Array.isArray(store.variants) ? store.variants : [];
  let blockedStructured = 0;
  let legacyStructured = 0;
  let legacyUnstructured = 0;

  variants.forEach((variant) => {
    if (!variant || typeof variant.slideId !== "string") {
      legacyUnstructured += 1;
      return;
    }

    try {
      const slide = getSlide(variant.slideId, { includeArchived: true });
      if (slide.structured) {
        legacyStructured += 1;
        if (!normalizeLegacyStructuredVariant(variant)) {
          blockedStructured += 1;
        }
        return;
      }
    } catch (error) {
      // Unknown slides stay in the legacy bucket.
    }

    legacyUnstructured += 1;
  });

  return {
    blockedStructured,
    legacyStructured,
    legacyUnstructured,
    slideLocalStructured: getSlides()
      .filter((slide) => slide.structured)
      .reduce((total, slide) => total + listStructuredVariantsForSlide(slide.id).length, 0)
  };
}

function createVariantId() {
  return `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function captureVariant(options) {
  migrateLegacyStructuredVariants();
  const slideId = options.slideId;
  const slide = getSlide(slideId);
  let slideSpec = options.slideSpec || null;

  if (slide.structured) {
    if (!slideSpec && typeof options.source === "string" && options.source.trim()) {
      slideSpec = parseStructuredSource(options.source);
    }

    slideSpec = slideSpec || readSlideSpec(slideId);
    slideSpec = readStructuredVariantSlideSpec(slideSpec);

    const variant = createVariantRecord({
      ...options,
      label: options.label || `Snapshot ${listVariantsForSlide(slideId).length + 1}`,
      persisted: true,
      slideId,
      slideSpec,
      source: serializeSlideSpec(slideSpec)
    });
    const variants = readStructuredSlideVariants(slideId);

    writeStructuredSlideVariants(slideId, [
      toStoredStructuredVariant(variant),
      ...variants.filter((entry) => entry && entry.id !== variant.id)
    ]);

    return variant;
  }

  const source = typeof options.source === "string" ? options.source : readSlideSource(slideId);
  assertValidSource(source);
  const store = getVariants();
  const nextVariant = createVariantRecord({
    ...options,
    label: options.label || `Snapshot ${store.variants.length + 1}`,
    slideId,
    source
  });

  const nextStore = {
    variants: [nextVariant, ...store.variants]
  };

  saveVariants(nextStore);
  return nextVariant;
}

function updateVariant(variantId, fields) {
  migrateLegacyStructuredVariants();
  const structuredLocation = findStructuredVariantLocation(variantId);

  if (structuredLocation) {
    let updated = null;
    const variants = structuredLocation.variants.map((variant) => {
      if (variant.id !== variantId) {
        return variant;
      }

      const current = normalizeStructuredVariant(variant, structuredLocation.slide.id);
      if (!current) {
        throw new Error(`Structured variant ${variantId} is invalid`);
      }
      const nextSlideSpec = fields.slideSpec
        ? readStructuredVariantSlideSpec(fields.slideSpec)
        : current.slideSpec;
      updated = createVariantRecord({
        ...current,
        ...fields,
        persisted: true,
        slideId: structuredLocation.slide.id,
        slideSpec: nextSlideSpec,
        source: serializeSlideSpec(nextSlideSpec),
        updatedAt: new Date().toISOString()
      });

      return toStoredStructuredVariant(updated);
    });

    writeStructuredSlideVariants(structuredLocation.slide.id, variants);
    return updated;
  }

  const store = getVariants();
  let updated = null;

  const variants = store.variants.map((variant) => {
    if (variant.id !== variantId) {
      return variant;
    }

    updated = {
      ...variant,
      ...fields,
      updatedAt: new Date().toISOString()
    };

    return updated;
  });

  if (!updated) {
    throw new Error(`Unknown variant: ${variantId}`);
  }

  saveVariants({ variants });
  return updated;
}

function applyVariant(variantId) {
  migrateLegacyStructuredVariants();
  const structuredLocation = findStructuredVariantLocation(variantId);

  if (structuredLocation) {
    const variant = normalizeStructuredVariant(structuredLocation.variants[structuredLocation.index], structuredLocation.slide.id);
    if (!variant) {
      throw new Error(`Unknown variant: ${variantId}`);
    }

    writeSlideSpec(variant.slideId, variant.slideSpec);
    return {
      ...variant,
      slideSpec: readSlideSpec(variant.slideId)
    };
  }

  const store = getVariants();
  const variant = store.variants.find((entry) => entry.id === variantId);

  if (!variant) {
    throw new Error(`Unknown variant: ${variantId}`);
  }

  if (variant.slideSpec) {
    writeSlideSpec(variant.slideId, variant.slideSpec);
    return {
      ...variant,
      slideSpec: readSlideSpec(variant.slideId)
    };
  }

  if (getSlide(variant.slideId).structured) {
    let parsed = null;

    try {
      parsed = JSON.parse(variant.source);
    } catch (error) {
      throw new Error(`Structured variant source is invalid JSON: ${error.message}`);
    }

    writeSlideSpec(variant.slideId, parsed);
    return {
      ...variant,
      slideSpec: readSlideSpec(variant.slideId)
    };
  }

  assertValidSource(variant.source);
  writeSlideSource(variant.slideId, variant.source);
  return variant;
}

module.exports = {
  applyVariant,
  captureVariant,
  getVariantStorageStatus,
  listAllVariants,
  listVariantsForSlide,
  migrateLegacyStructuredVariants,
  updateVariant
};
