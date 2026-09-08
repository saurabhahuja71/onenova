const SECTION_ALIASES = {
  summary: ['professional summary', 'summary', 'objective', 'profile'],
  skills: ['core skills', 'skills', 'technical skills', 'competencies'],
  experience: ['professional experience', 'work experience', 'experience', 'employment'],
  education: ['education', 'academic background'],
};

const SECTION_NAMES = Object.entries(SECTION_ALIASES).flatMap(([section, aliases]) => aliases.map((alias) => ({ section, alias })));

const asText = (value) => (typeof value === 'string' ? value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim() : '');
const BULLET_PATTERN = /^([•●▪◦‣⁃*-]|\d+[.)])\s+/;

export function normalizeBullets(value) {
  if (Array.isArray(value)) return value.map((bullet) => asText(bullet).replace(BULLET_PATTERN, '').trim()).filter(Boolean);
  const bullets = [];
  for (const line of typeof value === 'string' ? value.split(/\r?\n/) : []) {
    const normalized = asText(line);
    if (!normalized) continue;
    if (BULLET_PATTERN.test(normalized) || bullets.length === 0) bullets.push(normalized.replace(BULLET_PATTERN, '').trim());
    else bullets[bullets.length - 1] += ` ${normalized}`;
  }
  return bullets.filter(Boolean);
}

const experienceHeading = (line) => {
  const date = line.match(/((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+)?\d{4}|Present|Current)\s*(?:[–—-]|\bto\b)\s*((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+)?\d{4}|Present|Current)/i);
  if (!date || BULLET_PATTERN.test(line)) return null;
  const prefix = asText(line.slice(0, date.index).replace(/[|—–-]+\s*$/, ''));
  const fields = prefix.split(/\s*(?:\||—|–)\s*/).map(asText).filter(Boolean);
  if (fields.length < 2) return null;
  return {
    company: fields[0],
    title: fields[1],
    location: fields[2] || '',
    startDate: asText(date[1]),
    endDate: asText(date[2]),
    bullets: [],
  };
};

function parseExperience(lines) {
  if (!lines.length) return [];
  const entries = [];
  let current = null;
  for (const rawLine of lines) {
    const line = asText(rawLine);
    if (!line) continue;
    const heading = experienceHeading(line);
    if (heading) {
      current = heading;
      entries.push(current);
      continue;
    }
    if (!current) {
      current = { company: '', title: '', location: '', startDate: '', endDate: '', bullets: [] };
      entries.push(current);
    }
    if (BULLET_PATTERN.test(line) || !current.bullets.length) current.bullets.push(line.replace(BULLET_PATTERN, '').trim());
    else current.bullets[current.bullets.length - 1] += ` ${line}`;
  }
  return entries;
}

export function normalizeContact(value = {}) {
  return {
    name: asText(value.name),
    email: asText(value.email),
    phone: asText(value.phone),
    linkedin: asText(value.linkedin),
    website: asText(value.website),
  };
}

function normalizeExperience(value = {}) {
  return {
    company: asText(value.company),
    title: asText(value.title),
    location: asText(value.location),
    startDate: asText(value.startDate),
    endDate: asText(value.endDate),
    bullets: normalizeBullets(value.bullets),
  };
}

function normalizeEducation(value = {}) {
  return {
    institution: asText(value.institution),
    degree: asText(value.degree),
    dates: asText(value.dates),
    text: asText(value.text),
  };
}

export function normalizeSection(value) {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean);
  return asText(value);
}

export function createEmptyResume() {
  return {
    contact: normalizeContact(),
    summary: '',
    experience: [],
    education: [],
    skills: [],
    metadata: {
      sourceFormat: '',
      parserWarnings: [],
      unmappedText: [],
    },
  };
}

export function normalizeResume(value = {}) {
  const empty = createEmptyResume();
  const metadata = value.metadata || {};
  return {
    ...empty,
    contact: normalizeContact(value.contact),
    summary: asText(value.summary),
    experience: Array.isArray(value.experience) ? value.experience.map(normalizeExperience) : [],
    education: Array.isArray(value.education) ? value.education.map(normalizeEducation) : [],
    skills: normalizeSection(value.skills),
    metadata: {
      sourceFormat: asText(metadata.sourceFormat),
      parserWarnings: Array.isArray(metadata.parserWarnings) ? metadata.parserWarnings.map(asText).filter(Boolean) : [],
      unmappedText: Array.isArray(metadata.unmappedText) ? metadata.unmappedText.map(asText).filter(Boolean) : [],
    },
  };
}

function sectionForLine(line) {
  const normalized = line.trim().toLowerCase().replace(/:$/, '');
  return SECTION_NAMES.find(({ alias }) => normalized === alias)?.section || null;
}

function splitSections(text) {
  const sections = { summary: [], skills: [], experience: [], education: [], other: [] };
  let current = 'other';
  for (const line of text.split(/\r?\n/)) {
    const section = sectionForLine(line);
    if (section) current = section;
    else if (line.trim()) sections[current].push(line.trim());
  }
  return sections;
}

function contactFromText(text, firstLine) {
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] || '';
  const phone = text.match(/(?:\+?\d[\d ()-]{7,}\d)/)?.[0] || '';
  const linkedin = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s|]+/i)?.[0] || (text.match(/linkedin\.com\/[^\s|]+/i)?.[0] || '');
  const website = text.match(/https?:\/\/(?!\s*(?:www\.)?linkedin\.com)[^\s|]+/i)?.[0] || '';
  const name = sectionForLine(firstLine) || /[\w.+-]+@[\w-]+\.[\w.-]+|(?:\+?\d[\d ()-]{7,}\d)|linkedin\.com\//i.test(firstLine) ? '' : firstLine;
  return normalizeContact({ name, email, phone, linkedin, website });
}

export function toCanonicalResume(input, sourceFormat = '', parserWarnings = []) {
  if (input && typeof input === 'object' && !Array.isArray(input) && typeof input.text !== 'string') return normalizeResume(input);
  const text = typeof input === 'string' ? input : input?.text || '';
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const sections = splitSections(text);
  const recognizedHeading = lines.some((line) => sectionForLine(line));
  const unmappedText = sections.other.filter((line, index) => index > 0 && !/[\w.+-]+@[\w-]+\.[\w.-]+|(?:\+?\d[\d ()-]{7,}\d)|linkedin\.com\//i.test(line));
  const makeExperience = parseExperience(sections.experience);
  const educationText = sections.education.join('\n');
  const resume = {
    contact: contactFromText(text, lines[0] || ''),
    summary: sections.summary.join('\n'),
    experience: makeExperience,
    education: educationText ? [{ text: educationText }] : [],
    skills: sections.skills.flatMap((line) => line.split(/[,|]/)).map(asText).filter(Boolean),
    metadata: {
      sourceFormat: asText(sourceFormat),
      parserWarnings: [...(Array.isArray(parserWarnings) ? parserWarnings : []), ...(text.trim() && !recognizedHeading ? ['No recognized section headings were found; unmapped text was preserved.'] : [])],
      unmappedText,
    },
  };
  return normalizeResume(resume);
}
