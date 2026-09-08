const lineText = (value) => value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();

export function pdfItemsToText(items, lineTolerance = 3) {
  const positioned = items
    .map((item, index) => {
      const transform = Array.isArray(item.transform) ? item.transform : [];
      return { text: typeof item.str === 'string' ? item.str : '', x: Number(transform[4]) || index, y: Number(transform[5]) || 0, index };
    })
    .filter((item) => item.text.trim());
  positioned.sort((a, b) => b.y - a.y || a.x - b.x || a.index - b.index);
  const lines = [];
  for (const item of positioned) {
    const current = lines[lines.length - 1];
    if (current && Math.abs(current.y - item.y) <= lineTolerance) current.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }
  return lines
    .map((line) => line.items.sort((a, b) => a.x - b.x || a.index - b.index).map((item) => item.text).join(' '))
    .map(lineText)
    .filter(Boolean)
    .join('\n');
}

export function pdfPageToText(items) {
  const text = pdfItemsToText(items);
  const xPositions = items
    .map((item) => (Array.isArray(item.transform) ? Number(item.transform[4]) : NaN))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const gaps = xPositions.slice(1).map((x, index) => x - xPositions[index]).filter((gap) => gap > 160);
  return { text, warnings: gaps.length ? ['Multiple horizontal text regions detected; PDF reading order may require human review.'] : [] };
}

export function pdfPagesToText(pages) {
  const pageLines = pages.map((page) => page.text.split(/\r?\n/).filter(Boolean));
  const edgeLines = pageLines.flatMap((lines, page) => [
    lines[0] && { line: lines[0], page, edge: 'top' },
    lines.at(-1) && { line: lines.at(-1), page, edge: 'bottom' },
  ].filter(Boolean));
  const chromeKey = (line) => line.toLowerCase()
    .replace(/\b(?:page|pg)\s*\d+(?:\s*(?:of|\/)\s*\d+)?\b/g, '')
    .replace(/\b\d+\s*(?:of|\/)\s*\d+\b/g, '')
    .replace(/[|•·:—–-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokenSet = (line) => new Set(chromeKey(line).split(' ').filter(Boolean));
  const similar = (left, right) => {
    if (left.edge !== right.edge || left.page === right.page) return false;
    const a = tokenSet(left.line);
    const b = tokenSet(right.line);
    const shared = [...a].filter((token) => b.has(token)).length;
    return shared >= 2 && shared / Math.min(a.size, b.size) >= 0.5;
  };
  const repeatedChrome = new Set();
  for (const candidate of edgeLines) {
    const matches = edgeLines.filter((line) => line.edge === candidate.edge && (chromeKey(line.line) === chromeKey(candidate.line) || similar(line, candidate)));
    if (matches.some((line) => line.page !== candidate.page)) repeatedChrome.add(chromeKey(candidate.line));
  }
  const warnings = pages.flatMap((page) => page.warnings || []);
  if (repeatedChrome.size) warnings.push('Repeated page header/footer text was removed before resume field extraction.');
  const text = pageLines
    .map((lines) => lines.filter((line) => !repeatedChrome.has(chromeKey(line))).join('\n'))
    .filter(Boolean)
    .join('\n\n');
  return { text, warnings: [...new Set(warnings)] };
}

const decodeHtml = (value) => value
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'");

export function docxHtmlToText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(?:li|p|div|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split(/\r?\n/)
    .map(decodeHtml)
    .map((line) => line.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export function textToText(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim();
}
