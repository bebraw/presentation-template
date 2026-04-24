const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function resetDir(dir) {
  fs.rmSync(dir, { force: true, recursive: true });
  ensureDir(dir);
}

function listPages(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter((name) => /^page-\d+\.png$/.test(name))
    .sort()
    .map((name) => path.join(dir, name));
}

async function createContactSheet(pageFiles, targetPath) {
  if (!pageFiles.length) {
    throw new Error("Cannot create a contact sheet without page images.");
  }

  ensureDir(path.dirname(targetPath));

  const images = await Promise.all(pageFiles.map(async (fileName) => {
    const metadata = await sharp(fileName).metadata();
    return {
      fileName,
      height: metadata.height || 0,
      width: metadata.width || 0
    };
  }));
  const rows = [];

  for (let index = 0; index < images.length; index += 2) {
    rows.push(images.slice(index, index + 2));
  }

  const rowHeights = rows.map((row) => Math.max(...row.map((image) => image.height)));
  const width = Math.max(...rows.map((row) => row.reduce((sum, image) => sum + image.width, 0)));
  const height = rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0);
  const composites = [];
  let top = 0;

  rows.forEach((row, rowIndex) => {
    let left = 0;

    row.forEach((image) => {
      composites.push({
        input: image.fileName,
        left,
        top
      });
      left += image.width;
    });

    top += rowHeights[rowIndex];
  });

  await sharp({
    create: {
      background: "#ffffff",
      channels: 4,
      height,
      width
    }
  })
    .composite(composites)
    .png()
    .toFile(targetPath);
}

module.exports = {
  createContactSheet,
  ensureDir,
  listPages,
  resetDir
};
