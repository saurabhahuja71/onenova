import test from 'node:test';
import assert from 'node:assert/strict';
import { SCORE_CONTRACT, SCORE_MAXIMUM, validate } from '../src/lib/resume-validator.mjs';

const perfectResume = `Alex Morgan
alex.morgan@example.com | +1 555 123 4567 | https://linkedin.com/in/alexmorgan

PROFESSIONAL SUMMARY
Platform engineer with a proven record of building reliable systems and improving delivery outcomes.

CORE SKILLS
Cloud infrastructure, Kubernetes, JavaScript, observability, automation

PROFESSIONAL EXPERIENCE
- Led platform modernization across multiple engineering teams.
- Built automated deployment workflows that reduced release effort.
- Designed service dashboards and improved incident response.
- Delivered resilient infrastructure for critical workloads.
- Managed technical delivery and implemented repeatable operating practices.

EDUCATION
Bachelor of Engineering, Example University, 2018
${Array.from({ length: 25 }, (_, index) => `Delivered measurable platform outcome ${index + 1}.`).join('\n')}`;

test('scoring weights total exactly 100', () => {
  assert.equal(SCORE_CONTRACT.reduce((sum, category) => sum + category.maximum, 0), 100);
  assert.equal(SCORE_MAXIMUM, 100);
});

test('a deliberately constructed perfect resume scores 100', () => {
  const report = validate(perfectResume);
  assert.equal(report.finalScore, 100);
  assert.ok(report.categories.every((category) => category.awarded === category.maximum));
});

test('missing contact information reduces the appropriate score', () => {
  const report = validate(perfectResume.replace('alex.morgan@example.com | +1 555 123 4567 | https://linkedin.com/in/alexmorgan', 'Alex Morgan'));
  const contact = report.categories.find((category) => category.id === 'contact');
  assert.equal(contact.awarded, 0);
  assert.ok(contact.issues.length >= 3);
});

test('missing sections reduce the appropriate score', () => {
  const report = validate(perfectResume.replace('CORE SKILLS', 'TOOLS').replace('EDUCATION\nBachelor', 'TRAINING\nBachelor'));
  const sections = report.categories.find((category) => category.id === 'sections');
  assert.equal(sections.awarded, 16);
  assert.equal(report.sections.skills, false);
  assert.equal(report.sections.education, false);
  assert.equal(sections.issues.length, 2);
});

test('insufficient bullets reduce the appropriate score', () => {
  const report = validate(perfectResume.replace(/^- .+$/gm, '').replace('PROFESSIONAL EXPERIENCE\n', 'PROFESSIONAL EXPERIENCE\n- Led one project.\n'));
  const bullets = report.categories.find((category) => category.id === 'bullets');
  assert.equal(report.bulletCount, 1);
  assert.equal(bullets.awarded, 3);
  assert.ok(bullets.issues.length > 0);
});

test('length rules award full, partial, and zero points', () => {
  const full = validate(`${perfectResume}\nRelevant experience.`);
  const partial = validate(`Alex Morgan\n${'Relevant experience. '.repeat(45)}`);
  const short = validate('Alex Morgan');
  assert.equal(full.categories.find((category) => category.id === 'length').awarded, 15);
  assert.equal(partial.categories.find((category) => category.id === 'length').awarded, 8);
  assert.equal(short.categories.find((category) => category.id === 'length').awarded, 0);
});

test('action-word rules award points and cap at the category maximum', () => {
  const none = validate('A short resume with ordinary wording.');
  const many = validate(`${perfectResume} led built designed developed improved delivered managed created automated reduced increased launched implemented`);
  assert.equal(none.categories.find((category) => category.id === 'action-language').awarded, 0);
  assert.equal(many.categories.find((category) => category.id === 'action-language').awarded, 10);
});

test('score never exceeds 100', () => {
  const report = validate(`${perfectResume}\n${'led built designed improved delivered '.repeat(100)}`);
  assert.ok(report.finalScore <= 100);
});

test('score never goes below 0', () => {
  const report = validate('');
  assert.ok(report.finalScore >= 0);
  assert.equal(report.finalScore, 0);
});
