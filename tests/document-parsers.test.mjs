import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { docxHtmlToText, pdfPageToText, pdfPagesToText, textToText } from '../src/lib/document-parsers.mjs';
import { createEmptyResume, toCanonicalResume } from '../src/lib/resume-model.mjs';
import { SCORE_MAXIMUM, validate } from '../src/lib/resume-validator.mjs';

const fixture = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('PDF item positions produce stable reading order and line boundaries', async () => {
  const source = await fixture('./fixtures/pdf/single-column.pdf.json');
  const text = pdfPageToText(source.pages[0].items).text;
  assert.equal(text, 'Alex Morgan\nalex@example.com\nPROFESSIONAL SUMMARY\nPlatform engineer\nwith reliable systems.');
});

test('PDF wrapped bullets remain one canonical bullet', () => {
  const text = 'PROFESSIONAL EXPERIENCE\n• Designed distributed database services that reduced latency\n  across multiple production environments.';
  const resume = toCanonicalResume(text, 'pdf');
  assert.deepEqual(resume.experience[0].bullets, ['Designed distributed database services that reduced latency across multiple production environments.']);
});

test('PDF page boundaries remain separated and repeated chrome is warned about', async () => {
  const source = await fixture('./fixtures/pdf/multiple-pages.pdf.json');
  const pages = source.pages.map((page) => pdfPageToText(page.items));
  const result = pdfPagesToText(pages);
  assert.equal(result.text, 'Page one content\n\nPage two content');
  assert.doesNotMatch(result.text, /Page one content Page two content/);
  assert.ok(result.warnings.some((warning) => warning.includes('Repeated page')));
});

test('repeated PDF header is removed before contact extraction while a body name is retained', () => {
  const pages = [
    pdfPageToText([
      { str: 'Jordan Lee | Resume', transform: [1, 0, 0, 1, 48, 780] },
      { str: 'Jordan Lee', transform: [1, 0, 0, 1, 48, 750] },
      { str: 'SUMMARY', transform: [1, 0, 0, 1, 48, 720] },
      { str: 'Engineer.', transform: [1, 0, 0, 1, 48, 700] },
    ]),
    pdfPageToText([
      { str: 'Jordan Lee | Resume', transform: [1, 0, 0, 1, 48, 780] },
      { str: 'EXPERIENCE', transform: [1, 0, 0, 1, 48, 720] },
      { str: '- Built systems.', transform: [1, 0, 0, 1, 48, 700] },
    ]),
  ];
  const result = pdfPagesToText(pages);
  const resume = toCanonicalResume(result.text, 'pdf', result.warnings);
  assert.equal(resume.contact.name, 'Jordan Lee');
  assert.doesNotMatch(result.text, /Jordan Lee \| Resume/);
  assert.ok(resume.metadata.parserWarnings.some((warning) => warning.includes('Repeated page')));
});

test('a legitimate name near a page edge is retained when it is not repeated chrome', () => {
  const result = pdfPagesToText([
    pdfPageToText([{ str: 'Jordan Lee', transform: [1, 0, 0, 1, 48, 780] }, { str: 'SUMMARY', transform: [1, 0, 0, 1, 48, 720] }]),
    pdfPageToText([{ str: 'EXPERIENCE', transform: [1, 0, 0, 1, 48, 720] }, { str: '- Built systems.', transform: [1, 0, 0, 1, 48, 700] }]),
  ]);
  assert.equal(toCanonicalResume(result.text, 'pdf').contact.name, 'Jordan Lee');
});

test('multi-column-like PDF coordinates produce a recoverable warning', async () => {
  const source = await fixture('./fixtures/pdf/multi-column.pdf.json');
  const result = pdfPageToText(source.pages[0].items);
  assert.match(result.text, /SUMMARY/);
  assert.match(result.text, /SKILLS/);
  assert.ok(result.warnings.some((warning) => warning.includes('horizontal text regions')));
});

test('DOCX HTML conversion preserves paragraph and list boundaries', async () => {
  const html = await readFile(new URL('./fixtures/docx/headings-and-lists.html', import.meta.url), 'utf8');
  const text = docxHtmlToText(html);
  assert.equal(text, 'Alex Morgan\nalex@example.com | +1 555 123 4567\nPROFESSIONAL EXPERIENCE\nAcme — Engineer\n- Built deployment tooling\n- Improved release reliability\nEDUCATION\nBEng, Example University, 2020');
  const resume = toCanonicalResume(text, 'docx');
  assert.deepEqual(resume.experience[0].bullets, ['Acme — Engineer', 'Built deployment tooling', 'Improved release reliability']);
});

test('dated experience headings become metadata instead of bullets', () => {
  const resume = toCanonicalResume(`EXPERIENCE
Acme Labs — Engineer | 2020 – 2024
- Designed services.
- Improved reliability.
Beta Systems — Developer | Jan 2017 - Mar 2019
- Built automation.`, 'txt');
  assert.equal(resume.experience.length, 2);
  assert.deepEqual(resume.experience.map(({ company, title, startDate, endDate }) => ({ company, title, startDate, endDate })), [
    { company: 'Acme Labs', title: 'Engineer', startDate: '2020', endDate: '2024' },
    { company: 'Beta Systems', title: 'Developer', startDate: 'Jan 2017', endDate: 'Mar 2019' },
  ]);
  assert.deepEqual(resume.experience.map((entry) => entry.bullets), [['Designed services.', 'Improved reliability.'], ['Built automation.']]);
});

test('normal dashed achievement bullets remain bullets and DOCX-derived text uses the same rule', () => {
  const html = '<h2>EXPERIENCE</h2><p>Acme Labs — Engineer | 2020 – 2024</p><ul><li>Reduced errors — across services.</li><li>Built tooling.</li></ul>';
  const resume = toCanonicalResume(docxHtmlToText(html), 'docx');
  assert.equal(resume.experience.length, 1);
  assert.equal(resume.experience[0].bullets.length, 2);
  assert.deepEqual(resume.experience[0].bullets, ['Reduced errors — across services.', 'Built tooling.']);
});

test('TXT enters the same canonical pipeline with aliases and case variation', async () => {
  const text = textToText(await readFile(new URL('./fixtures/resume.txt', import.meta.url), 'utf8'));
  const resume = toCanonicalResume(text, 'txt');
  assert.equal(resume.metadata.sourceFormat, 'txt');
  assert.equal(resume.summary, 'Platform engineer with reliable systems experience.');
  assert.deepEqual(resume.skills, ['Kubernetes', 'JavaScript']);
  assert.deepEqual(resume.experience[0].bullets, ['Built deployment tooling that reduced release effort across production environments.', 'Improved service reliability.']);
  assert.equal(resume.education[0].text, 'BEng, Example University, 2020');
});

test('separate bullets remain separate', () => {
  const resume = toCanonicalResume('EXPERIENCE\n- Built one thing\n- Improved another thing\n1. Delivered a third thing', 'txt');
  assert.deepEqual(resume.experience[0].bullets, ['Built one thing', 'Improved another thing', 'Delivered a third thing']);
});

test('explicit contact fields are extracted and missing fields remain empty', () => {
  const resume = toCanonicalResume('Alex Morgan\nalex@example.com | +1 555 123 4567 | https://linkedin.com/in/alexmorgan\nSUMMARY\nA summary.', 'txt');
  assert.deepEqual(resume.contact, {
    name: 'Alex Morgan', email: 'alex@example.com', phone: '+1 555 123 4567', linkedin: 'https://linkedin.com/in/alexmorgan', website: '',
  });
  const empty = toCanonicalResume('SUMMARY\nA summary.', 'txt');
  assert.deepEqual(empty.contact, { name: '', email: '', phone: '', linkedin: '', website: '' });
});

test('unmapped text is preserved and no factual fields are invented', () => {
  const resume = toCanonicalResume('Alex Morgan\nA factual note without a recognized section.', 'txt');
  assert.deepEqual(resume.experience, []);
  assert.deepEqual(resume.education, []);
  assert.deepEqual(resume.skills, []);
  assert.deepEqual(resume.metadata.unmappedText, ['A factual note without a recognized section.']);
  assert.ok(resume.metadata.parserWarnings.some((warning) => warning.includes('No recognized section headings')));
});

test('parser warnings are preserved through canonical conversion', () => {
  const resume = toCanonicalResume('SUMMARY\nA summary.', 'pdf', ['Repeated page header/footer text was removed after its first occurrence.']);
  assert.deepEqual(resume.metadata.parserWarnings, ['Repeated page header/footer text was removed after its first occurrence.']);
});

test('all supported parser outputs normalize to valid canonical models and retain scoring contract', () => {
  const empty = createEmptyResume();
  const fromTxt = toCanonicalResume('SUMMARY\nA summary.', 'txt');
  assert.deepEqual(Object.keys(empty), ['contact', 'summary', 'experience', 'education', 'skills', 'metadata']);
  assert.deepEqual(Object.keys(fromTxt), Object.keys(empty));
  assert.equal(validate(fromTxt).categories.reduce((sum, item) => sum + item.maximum, 0), SCORE_MAXIMUM);
});
