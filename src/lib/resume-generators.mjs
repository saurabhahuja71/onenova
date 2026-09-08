import { normalizeResume } from './resume-model.mjs';

const section = (lines, title, content) => {
  if (!content.length) return;
  lines.push('', title, ...content);
};

const experienceHeading = (item) => {
  const role = [item.title, item.company, item.location].filter(Boolean).join(' — ');
  const dates = [item.startDate, item.endDate].filter(Boolean).join(' – ');
  return [role, dates].filter(Boolean).join(' | ');
};

export function generateResumeText(value) {
  const resume = normalizeResume(value);
  const lines = [];
  const contact = [resume.contact.name, resume.contact.email, resume.contact.phone, resume.contact.linkedin, resume.contact.website].filter(Boolean).join(' | ');
  if (contact) lines.push(contact);
  section(lines, 'PROFESSIONAL SUMMARY', resume.summary ? [resume.summary] : []);
  section(lines, 'CORE SKILLS', resume.skills.length ? [resume.skills.join(', ')] : []);
  if (resume.experience.length) {
    lines.push('', 'PROFESSIONAL EXPERIENCE');
    for (const item of resume.experience) {
      const heading = experienceHeading(item);
      if (heading) lines.push(heading);
      for (const bullet of item.bullets) lines.push('• ' + bullet);
    }
  }
  if (resume.education.length) {
    lines.push('', 'EDUCATION');
    for (const item of resume.education) {
      const details = [item.degree, item.institution, item.dates, item.text].filter(Boolean).join(', ');
      if (details) lines.push(details);
    }
  }
  return lines.join('\n').trim();
}

export function generateResumePdf(value, JsPdf) {
  if (typeof JsPdf !== 'function') throw new TypeError('A jsPDF constructor is required.');
  const resume = normalizeResume(value);
  const pdf = new JsPdf({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const lineHeight = 15;
  let y = margin;
  const write = (text, options = {}) => {
    const lines = pdf.splitTextToSize(text, pageWidth - margin * 2);
    for (const line of lines) {
      if (y > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y, options);
      y += lineHeight;
    }
  };
  const heading = (text) => {
    if (y > pageHeight - margin - lineHeight) {
      pdf.addPage();
      y = margin;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    write(text);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    y += 4;
  };
  const contact = [resume.contact.name, resume.contact.email, resume.contact.phone, resume.contact.linkedin, resume.contact.website].filter(Boolean).join(' | ');
  if (contact) write(contact);
  if (resume.summary) { heading('PROFESSIONAL SUMMARY'); write(resume.summary); }
  if (resume.skills.length) { heading('CORE SKILLS'); write(resume.skills.join(', ')); }
  if (resume.experience.length) {
    heading('PROFESSIONAL EXPERIENCE');
    for (const item of resume.experience) {
      const details = experienceHeading(item);
      if (details) write(details);
      for (const bullet of item.bullets) write('• ' + bullet, { charSpace: 0 });
      y += 3;
    }
  }
  if (resume.education.length) {
    heading('EDUCATION');
    for (const item of resume.education) {
      const details = [item.degree, item.institution, item.dates, item.text].filter(Boolean).join(', ');
      if (details) write(details);
    }
  }
  return pdf;
}

export function generateResumeDocx(value, api) {
  const { Document, HeadingLevel, Paragraph } = api || {};
  if (typeof Document !== 'function' || typeof Paragraph !== 'function') throw new TypeError('DOCX constructors are required.');
  const resume = normalizeResume(value);
  const children = [];
  const paragraph = (text, options = {}) => children.push(new Paragraph({ text: text || ' ', spacing: { after: 100 }, ...options }));
  const heading = (text) => paragraph(text, { heading: HeadingLevel?.HEADING_2 });
  const contact = [resume.contact.name, resume.contact.email, resume.contact.phone, resume.contact.linkedin, resume.contact.website].filter(Boolean).join(' | ');
  if (contact) paragraph(contact);
  if (resume.summary) { heading('PROFESSIONAL SUMMARY'); paragraph(resume.summary); }
  if (resume.skills.length) { heading('CORE SKILLS'); paragraph(resume.skills.join(', ')); }
  if (resume.experience.length) {
    heading('PROFESSIONAL EXPERIENCE');
    for (const item of resume.experience) {
      const details = experienceHeading(item);
      if (details) paragraph(details);
      for (const bullet of item.bullets) paragraph(bullet, { bullet: { level: 0 } });
    }
  }
  if (resume.education.length) {
    heading('EDUCATION');
    for (const item of resume.education) {
      const details = [item.degree, item.institution, item.dates, item.text].filter(Boolean).join(', ');
      if (details) paragraph(details);
    }
  }
  return new Document({ sections: [{ properties: {}, children }] });
}
