const assert = require("node:assert/strict");
const { _test } = require("../studio/server/services/operations.ts");

const baseSlideSpec = {
  type: "content",
  index: 1,
  title: "Material slide",
  eyebrow: "Fixture",
  summary: "A slide with an attached material.",
  signalsTitle: "Signals",
  guardrailsTitle: "Guardrails",
  signals: [
    { id: "signal-1", title: "One", body: "First signal." },
    { id: "signal-2", title: "Two", body: "Second signal." },
    { id: "signal-3", title: "Three", body: "Third signal." },
    { id: "signal-4", title: "Four", body: "Fourth signal." }
  ],
  guardrails: [
    { id: "guardrail-1", title: "One", body: "First guardrail." },
    { id: "guardrail-2", title: "Two", body: "Second guardrail." },
    { id: "guardrail-3", title: "Three", body: "Third guardrail." }
  ],
  media: {
    alt: "Attached material",
    caption: "Source: fixture",
    id: "material-fixture",
    src: "/presentation-materials/fixture/material.png",
    title: "Fixture material"
  },
  mediaItems: [
    {
      alt: "Attached material one",
      caption: "Source: fixture one",
      id: "material-fixture-one",
      materialId: "material-fixture-one",
      src: "/presentation-materials/fixture/material-one.png",
      title: "Fixture material one"
    },
    {
      alt: "Attached material two",
      id: "material-fixture-two",
      src: "/presentation-materials/fixture/material-two.png"
    }
  ]
};

const candidateWithoutMedia = {
  ...baseSlideSpec,
  title: "Candidate without media"
};
delete candidateWithoutMedia.media;

const preserved = _test.applyCandidateSlideDefaults(candidateWithoutMedia, baseSlideSpec);
assert.deepEqual(
  preserved.media,
  baseSlideSpec.media,
  "generated candidates should preserve existing slide media when they do not mention media"
);
assert.deepEqual(
  preserved.mediaItems,
  baseSlideSpec.mediaItems,
  "generated candidates should preserve existing mediaItems when they do not mention mediaItems"
);

const candidateWithExplicitMedia = {
  ...candidateWithoutMedia,
  media: null,
  mediaItems: []
};
const explicit = _test.applyCandidateSlideDefaults(candidateWithExplicitMedia, baseSlideSpec);
assert.equal(
  explicit.media,
  null,
  "generated candidates should honor explicit media changes"
);
assert.deepEqual(
  explicit.mediaItems,
  [],
  "generated candidates should honor explicit mediaItems changes"
);

const photoBaseSlideSpec = {
  type: "photo",
  index: 1,
  title: "Photo material slide",
  caption: "Source: fixture",
  media: baseSlideSpec.media
};

const photoCandidateWithoutMedia = {
  type: "photo",
  index: 1,
  title: "Photo candidate",
  caption: "Tighter visual evidence."
};

const preservedPhoto = _test.applyCandidateSlideDefaults(photoCandidateWithoutMedia, photoBaseSlideSpec);
assert.deepEqual(
  preservedPhoto.media,
  photoBaseSlideSpec.media,
  "generated photo candidates should preserve existing slide media when they do not mention media"
);

const photoGridBaseSlideSpec = {
  type: "photoGrid",
  index: 1,
  title: "Photo grid material slide",
  caption: "Source: fixture set",
  mediaItems: baseSlideSpec.mediaItems
};

const photoGridCandidateWithoutMediaItems = {
  type: "photoGrid",
  index: 1,
  title: "Photo grid candidate",
  caption: "Tighter grouped visual evidence."
};

const preservedPhotoGrid = _test.applyCandidateSlideDefaults(photoGridCandidateWithoutMediaItems, photoGridBaseSlideSpec);
assert.deepEqual(
  preservedPhotoGrid.mediaItems,
  photoGridBaseSlideSpec.mediaItems,
  "generated photo grid candidates should preserve existing mediaItems when they do not mention mediaItems"
);

const familyContext = {
  audience: "fixture reviewer",
  currentTitle: "Material slide",
  intent: "Show the attached material as visual evidence.",
  layoutHint: "Use one clear reading path.",
  mustInclude: "The material remains inspectable.",
  nextTitle: "Next fixture slide",
  note: "Compare before apply.",
  objective: "Keep generated candidates reviewable.",
  outlineCurrent: "Material evidence",
  outlineNext: "Validation",
  previousTitle: "Previous fixture slide",
  themeBrief: "Quiet and practical.",
  tone: "direct"
};

const familyChangeCandidates = _test.createLocalFamilyChangeCandidates(baseSlideSpec, familyContext);
const familyChangeTypes = familyChangeCandidates.map((candidate) => candidate.slideSpec.type);

assert.ok(
  familyChangeTypes.includes("quote"),
  "family-changing candidates should include quote conversion for text-heavy slides"
);
assert.ok(
  familyChangeTypes.includes("photo"),
  "family-changing candidates should include photo conversion when media exists"
);
assert.ok(
  familyChangeTypes.includes("photoGrid"),
  "family-changing candidates should include photoGrid conversion when multiple media items exist"
);

const photoGridFamilyCandidate = familyChangeCandidates.find((candidate) => candidate.slideSpec.type === "photoGrid");
assert.deepEqual(
  photoGridFamilyCandidate.slideSpec.mediaItems,
  baseSlideSpec.mediaItems,
  "photoGrid family conversion should preserve existing mediaItems"
);
assert.match(
  photoGridFamilyCandidate.changeSummary.join(" "),
  /Changed slide family from content to photoGrid/,
  "family-changing candidates should make the type change explicit"
);

process.stdout.write("Slide media fixture validation passed.\n");
