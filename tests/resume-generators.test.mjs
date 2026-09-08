import test from 'node:test';
import assert from 'node:assert/strict';
import { generateResumeDocx, generateResumePdf, generateResumeText } from '../src/lib/resume-generators.mjs';

const completeResume = {
  contact: { name: 'Zoë García', email: 'zoe@example.com', phone: '+1 555 000 1234', linkedin: 'https://linkedin.com/in/zoe', website: 'https://zoe.example.com' },
  summary: 'Platform engineer who improves reliable systems.',
  experience: [
    { company: 'Acme Labs', title: 'Senior Engineer', location: 'Remote', startDate: 'Jan 2020', endDate: 'Mar 2024', bullets: ['Designed distributed services that reduced latency across production environments.', 'Led a small platform team.'] },
    { company: 'Beta Systems', title: 'Engineer', location: '', startDate: '2017', endDate: '2019', bullets: ['Built deployment automation.'] },
  ],
  education: [{ institution: 'Example University', degree: 'BEng Computer Science', dates: '2017', text: '' }],
  skills: ['JavaScript', 'Kubernetes'],
  metadata: { sourceFormat: 'txt', parserWarnings: [], unmappedText: [] },
};

test('canonical text generation preserves sections, entries, bullets, and Unicode', () => {
  const text = generateResumeText(completeResume);
  for (const value of ['Zoë García', 'PROFESSIONAL SUMMARY', 'CORE SKILLS', 'PROFESSIONAL EXPERIENCE', 'EDUCATION', 'Acme Labs', 'Beta Systems', 'Designed distributed services', 'Led a small platform team', 'JavaScript']) {
    assert.match(text, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal(text.split('\n').filter((line) => line.includes('•')).length, 3);
});

test('missing optional fields do not create malformed output', () => {
  const minimal = { contact: { name: 'A', email: '', phone: '', linkedin: '', website: '' }, summary: '', experience: [], education: [], skills: [] };
  const text = generateResumeText(minimal);
  assert.equal(text, 'A');
  assert.doesNotMatch(text, /undefined|null/);
});

class FakePdf {
  static instances = [];
  constructor() {
    this.lines = [];
    this.pages = 1;
    this.internal = { pageSize: { getWidth: () => 300, getHeight: () => 100 } };
    FakePdf.instances.push(this);
  }
  setFont() {}
  setFontSize() {}
  splitTextToSize(value) { return String(value).match(/.{1,42}(?:\s|$)|.{1,42}/g) || []; }
  text(value) { this.lines.push(String(value)); }
  addPage() { this.pages += 1; }
  save() {}
}

test('PDF generation consumes canonical fields directly and safely creates pages', () => {
  const pdf = generateResumePdf(completeResume, FakePdf);
  const output = pdf.lines.join('\n');
  assert.match(output, /PROFESSIONAL EXPERIENCE/);
  assert.match(output, /Designed distributed services/);
  assert.match(output, /Beta Systems/);
  assert.match(output, /Zoë García/);
  assert.ok(pdf.pages > 1);
});

class FakeParagraph {
  constructor(options) { Object.assign(this, options); }
}
class FakeDocument {
  constructor(options) { this.sections = options.sections; }
}

test('DOCX generation preserves paragraph boundaries and bullet structure', () => {
  const document = generateResumeDocx(completeResume, { Document: FakeDocument, Paragraph: FakeParagraph, HeadingLevel: { HEADING_2: 'heading2' } });
  const children = document.sections[0].children;
  const bullets = children.filter((child) => child.bullet);
  assert.equal(bullets.length, 3);
  assert.deepEqual(bullets.map((child) => child.text), ['Designed distributed services that reduced latency across production environments.', 'Led a small platform team.', 'Built deployment automation.']);
  assert.ok(children.some((child) => child.text === 'EDUCATION' && child.heading === 'heading2'));
});

test('long and Unicode content is passed to both generators without factual rewriting', () => {
  const value = { ...completeResume, summary: 'Résumé résumé '.repeat(100) };
  const text = generateResumeText(value);
  const pdf = generateResumePdf(value, FakePdf);
  const document = generateResumeDocx(value, { Document: FakeDocument, Paragraph: FakeParagraph, HeadingLevel: { HEADING_2: 'heading2' } });
  assert.match(text, /Résumé résumé/);
  assert.ok(pdf.pages > 1);
  assert.ok(document.sections[0].children.some((child) => child.text.includes('Résumé résumé')));
});
