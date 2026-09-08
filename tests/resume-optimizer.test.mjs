import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalResumeToText, optimizeResume, parseStructuredResume, validateCanonicalResume } from '../server/resume-api.mjs';

const resume = (overrides = {}) => ({
  contact: { name: 'Alex Morgan', email: 'alex@example.com', phone: '+1 555 123 4567', linkedin: 'https://linkedin.com/in/alexmorgan', website: '' },
  summary: 'Engineer.',
  experience: [{ company: 'Acme', title: 'Engineer', location: 'Remote', startDate: '2020', endDate: '2024', bullets: ['Built tools'] }],
  education: [{ institution: 'Example University', degree: 'BEng', dates: '2020', text: '' }],
  skills: ['JavaScript'],
  metadata: { sourceFormat: '', parserWarnings: [], unmappedText: [] },
  ...overrides,
});

const improved = (overrides = {}) => {
  const base = resume(overrides);
  return {
    ...base,
    summary: Array(180).fill('Experienced engineer delivering reliable platform improvements.').join(' '),
    experience: base.experience.length ? [{ ...base.experience[0], bullets: ['Built deployment tooling', 'Improved service reliability', 'Automated release checks', 'Delivered platform features', 'Reduced operational toil'] }] : [],
    skills: base.skills,
  };
};

const sourceOf = (value) => canonicalResumeToText(value);
const aiJson = (value) => {
  const { metadata, ...structured } = value;
  return JSON.stringify(structured);
};
const mock = (...responses) => {
  let index = 0;
  return async () => responses[index++];
};

test('AI failure preserves the original valid resume', async () => {
  const original = resume();
  const result = await optimizeResume(original, sourceOf(original), { aiCall: async () => { throw new Error('timeout'); } });
  assert.equal(result.resume, original);
  assert.equal(result.score, validateCanonicalResume(original).finalScore);
  assert.equal(result.optimization.calls, 1);
});

test('a valid improvement replaces the original and preserves facts', async () => {
  const original = resume();
  const result = await optimizeResume(original, sourceOf(original), { aiCall: mock(aiJson(improved())) });
  assert.equal(result.resume.summary.startsWith('Experienced engineer'), true);
  assert.ok(result.score > validateCanonicalResume(original).finalScore);
});

test('lower and equal-scoring candidates are rejected', async () => {
  const original = improved();
  const result = await optimizeResume(original, sourceOf(original), {
    aiCall: mock(aiJson(resume()), aiJson(original)),
    maxNoImprovement: 2,
    maxIterations: 2,
    targetScore: 101,
  });
  assert.equal(result.resume, original);
  assert.equal(result.optimization.calls, 1);
});

test('malformed and schema-invalid candidates are rejected', async () => {
  const original = resume();
  const invalid = { ...improved(), finalScore: 100 };
  const result = await optimizeResume(original, sourceOf(original), {
    aiCall: mock('{bad json', aiJson(invalid)),
    maxInvalidCandidates: 2,
    maxIterations: 2,
  });
  assert.equal(result.resume, original);
  assert.equal(result.optimization.calls, 2);
});

test('unsupported facts and substantial content loss are rejected', async () => {
  const original = improved();
  const hallucination = improved({ experience: [{ ...original.experience[0], company: 'Unsupported Corp' }] });
  const loss = improved({ experience: [], education: [], skills: [] });
  const result = await optimizeResume(original, sourceOf(original), {
    aiCall: mock(aiJson(hallucination), aiJson(loss)),
    maxIterations: 2,
    maxNoImprovement: 2,
    targetScore: 101,
  });
  assert.equal(result.resume, original);
  assert.match(result.optimization.warnings.join(' '), /unsupported factual additions/);
});

test('target score stops further calls', async () => {
  const original = resume();
  let calls = 0;
  const result = await optimizeResume(original, sourceOf(original), {
    targetScore: 70,
    aiCall: async () => { calls += 1; return aiJson(improved()); },
  });
  assert.equal(calls, 1);
  assert.equal(result.optimization.targetReached, true);
});

test('maximum iterations and total AI calls are enforced', async () => {
  const original = resume();
  let calls = 0;
  const result = await optimizeResume(original, sourceOf(original), {
    maxIterations: 3,
    maxTotalAiCalls: 2,
    targetScore: 101,
    maxNoImprovement: 10,
    aiCall: async () => { calls += 1; return aiJson(original); },
  });
  assert.equal(calls, 2);
  assert.equal(result.optimization.iterations, 2);
});

test('no-improvement threshold stops the loop', async () => {
  const original = resume();
  let calls = 0;
  const result = await optimizeResume(original, sourceOf(original), {
    maxIterations: 3,
    maxNoImprovement: 1,
    targetScore: 101,
    aiCall: async () => { calls += 1; return aiJson(original); },
  });
  assert.equal(calls, 1);
  assert.equal(result.resume, original);
});

test('highest-scoring version remains selected after a later regression', async () => {
  const original = resume();
  const best = improved();
  const result = await optimizeResume(original, sourceOf(original), {
    maxIterations: 3,
    maxNoImprovement: 2,
    targetScore: 101,
    aiCall: mock(aiJson(best), aiJson(resume()), aiJson(resume({ summary: 'Another weaker version.' }))),
  });
  assert.equal(result.resume.summary, best.summary);
  assert.equal(result.score, validateCanonicalResume(best).finalScore);
});

test('AI-provided score cannot affect candidate selection', async () => {
  const original = resume();
  const claimed = { ...improved(), finalScore: 100 };
  const result = await optimizeResume(original, sourceOf(original), { aiCall: mock(JSON.stringify(claimed)) });
  assert.equal(result.resume, original);
  assert.equal(result.optimization.calls, 1);
});

test('timeout/error returns the best version already found', async () => {
  const original = resume();
  const best = improved();
  let calls = 0;
  const result = await optimizeResume(original, sourceOf(original), {
    maxIterations: 3,
    maxNoImprovement: 2,
    targetScore: 101,
    aiCall: async () => {
      calls += 1;
      if (calls === 1) return aiJson(best);
      throw new Error('AI service timed out');
    },
  });
  assert.equal(result.resume.summary, best.summary);
  assert.equal(result.score, validateCanonicalResume(best).finalScore);
  assert.match(result.optimization.warnings.join(' '), /timed out/);
});

test('structured candidates are parsed before optimization', () => {
  assert.equal(parseStructuredResume(aiJson(resume())).metadata.parserWarnings.length, 0);
});
