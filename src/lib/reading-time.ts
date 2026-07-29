/**
 * Estimate reading time from markdown/plain text body.
 */
export function readingTime(text: string, wpm = 220): { minutes: number; words: number; text: string } {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_~\-|=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = plain ? plain.split(' ').length : 0;
  const minutes = Math.max(1, Math.ceil(words / wpm));

  return {
    words,
    minutes,
    text: `${minutes} min read`,
  };
}
