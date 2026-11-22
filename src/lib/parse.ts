// Splits a model reply into the short chat line and the openui-lang lesson.

export type ParsedReply = {
  chat: string;
  code: string | null;
  codeComplete: boolean;
};

const FENCE = "```";

export function parseReply(text: string): ParsedReply {
  const start = text.indexOf(FENCE);
  if (start === -1) {
    const trimmed = text.trimStart();
    if (/^root\s*=/.test(trimmed)) return { chat: "", code: trimmed, codeComplete: false };
    // Hide a dangling partial fence ("`" or "``") at the very end while streaming.
    return { chat: text.replace(/`{1,2}$/, ""), code: null, codeComplete: false };
  }

  const afterFence = text.slice(start + FENCE.length);
  const newline = afterFence.indexOf("\n");
  const bodyStart = newline === -1 ? afterFence.length : newline + 1;
  const body = afterFence.slice(bodyStart);
  const end = body.indexOf(FENCE);

  const before = text.slice(0, start);
  if (end === -1) {
    return { chat: before.trim(), code: body, codeComplete: false };
  }
  const after = body.slice(end + FENCE.length);
  return {
    chat: [before.trim(), after.trim()].filter(Boolean).join("\n\n"),
    code: body.slice(0, end),
    codeComplete: true,
  };
}

export function lessonTitle(code: string | null): string | null {
  if (!code) return null;
  const m =
    code.match(/LessonHeader\(\s*"((?:[^"\\]|\\.)+)"/) ?? code.match(/TextContent\(\s*"((?:[^"\\]|\\.)+)"\s*,\s*"large-heavy"/);
  return m ? m[1].replace(/\\"/g, '"') : null;
}
