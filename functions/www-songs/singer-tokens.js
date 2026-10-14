const SINGER_SEPARATOR = /[、,/;；]/;

function splitSingerText(value) {
  return String(value)
    .split(SINGER_SEPARATOR)
    .map((singer) => singer.trim())
    .filter(Boolean);
}

function consumeSingerDraft(draft) {
  const text = String(draft);
  if (!SINGER_SEPARATOR.test(text)) {
    return { chips: [], draft: text.replace(/^\s+/, "") };
  }
  const parts = text.split(SINGER_SEPARATOR);
  const ends = SINGER_SEPARATOR.test(text.slice(-1));
  const completeCount = ends ? parts.length : parts.length - 1;
  const chips = [];
  for (let i = 0; i < completeCount; i++) {
    const name = parts[i].trim();
    if (name) chips.push(name);
  }
  const rest = ends ? "" : String(parts[parts.length - 1] ?? "").replace(/^\s+/, "");
  return { chips, draft: rest };
}

function withCommittedDraft(singers, draft) {
  const name = String(draft).trim();
  return name ? singers.concat(name) : singers.slice();
}

module.exports = {
  SINGER_SEPARATOR,
  splitSingerText,
  consumeSingerDraft,
  withCommittedDraft,
};
