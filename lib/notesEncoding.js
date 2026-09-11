// Encodes progress % and in-progress status into a task's `notes` field as a
// hidden tag, so the data round-trips through the real Google Tasks API and
// stays attached to the task even in other Tasks clients. The user's own
// note text is preserved untouched.
//
// Tag format (appended on its own line at the end of notes):
//   ⟦gtx:p=40,s=active⟧
// `p` (progress) and `s` (status) are both optional inside the tag.

const TAG_RE = /\n?⟦gtx:([^⟧]*)⟧\s*$/;

export function parseNotes(rawNotes) {
  const raw = rawNotes || "";
  const match = raw.match(TAG_RE);
  if (!match) {
    return { text: raw, progress: null, status: null };
  }
  const text = raw.slice(0, match.index);
  const fields = Object.fromEntries(
    match[1]
      .split(",")
      .map((pair) => pair.split("="))
      .filter((pair) => pair.length === 2)
  );
  const progress =
    fields.p !== undefined && fields.p !== "" ? clampProgress(Number(fields.p)) : null;
  const status = fields.s || null;
  return { text, progress, status };
}

export function serializeNotes({ text = "", progress = null, status = null }) {
  const fields = [];
  if (progress !== null && progress !== undefined) {
    fields.push(`p=${clampProgress(progress)}`);
  }
  if (status) {
    fields.push(`s=${status}`);
  }
  if (fields.length === 0) return text;
  const separator = text && !text.endsWith("\n") ? "\n" : "";
  return `${text}${separator}⟦gtx:${fields.join(",")}⟧`;
}

function clampProgress(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
