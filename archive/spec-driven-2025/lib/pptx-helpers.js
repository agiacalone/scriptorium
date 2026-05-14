const pptxgen = require("pptxgenjs");

function createDeck(title) {
  const deck = new pptxgen();
  deck.layout = "LAYOUT_WIDE";
  deck.author = "lecture-materials-assistant";
  deck.subject = title;
  deck.title = title;
  deck.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
    lang: "en-US",
  };
  return deck;
}

function addChrome(slide, title, badge) {
  slide.background = { color: "0F172A" };
  slide.addShape("rect", {
    x: 0.25,
    y: 0.3,
    w: 0.18,
    h: 6.8,
    fill: { color: "6366F1" },
    line: { color: "6366F1" },
  });
  slide.addText(title, {
    x: 0.6,
    y: 0.45,
    w: 8.6,
    h: 0.6,
    color: "F8FAFC",
    bold: true,
    fontSize: 24,
  });
  slide.addText(badge, {
    x: 10.2,
    y: 0.42,
    w: 2.5,
    h: 0.4,
    color: "F8FAFC",
    bold: true,
    align: "center",
    fill: { color: "334155" },
    line: { color: "6366F1", pt: 1.5 },
    margin: 0.08,
    radius: 0.08,
  });
}

function addBulletList(slide, items, options = {}) {
  const runs = [];
  for (const item of items) {
    runs.push({
      text: item,
      options: {
        bullet: { indent: 18 },
        breakLine: true,
      },
    });
  }

  slide.addText(runs, {
    x: options.x || 0.8,
    y: options.y || 1.4,
    w: options.w || 11.2,
    h: options.h || 4.8,
    color: "E2E8F0",
    fontSize: options.fontSize || 19,
    valign: "top",
    margin: 0.12,
    breakLine: true,
    shrinkText: true,
  });
}

function addPanel(slide, title, body, x, y, w, h) {
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: "1E293B" },
    line: { color: "6366F1", pt: 1.2 },
  });
  slide.addText(title, {
    x: x + 0.16,
    y: y + 0.16,
    w: w - 0.32,
    h: 0.4,
    color: "F8FAFC",
    bold: true,
    fontSize: 18,
  });
  slide.addText(body, {
    x: x + 0.16,
    y: y + 0.62,
    w: w - 0.32,
    h: h - 0.78,
    color: "CBD5E1",
    fontSize: 15,
    valign: "top",
    margin: 0.04,
    shrinkText: true,
  });
}

module.exports = {
  addBulletList,
  addChrome,
  addPanel,
  createDeck,
};
