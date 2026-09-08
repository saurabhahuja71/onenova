import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyResume, normalizeBullets, normalizeContact, normalizeResume, toCanonicalResume } from '../src/lib/resume-model.mjs';
import { validate } from '../src/lib/resume-validator.mjs';

test('createEmptyResume returns the canonical empty shape', () => {
  const resume = createEmptyResume();
  assert.deepEqual(resume.contact, { name: '', email: '', phone: '', linkedin: '', website: '' });
  assert.deepEqual(resume.experience, []);
  assert.deepEqual(resume.education, []);
  assert.deepEqual(resume.skills, []);
  assert.deepEqual(resume.metadata, { sourceFormat: '', parserWarnings: [], unmappedText: [] });
});

test('normalizeResume creates a minimal valid resume and fills optional fields safely', () => {
  const resume = normalizeResume({ summary: '  A builder.  ', skills: [' JavaScript '] });
  assert.equal(resume.summary, 'A builder.');
  assert.deepEqual(resume.skills, ['JavaScript']);
  assert.deepEqual(resume.contact, { name: '', email: '', phone: '', linkedin: '', website: '' });
  assert.deepEqual(resume.experience, []);
  assert.deepEqual(resume.education, []);
});

test('normalization handles whitespace, empty arrays, and bullet boundaries', () => {
  assert.deepEqual(normalizeContact({ name: '  Alex  Morgan ', email: ' alex@example.com ' }), {
    name: 'Alex Morgan', email: 'alex@example.com', phone: '', linkedin: '', website: '',
  });
  assert.deepEqual(normalizeBullets(' • Built a thing\n\n- Improved it '), ['Built a thing', 'Improved it']);
  assert.deepEqual(normalizeResume({ skills: [], experience: [], education: [] }).skills, []);
});

test('complete resume preserves factual text and supports multiple entries', () => {
  const resume = normalizeResume({
    contact: { name: 'Alex Morgan', email: 'alex@example.com' },
    summary: 'Platform engineer with Kubernetes experience.',
    skills: ['Kubernetes', 'JavaScript'],
    experience: [
      { company: 'Acme', title: 'Engineer', location: 'Remote', startDate: '2020', endDate: '2022', bullets: ['Built deployment tooling', 'Reduced release time'] },
      { company: 'Beta', title: 'Senior Engineer', bullets: ['Led platform work'] },
    ],
    education: [{ institution: 'Example University', degree: 'BEng', dates: '2019', text: 'Computer engineering' }],
  });
  assert.equal(resume.experience.length, 2);
  assert.deepEqual(resume.experience[0].bullets, ['Built deployment tooling', 'Reduced release time']);
  assert.equal(resume.experience[1].company, 'Beta');
  assert.equal(resume.education[0].text, 'Computer engineering');
  assert.equal(resume.summary, 'Platform engineer with Kubernetes experience.');
});

test('toCanonicalResume adapts current raw validator input without inventing facts', () => {
  const raw = `Alex Morgan
alex@example.com | +1 555 123 4567 | https://linkedin.com/in/alexmorgan

PROFESSIONAL SUMMARY
Platform engineer.

CORE SKILLS
Kubernetes, JavaScript

PROFESSIONAL EXPERIENCE
- Built deployment tooling.
- Reduced release time.

EDUCATION
BEng, Example University, 2019`;
  const resume = toCanonicalResume(raw, 'docx');
  assert.equal(resume.contact.name, 'Alex Morgan');
  assert.equal(resume.contact.email, 'alex@example.com');
  assert.equal(resume.contact.phone, '+1 555 123 4567');
  assert.equal(resume.contact.linkedin, 'https://linkedin.com/in/alexmorgan');
  assert.deepEqual(resume.skills, ['Kubernetes', 'JavaScript']);
  assert.deepEqual(resume.experience[0].bullets, ['Built deployment tooling.', 'Reduced release time.']);
  assert.equal(resume.education[0].text, 'BEng, Example University, 2019');
  assert.equal(resume.metadata.sourceFormat, 'docx');
  assert.deepEqual(resume.metadata.unmappedText, []);
});

test('validator accepts canonical data and scores equivalent complete data consistently', () => {
  const detailLines = Array.from({ length: 45 }, (_, index) => `Candidate delivery result ${index + 1}.`);
  const canonical = normalizeResume({
    contact: { name: 'Alex Morgan', email: 'alex@example.com', phone: '+1 555 123 4567', linkedin: 'https://linkedin.com/in/alexmorgan' },
    summary: detailLines.join('\n'),
    skills: ['Kubernetes', 'JavaScript'],
    experience: [{ company: 'Acme', title: 'Engineer', bullets: ['Led platform work', 'Built tooling', 'Designed dashboards', 'Improved reliability', 'Delivered outcomes'] }],
    education: [{ institution: 'Example University', degree: 'BEng', dates: '2019' }],
  });
  const raw = `Alex Morgan\nalex@example.com | +1 555 123 4567 | https://linkedin.com/in/alexmorgan\n\nPROFESSIONAL SUMMARY\n${detailLines.join('\n')}\n\nCORE SKILLS\nKubernetes, JavaScript\n\nPROFESSIONAL EXPERIENCE\n- Led platform work\n- Built tooling\n- Designed dashboards\n- Improved reliability\n- Delivered outcomes\n\nEDUCATION\nBEng, Example University, 2019`;
  assert.equal(validate(canonical).finalScore, 100);
  assert.equal(validate(canonical).finalScore, validate(raw).finalScore);
});
