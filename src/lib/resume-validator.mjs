import { normalizeResume, toCanonicalResume } from './resume-model.mjs';

export const SCORE_CONTRACT = Object.freeze([
  { id: 'contact', name: 'Contact information', maximum: 20 },
  { id: 'sections', name: 'Standard resume sections', maximum: 30 },
  { id: 'bullets', name: 'Achievement bullets', maximum: 15 },
  { id: 'length', name: 'Resume length', maximum: 15 },
  { id: 'action-language', name: 'Action language', maximum: 10 },
  { id: 'readability', name: 'Readable layout', maximum: 10 },
]);

export const SCORE_MAXIMUM = SCORE_CONTRACT.reduce((total, item) => total + item.maximum, 0);

const ACTION_WORDS = ['led', 'built', 'designed', 'developed', 'improved', 'delivered', 'managed', 'created', 'automated', 'reduced', 'increased', 'launched', 'implemented'];
const actionPattern = new RegExp('\\b(' + ACTION_WORDS.join('|') + ')\\b', 'g');

export const cleanText = (value) => value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

const category = (id, awarded, issues = []) => {
  const definition = SCORE_CONTRACT.find((item) => item.id === id);
  return { id, name: definition.name, maximum: definition.maximum, awarded: Math.max(0, Math.min(definition.maximum, awarded)), issues };
};

const buildReport = (analysis) => {
  const { text, words, bulletCount, sections, contact, actionWords, longLines } = analysis;
  const contactIssues = [];
  if (!contact.email) contactIssues.push('Add a plain-text email address near your name so recruiters and parsers can identify you.');
  if (!contact.phone) contactIssues.push('Add a phone number using ordinary digits and spaces; avoid putting it only in an image or header graphic.');
  if (!contact.linkedin) contactIssues.push('Consider adding a LinkedIn URL as plain text if it is relevant to your application.');

  const sectionIssues = [];
  if (!sections.summary) sectionIssues.push('Add a “PROFESSIONAL SUMMARY” section with a concise role-focused introduction.');
  if (!sections.skills) sectionIssues.push('Add a clearly labelled “CORE SKILLS” or “SKILLS” section using searchable keywords.');
  if (!sections.experience) sectionIssues.push('Use a standard “PROFESSIONAL EXPERIENCE” or “WORK EXPERIENCE” heading.');
  if (!sections.education) sectionIssues.push('Use a standard “EDUCATION” heading and list each degree, institution, and date.');

  const bulletIssues = bulletCount < 5 ? ['Convert responsibilities into short bullets with strong action verbs and measurable outcomes where truthful.'] : [];
  const lengthIssues = [];
  if (words < 180) lengthIssues.push('The extracted resume is very short. Add relevant achievements, tools, scope, and outcomes.');
  if (words > 1200) lengthIssues.push('The resume is longer than the recommended 1,200-word maximum; remove less relevant detail.');
  const actionIssues = actionWords < 5 ? ['Use more strong action verbs such as led, built, designed, improved, or delivered.'] : [];
  const readabilityIssues = longLines > 0 ? ['Break long paragraphs into shorter bullets; dense lines are harder to scan and may parse poorly.'] : [];

  const categories = [
    category('contact', (contact.email ? 8 : 0) + (contact.phone ? 7 : 0) + (contact.linkedin ? 5 : 0), contactIssues),
    category('sections', (sections.summary ? 8 : 0) + (sections.skills ? 8 : 0) + (sections.experience ? 8 : 0) + (sections.education ? 6 : 0), sectionIssues),
    category('bullets', Math.min(15, bulletCount * 3), bulletIssues),
    category('length', words >= 180 && words <= 1200 ? 15 : words >= 80 && words <= 1200 ? 8 : 0, lengthIssues),
    category('action-language', Math.min(10, actionWords * 2), actionIssues),
    category('readability', text ? Math.max(0, 10 - Math.min(10, longLines * 2)) : 0, readabilityIssues),
  ];
  const finalScore = Math.max(0, Math.min(SCORE_MAXIMUM, categories.reduce((total, item) => total + item.awarded, 0)));
  const findings = categories.flatMap((item) => item.issues);
  if (findings.length === 0) findings.push('No major heuristic issues found. Still review the visual PDF/DOCX layout and tailor keywords to each job description.');
  return { text, words, bulletCount, sections, contact, actionWords, longLines, categories, finalScore, findings };
};

const analyzeText = (text) => {
  const normalized = cleanText(text);
  const lower = normalized.toLowerCase();
  const lines = normalized ? normalized.split('\n').map((line) => line.trim()).filter(Boolean) : [];
  const words = normalized ? normalized.split(/\s+/).filter(Boolean).length : 0;
  const bulletCount = lines.filter((line) => /^([•●▪◦*-]|\d+[.)])\s+/.test(line)).length;
  const hasSection = (names) => names.some((name) => new RegExp('(^|\\n)\\s*' + name + '\\s*($|\\n|:)', 'im').test(normalized));
  const sections = {
    summary: hasSection(['professional summary', 'summary', 'objective', 'profile']),
    skills: hasSection(['core skills', 'skills', 'technical skills', 'competencies']),
    experience: hasSection(['professional experience', 'work experience', 'experience', 'employment']),
    education: hasSection(['education', 'academic background']),
  };
  const contact = {
    email: /[\w.+-]+@[\w-]+\.[\w.-]+/.test(normalized),
    phone: /(?:\+?\d[\d ()-]{7,}\d)/.test(normalized),
    linkedin: /linkedin\.com\//i.test(normalized),
  };
  const actionWords = (lower.match(actionPattern) || []).length;
  return { text: normalized, words, bulletCount, sections, contact, actionWords, longLines: lines.filter((line) => line.length > 180).length };
};

const canonicalText = (resume) => {
  const parts = [resume.contact.name, resume.contact.email, resume.contact.phone, resume.contact.linkedin, resume.contact.website, resume.summary, ...resume.skills];
  for (const item of resume.experience) parts.push(item.company, item.title, item.location, item.startDate, item.endDate, ...item.bullets);
  for (const item of resume.education) parts.push(item.institution, item.degree, item.dates, item.text);
  parts.push(...resume.metadata.unmappedText);
  return parts.filter(Boolean).join('\n').trim();
};

const analyzeCanonical = (input) => {
  const resume = normalizeResume(input);
  const text = canonicalText(resume);
  const lines = text ? text.split('\n').map((line) => line.trim()).filter(Boolean) : [];
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const bulletCount = resume.experience.reduce((total, item) => total + item.bullets.length, 0);
  const actionWords = (text.toLowerCase().match(actionPattern) || []).length;
  return {
    text,
    words,
    bulletCount,
    sections: {
      summary: Boolean(resume.summary),
      skills: resume.skills.length > 0,
      experience: resume.experience.length > 0,
      education: resume.education.length > 0,
    },
    contact: {
      email: /[\w.+-]+@[\w-]+\.[\w.-]+/.test(resume.contact.email),
      phone: /(?:\+?\d[\d ()-]{7,}\d)/.test(resume.contact.phone),
      linkedin: /linkedin\.com\//i.test(resume.contact.linkedin),
    },
    actionWords,
    longLines: lines.filter((line) => line.length > 180).length,
  };
};

export function validate(input) {
  return buildReport(typeof input === 'string' ? analyzeText(input) : analyzeCanonical(input));
}

export { normalizeResume, toCanonicalResume };
