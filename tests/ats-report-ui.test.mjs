import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOptimizationView } from '../src/lib/ats-report-ui.mjs';

const original = {
  contact: { name: 'Taylor Kim', email: 'taylor@example.com', phone: '', linkedin: '', website: '' },
  summary: 'Worker.',
  experience: [{ company: '', title: '', location: '', startDate: '', endDate: '', bullets: ['Did tasks.'] }],
  education: [],
  skills: [],
};

const report = { categories: [{ name: 'Contact information', awarded: 15, maximum: 20 }, { name: 'Achievement bullets', awarded: 9, maximum: 15 }] };

test('UI mapping displays the authoritative final score and actual improvement', () => {
  const result = {
    resume: { ...original, summary: 'Experienced professional delivering dependable work.', experience: [{ ...original.experience[0], bullets: ['Delivered work reliably.', 'Improved team workflows.'] }] },
    score: 62,
    report,
    optimization: { initialScore: 37, finalScore: 62, warnings: [] },
    factWarnings: [],
  };
  const view = buildOptimizationView({ originalResume: original, result: { ...result, score: 62, aiScore: 100 } });
  assert.equal(view.initialScore, 37);
  assert.equal(view.finalScore, 62);
  assert.equal(view.scoreImprovement, 25);
  assert.match(view.messages.join(' '), /Improved score by 25 points/);
  assert.match(view.messages.join(' '), /Updated 2 achievement bullets/);
});

test('target-already-reached score remains authoritative and no unnecessary optimization is implied', () => {
  const view = buildOptimizationView({ originalResume: original, result: {
    resume: original,
    score: 95,
    report,
    optimization: { initialScore: 95, finalScore: 95, warnings: [] },
    factWarnings: [],
  } });
  assert.equal(view.finalScore, 95);
  assert.deepEqual(view.messages, ['No changes were accepted; your original resume was retained.']);
});

test('optimization warnings appear only when returned by the API', () => {
  const result = { resume: original, score: 37, report, optimization: { initialScore: 37, finalScore: 37, warnings: ['AI improvement failed.'] }, factWarnings: [] };
  const withWarnings = buildOptimizationView({ originalResume: original, result });
  assert.deepEqual(withWarnings.warnings, ['AI improvement failed.']);
  const withoutWarnings = buildOptimizationView({ originalResume: original, result: { ...result, optimization: { ...result.optimization, warnings: [] } } });
  assert.deepEqual(withoutWarnings.warnings, []);
});

test('category breakdown is copied from the server report without recalculation', () => {
  const categories = [{ name: 'Contact information', awarded: 18, maximum: 20 }, { name: 'Standard sections', awarded: 27, maximum: 30 }];
  const view = buildOptimizationView({ originalResume: original, result: { resume: original, score: 45, report: { categories }, optimization: { initialScore: 45, finalScore: 45, warnings: [] } } });
  assert.deepEqual(view.categories, categories);
  assert.equal(view.finalScore, 45);
});
