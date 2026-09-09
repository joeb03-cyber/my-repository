export function messageParagraphs(body: string) {
  body = body.replace(/\r\n?/g, "\n");
  const explicit = body.split(/\n[ \t]*\n/).filter((paragraph) => paragraph.length > 0);
  if (explicit.length > 1 || body.length < 700 || /\r?\n/.test(body)) return explicit.length ? explicit : [body];
  const paragraphs: string[] = [];
  const boundary = /[.!?]["'’”)]?(?:\s+|$)/g;
  let start = 0;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(body))) {
    const end = match.index + match[0].length;
    if (end - start >= 520) {
      paragraphs.push(body.slice(start, end).trim());
      start = end;
    }
  }
  if (start < body.length) paragraphs.push(body.slice(start).trim());
  return paragraphs.length > 1 ? paragraphs : [body];
}

