import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AiResumeSchemaError,
  canonicalResumeToText,
  detectFactWarnings,
  normalizeAiResume,
  parseStructuredResume,
  promptFor,
  validateAiResumeShape,
  validateCanonicalResume,
} from '../server/resume-api.mjs';

const validOutput = () => ({
  contact: { name: 'Alex Morgan', email: 'alex@example.com', phone: '+1 555 123 4567', linkedin: 'https://linkedin.com/in/alexmorgan', website: '' },
  summary: 'Platform engineer with reliable systems experience.',
  experience: [{ company: 'Acme', title: 'Engineer', location: 'Remote', startDate: '2020', endDate: '2024', bullets: ['Built deployment tooling', 'Improved release reliability'] }],
  education: [{ institution: 'Example University', degree: 'BEng', dates: '2020', text: '' }],
  skills: ['Kubernetes', 'JavaScript'],
});

test('valid structured AI output is schema-validated and normalized into canonical data', () => {
  const value = validOutput();
  value.summary = '  Platform   engineer. ';
  value.experience[0].bullets = ['• Built deployment tooling'];
  const resume = parseStructuredResume(JSON.stringify(value));
  assert.equal(resume.summary, 'Platform engineer.');
  assert.deepEqual(resume.experience[0].bullets, ['Built deployment tooling']);
  assert.deepEqual(resume.metadata, { sourceFormat: '', parserWarnings: [], unmappedText: [] });
});

test('malformed JSON and empty AI response are rejected', () => {
  assert.throws(() => parseStructuredResume('{not json'), AiResumeSchemaError);
  assert.throws(() => parseStructuredResume(''), /empty response/);
});

test('schema-invalid and missing required fields are rejected', () => {
  const value = validOutput();
  delete value.education;
  assert.throws(() => validateAiResumeShape(value), /required resume fields/);
  const invalid = validOutput();
  invalid.experience[0].bullets = 'not an array';
  assert.throws(() => normalizeAiResume(invalid), /experience is invalid/);
});

test('unexpected fields, including an AI score, are rejected by the strict schema', () => {
  const value = validOutput();
  value.finalScore = 100;
  assert.throws(() => parseStructuredResume(JSON.stringify(value)), /only the required resume fields/);
});

test('deterministic validator calculates the score and ignores any score-like source content', () => {
  const resume = parseStructuredResume(JSON.stringify(validOutput()));
  const report = validateCanonicalResume(resume);
  assert.equal(typeof report.finalScore, 'number');
  assert.ok(report.finalScore >= 0 && report.finalScore <= 100);
  assert.equal(Object.prototype.hasOwnProperty.call(resume, 'finalScore'), false);
  assert.equal(canonicalResumeToText(resume).includes('finalScore'), false);
});

test('obvious unsupported factual additions produce warnings', () => {
  const value = validOutput();
  value.experience[0].company = 'Unsupported Corp';
  value.experience[0].title = 'Chief Inventor';
  value.experience[0].startDate = '2011';
  value.experience[0].bullets = ['Increased revenue by 97%'];
  const resume = normalizeAiResume(value);
  const warnings = detectFactWarnings('Alex Morgan worked at Acme as an Engineer from 2020 to 2024.', resume);
  assert.ok(warnings.some((warning) => warning.includes('Unsupported Corp')));
  assert.ok(warnings.some((warning) => warning.includes('Chief Inventor')));
  assert.ok(warnings.some((warning) => warning.includes('2011')));
  assert.ok(warnings.some((warning) => warning.includes('97')));
});

test('valid wording improvements are accepted when factual fields remain supported', () => {
  const value = validOutput();
  value.summary = 'Experienced engineer focused on dependable platform delivery.';
  value.experience[0].bullets = ['Created reliable deployment workflows', 'Improved service reliability'];
  const resume = normalizeAiResume(value);
  const warnings = detectFactWarnings('Alex Morgan alex@example.com +1 555 123 4567 https://linkedin.com/in/alexmorgan Acme Engineer Remote 2020 2024 BEng Example University 2020 Kubernetes JavaScript Built deployment tooling Improved release reliability.', resume);
  assert.deepEqual(warnings, []);
});

test('source employers, titles, dates, and contact values are preserved without warnings', () => {
  const resume = normalizeAiResume(validOutput());
  const source = 'Alex Morgan alex@example.com +1 555 123 4567 https://linkedin.com/in/alexmorgan Acme Engineer Remote 2020 2024 BEng Example University 2020 Kubernetes JavaScript';
  assert.deepEqual(detectFactWarnings(source, resume), []);
});

test('prompt requests only structured resume JSON and excludes score authority', () => {
  const prompt = promptFor({ mode: 'rewrite', text: 'Acme Engineer 2020', targetRole: 'Platform Engineer' });
  assert.match(prompt, /Return only valid JSON/);
  assert.match(prompt, /never invent employers/);
  assert.doesNotMatch(prompt, /finalScore/);
});
