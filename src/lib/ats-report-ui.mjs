const coreResume = (resume = {}) => ({
  contact: resume.contact || {},
  summary: resume.summary || '',
  experience: (resume.experience || []).map((item) => ({ ...item, bullets: item.bullets || [] })),
  education: resume.education || [],
  skills: resume.skills || [],
});

const flattenedBullets = (resume) => coreResume(resume).experience.flatMap((item) => item.bullets);

export function buildOptimizationView({ originalResume, result }) {
  const original = coreResume(originalResume);
  const finalResume = coreResume(result?.resume);
  const initialScore = Number(result?.optimization?.initialScore ?? 0);
  const finalScore = Number(result?.score ?? 0);
  const originalBullets = flattenedBullets(original);
  const finalBullets = flattenedBullets(finalResume);
  const changedBullets = Array.from({ length: Math.max(originalBullets.length, finalBullets.length) }, (_, index) => originalBullets[index] !== finalBullets[index]).filter(Boolean).length;
  const summaryChanged = original.summary !== finalResume.summary;
  const contentChanged = JSON.stringify(original) !== JSON.stringify(finalResume);
  const warnings = Array.isArray(result?.optimization?.warnings) ? result.optimization.warnings.filter(Boolean) : [];
  const messages = [];
  if (finalScore > initialScore) messages.push(`Improved score by ${finalScore - initialScore} points.`);
  if (changedBullets) messages.push(`Updated ${changedBullets} achievement bullet${changedBullets === 1 ? '' : 's'}.`);
  if (summaryChanged) messages.push('Refined the professional summary.');
  if (contentChanged && finalResume.experience.length === original.experience.length && finalResume.experience.length) {
    messages.push(`Preserved ${finalResume.experience.length} experience entr${finalResume.experience.length === 1 ? 'y' : 'ies'}.`);
  }
  if (contentChanged && !result?.factWarnings?.length) messages.push('No unsupported facts were accepted.');
  if (!contentChanged) messages.push('No changes were accepted; your original resume was retained.');
  return {
    initialScore,
    finalScore,
    scoreImprovement: finalScore - initialScore,
    changed: contentChanged,
    messages,
    warnings: [...new Set(warnings)],
    categories: Array.isArray(result?.report?.categories) ? result.report.categories.map(({ name, awarded, maximum }) => ({ name, awarded, maximum })) : [],
  };
}
