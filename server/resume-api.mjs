import http from 'node:http';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || 8787);
const maxBodyBytes = 280_000;
export const OPTIMIZATION_CONFIG = Object.freeze({
  maxIterations: 3,
  maxTotalAiCalls: 3,
  targetScore: 90,
  minimumImprovement: 1,
  maxNoImprovement: 1,
  maxInvalidCandidates: 1,
  timeoutMs: 90_000,
});
const aiTimeoutMs = OPTIMIZATION_CONFIG.timeoutMs;
const requests = new Map();
const topLevelKeys = ['contact', 'summary', 'experience', 'education', 'skills'];
const contactKeys = ['name', 'email', 'phone', 'linkedin', 'website'];
const experienceKeys = ['company', 'title', 'location', 'startDate', 'endDate', 'bullets'];
const educationKeys = ['institution', 'degree', 'dates', 'text'];

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const onlyKeys = (value, keys) => Object.keys(value).every((key) => keys.includes(key));
const text = (value) => (typeof value === 'string' ? value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim() : '');
const strings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string').map(text) : []);
const normalizeBullets = (value) => strings(value).map((bullet) => bullet.replace(/^([•●▪◦‣⁃*-]|\d+[.)])\s+/, '').trim()).filter(Boolean);

export class AiResumeSchemaError extends Error {}

function assertString(value, field) {
  if (typeof value !== 'string') throw new AiResumeSchemaError('Invalid AI resume field: ' + field);
}

export function validateAiResumeShape(value) {
  if (!isRecord(value) || !topLevelKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key)) || !onlyKeys(value, topLevelKeys)) {
    throw new AiResumeSchemaError('AI resume must contain only the required resume fields.');
  }
  if (!isRecord(value.contact) || !onlyKeys(value.contact, contactKeys)) throw new AiResumeSchemaError('AI resume contact is invalid.');
  for (const key of contactKeys) if (Object.prototype.hasOwnProperty.call(value.contact, key)) assertString(value.contact[key], 'contact.' + key);
  assertString(value.summary, 'summary');
  if (!Array.isArray(value.skills) || value.skills.some((skill) => typeof skill !== 'string')) throw new AiResumeSchemaError('AI resume skills must be an array of strings.');
  if (!Array.isArray(value.experience) || value.experience.some((entry) => !isRecord(entry) || !onlyKeys(entry, experienceKeys) || !Array.isArray(entry.bullets) || entry.bullets.some((bullet) => typeof bullet !== 'string'))) {
    throw new AiResumeSchemaError('AI resume experience is invalid.');
  }
  if (!Array.isArray(value.education) || value.education.some((entry) => !isRecord(entry) || !onlyKeys(entry, educationKeys))) {
    throw new AiResumeSchemaError('AI resume education is invalid.');
  }
  for (const entry of value.experience) for (const key of experienceKeys.filter((key) => key !== 'bullets')) if (Object.prototype.hasOwnProperty.call(entry, key)) assertString(entry[key], 'experience.' + key);
  for (const entry of value.education) for (const key of educationKeys) if (Object.prototype.hasOwnProperty.call(entry, key)) assertString(entry[key], 'education.' + key);
  return true;
}

export function normalizeAiResume(value) {
  validateAiResumeShape(value);
  return {
    contact: Object.fromEntries(contactKeys.map((key) => [key, text(value.contact[key])])),
    summary: text(value.summary),
    experience: value.experience.map((entry) => ({
      company: text(entry.company),
      title: text(entry.title),
      location: text(entry.location),
      startDate: text(entry.startDate),
      endDate: text(entry.endDate),
      bullets: normalizeBullets(entry.bullets),
    })),
    education: value.education.map((entry) => ({
      institution: text(entry.institution),
      degree: text(entry.degree),
      dates: text(entry.dates),
      text: text(entry.text),
    })),
    skills: strings(value.skills).filter(Boolean),
    metadata: { sourceFormat: '', parserWarnings: [], unmappedText: [] },
  };
}

export function parseStructuredResume(content) {
  if (typeof content !== 'string' || !content.trim()) throw new AiResumeSchemaError('AI service returned an empty response.');
  let value;
  try {
    value = JSON.parse(content);
  } catch {
    throw new AiResumeSchemaError('AI service returned malformed JSON.');
  }
  return normalizeAiResume(value);
}

const canonicalText = (resume) => {
  const parts = [resume.contact.name, resume.contact.email, resume.contact.phone, resume.contact.linkedin, resume.contact.website, resume.summary, ...resume.skills];
  for (const item of resume.experience) parts.push(item.company, item.title, item.location, item.startDate, item.endDate, ...item.bullets);
  for (const item of resume.education) parts.push(item.institution, item.degree, item.dates, item.text);
  return parts.filter(Boolean).join('\n').trim();
};

export function canonicalResumeToText(resume) {
  const lines = [];
  const contact = [resume.contact.name, resume.contact.email, resume.contact.phone, resume.contact.linkedin, resume.contact.website].filter(Boolean).join(' | ');
  if (contact) lines.push(contact);
  if (resume.summary) lines.push('', 'PROFESSIONAL SUMMARY', resume.summary);
  if (resume.skills.length) lines.push('', 'CORE SKILLS', resume.skills.join(', '));
  if (resume.experience.length) {
    lines.push('', 'PROFESSIONAL EXPERIENCE');
    for (const item of resume.experience) {
      const heading = [item.title, item.company, item.location].filter(Boolean).join(' — ');
      const dates = [item.startDate, item.endDate].filter(Boolean).join(' – ');
      if (heading || dates) lines.push([heading, dates].filter(Boolean).join(' | '));
      for (const bullet of item.bullets) lines.push('- ' + bullet);
    }
  }
  if (resume.education.length) {
    lines.push('', 'EDUCATION');
    for (const item of resume.education) lines.push([item.degree, item.institution, item.dates, item.text].filter(Boolean).join(', '));
  }
  return lines.join('\n').trim();
}

const scoreCategory = (id, name, maximum, awarded, issues = []) => ({ id, name, maximum, awarded: Math.max(0, Math.min(maximum, awarded)), issues });

export function validateCanonicalResume(resume) {
  const serialized = canonicalText(resume);
  const lower = serialized.toLowerCase();
  const lines = serialized ? serialized.split('\n').filter(Boolean) : [];
  const words = serialized ? serialized.split(/\s+/).filter(Boolean).length : 0;
  const bulletCount = resume.experience.reduce((total, item) => total + item.bullets.length, 0);
  const actionWords = (lower.match(/\b(led|built|designed|developed|improved|delivered|managed|created|automated|reduced|increased|launched|implemented)\b/g) || []).length;
  const contact = {
    email: /[\w.+-]+@[\w-]+\.[\w.-]+/.test(resume.contact.email),
    phone: /(?:\+?\d[\d ()-]{7,}\d)/.test(resume.contact.phone),
    linkedin: /linkedin\.com\//i.test(resume.contact.linkedin),
  };
  const sections = {
    summary: Boolean(resume.summary),
    skills: resume.skills.length > 0,
    experience: resume.experience.length > 0,
    education: resume.education.length > 0,
  };
  const categories = [
    scoreCategory('contact', 'Contact information', 20, (contact.email ? 8 : 0) + (contact.phone ? 7 : 0) + (contact.linkedin ? 5 : 0)),
    scoreCategory('sections', 'Standard resume sections', 30, (sections.summary ? 8 : 0) + (sections.skills ? 8 : 0) + (sections.experience ? 8 : 0) + (sections.education ? 6 : 0)),
    scoreCategory('bullets', 'Achievement bullets', 15, Math.min(15, bulletCount * 3)),
    scoreCategory('length', 'Resume length', 15, words >= 180 && words <= 1200 ? 15 : words >= 80 && words <= 1200 ? 8 : 0),
    scoreCategory('action-language', 'Action language', 10, Math.min(10, actionWords * 2)),
    scoreCategory('readability', 'Readable layout', 10, serialized ? Math.max(0, 10 - Math.min(10, lines.filter((line) => line.length > 180).length * 2)) : 0),
  ];
  return { text: serialized, words, bulletCount, sections, contact, categories, finalScore: Math.max(0, Math.min(100, categories.reduce((sum, item) => sum + item.awarded, 0))), findings: [] };
}

const searchable = (value) => value.toLowerCase().replace(/\s+/g, ' ').trim();
const presentInSource = (value, source) => value && searchable(source).includes(searchable(value));
const factualFields = (resume) => [
  resume.contact.name, resume.contact.email, resume.contact.phone, resume.contact.linkedin, resume.contact.website,
  ...resume.skills,
  ...resume.experience.flatMap((item) => [item.company, item.title, item.location, item.startDate, item.endDate]),
  ...resume.education.flatMap((item) => [item.institution, item.degree, item.dates]),
].filter(Boolean);

export function detectFactWarnings(sourceText, resume) {
  const source = String(sourceText || '');
  const warnings = factualFields(resume)
    .filter((value) => !presentInSource(value, source))
    .map((value) => 'Structured output contains a factual value not found in the source: ' + value);
  const sourceNumbers = new Set(source.match(/\b(?:19|20)\d{2}\b|\b\d+(?:\.\d+)?%?\b/g) || []);
  const outputNumbers = resume.experience.concat(resume.education).flatMap((item) => [item.startDate, item.endDate, item.dates, item.text, ...(item.bullets || [])]).join(' ').match(/\b(?:19|20)\d{2}\b|\b\d+(?:\.\d+)?%?\b/g) || [];
  for (const number of outputNumbers) if (!sourceNumbers.has(number)) warnings.push('Structured output contains a number not found in the source: ' + number);
  return [...new Set(warnings)];
}

const schemaDescription = '{"contact":{"name":"","email":"","phone":"","linkedin":"","website":""},"summary":"","experience":[{"company":"","title":"","location":"","startDate":"","endDate":"","bullets":[]}],"education":[{"institution":"","degree":"","dates":"","text":""}],"skills":[]}';

const sourceTextForBody = (body) => body.mode === 'rewrite' ? body.text : [
  body.data?.name, body.data?.email, body.data?.phone, body.data?.linkedin, body.data?.website,
  body.data?.education, body.data?.experience, body.data?.skills,
].filter(Boolean).join('\n');

export function promptFor(body) {
  const source = sourceTextForBody(body);
  return [
    'Rewrite the resume content into the structured JSON schema below.',
    'Return only valid JSON. Do not include markdown, commentary, HTML, formatting instructions, scores, or extra keys.',
    'Preserve the source as authoritative. Improve wording and organization only; never invent employers, titles, dates, degrees, technologies, metrics, achievements, or contact information.',
    'Preserve all important source sections and factual achievements. Use empty strings or arrays when a value is unavailable.',
    'Target role: ' + (body.targetRole || 'not specified'),
    'Required schema: ' + schemaDescription,
    'SOURCE RESUME:',
    source,
  ].join('\n\n');
}

const improvementPromptFor = (resume, report, targetRole) => {
  const deficiencies = report.categories
    .filter((category) => category.awarded < category.maximum)
    .map((category) => `${category.name}: ${category.awarded}/${category.maximum}`)
    .join('; ') || 'No remaining deterministic deficiencies';
  return [
    'Improve the resume below by addressing only the listed deterministic deficiencies.',
    'Return only valid JSON matching the required schema. Do not include markdown, commentary, formatting instructions, scores, or extra keys.',
    'Preserve every source fact and all important content. Never invent or change employers, titles, dates, degrees, technologies, metrics, achievements, or contact information.',
    'Make the smallest necessary improvements; do not delete experience, education, skills, bullets, or contact fields.',
    'Target role: ' + (targetRole || 'not specified'),
    'Deficiencies: ' + deficiencies,
    'Required schema: ' + schemaDescription,
    'CURRENT CANONICAL RESUME JSON:',
    JSON.stringify(resume),
  ].join('\n\n');
};

const completenessOf = (resume) => ({
  experience: resume.experience.length,
  education: resume.education.length,
  skills: resume.skills.length,
  bullets: resume.experience.reduce((total, item) => total + item.bullets.length, 0),
  contact: ['email', 'phone', 'linkedin', 'website'].filter((key) => resume.contact[key]).length,
});

export function isSufficientlyComplete(candidate, baseline) {
  const candidateCounts = completenessOf(candidate);
  const baselineCounts = completenessOf(baseline);
  return Object.keys(baselineCounts).every((key) => candidateCounts[key] >= baselineCounts[key]);
}

export async function optimizeResume(initialResume, sourceText, options = {}) {
  const config = { ...OPTIMIZATION_CONFIG, ...options };
  const aiCall = options.aiCall;
  if (typeof aiCall !== 'function') throw new TypeError('optimizeResume requires an aiCall function.');

  const initialReport = validateCanonicalResume(initialResume);
  let bestResume = initialResume;
  let bestReport = initialReport;
  let calls = 0;
  let iterations = 0;
  let invalidCandidates = 0;
  let noImprovement = 0;
  const warnings = [];

  while (iterations < config.maxIterations && calls < config.maxTotalAiCalls && bestReport.finalScore < config.targetScore) {
    iterations += 1;
    calls += 1;
    let candidate;
    try {
      const response = await aiCall(improvementPromptFor(bestResume, bestReport, options.targetRole));
      candidate = parseStructuredResume(response);
    } catch (error) {
      invalidCandidates += 1;
      warnings.push(error instanceof Error ? error.message : 'AI improvement failed.');
      if (invalidCandidates >= config.maxInvalidCandidates) break;
      continue;
    }

    const factWarnings = detectFactWarnings(sourceText, candidate);
    if (factWarnings.length) {
      warnings.push('AI improvement rejected because unsupported factual additions were detected.');
      break;
    }
    if (!isSufficientlyComplete(candidate, initialResume)) {
      warnings.push('AI improvement rejected because it removed important resume content.');
      break;
    }
    const report = validateCanonicalResume(candidate);
    if (report.finalScore < bestReport.finalScore + config.minimumImprovement) {
      warnings.push('AI improvement did not make a meaningful score improvement.');
      noImprovement += 1;
      if (noImprovement >= config.maxNoImprovement) break;
      continue;
    }
    bestResume = candidate;
    bestReport = report;
    noImprovement = 0;
  }

  return {
    resume: bestResume,
    text: canonicalResumeToText(bestResume),
    report: bestReport,
    score: bestReport.finalScore,
    factWarnings: detectFactWarnings(sourceText, bestResume),
    optimization: {
      iterations,
      calls,
      initialScore: initialReport.finalScore,
      finalScore: bestReport.finalScore,
      targetReached: bestReport.finalScore >= config.targetScore,
      warnings: [...new Set(warnings)],
    },
  };
}

const allowed = (req) => {
  const address = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (requests.get(address) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 8) return false;
  recent.push(now);
  requests.set(address, recent);
  return true;
};

const send = (res, status, payload) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(payload));
};

const readBody = async (req) => {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error('Request is too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

async function requestAi(body, prompt = promptFor(body)) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiTimeoutMs);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('AI provider request failed');
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('AI provider returned an empty response');
    return content;
  } finally {
    clearTimeout(timer);
  }
}

export async function handleResumeRequest(body) {
  if (!body || !['create', 'rewrite'].includes(body.mode)) throw new AiResumeSchemaError('Invalid request');
  if (body.mode === 'rewrite' && typeof body.text !== 'string') throw new AiResumeSchemaError('Invalid request');
  const content = await requestAi(body);
  const resume = parseStructuredResume(content);
  const sourceText = sourceTextForBody(body);
  const factWarnings = detectFactWarnings(sourceText, resume);
  const result = await optimizeResume(resume, sourceText, {
    targetRole: body.targetRole,
    maxIterations: OPTIMIZATION_CONFIG.maxIterations,
    maxTotalAiCalls: OPTIMIZATION_CONFIG.maxTotalAiCalls - 1,
    aiCall: (prompt) => requestAi(body, prompt),
  });
  return {
    ...result,
    factWarnings: [...new Set([...factWarnings, ...result.factWarnings])],
    optimization: { ...result.optimization, calls: result.optimization.calls + 1 },
  };
}

async function startServer() {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/api/health') return send(res, 200, { ok: true });
    if (req.method !== 'POST' || req.url !== '/api/resume') return send(res, 404, { error: 'Not found' });
    if (!allowed(req)) return send(res, 429, { error: 'Please wait before trying again' });
    if (!process.env.OPENAI_API_KEY) return send(res, 503, { error: 'AI service is not configured' });
    try {
      const body = await readBody(req);
      return send(res, 200, await handleResumeRequest(body));
    } catch (error) {
      if (error instanceof AiResumeSchemaError) return send(res, 422, { error: error.message });
      if (error instanceof SyntaxError) return send(res, 400, { error: 'Invalid request' });
      if (error?.name === 'AbortError') return send(res, 504, { error: 'AI service timed out' });
      return send(res, 502, { error: 'AI service is temporarily unavailable' });
    }
  });
  server.listen(port, '127.0.0.1', () => console.log('resume API listening on 127.0.0.1:' + port));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) startServer();
