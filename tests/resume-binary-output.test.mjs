import test from 'node:test';
import assert from 'node:assert/strict';
import { docxHtmlToText, pdfPageToText, pdfPagesToText } from '../src/lib/document-parsers.mjs';
import { generateResumeDocx, generateResumePdf, generateResumeText } from '../src/lib/resume-generators.mjs';

let dependencies;
try {
  dependencies = {
    docx: await import('docx'),
    mammoth: await import('mammoth'),
    jspdf: await import('jspdf'),
    pdfjs: await import('pdfjs-dist/legacy/build/pdf.mjs'),
  };
} catch {
  dependencies = null;
}

const resume = {
  contact: { name: 'Zoë García', email: 'zoe@example.com', phone: '+1 555 000 1234', linkedin: 'https://linkedin.com/in/zoe', website: '' },
  summary: 'Platform engineer focused on dependable systems.',
  experience: [
    { company: 'Acme Labs', title: 'Senior Engineer', location: 'Remote', startDate: 'Jan 2020', endDate: 'Mar 2024', bullets: ['Designed services that reduced latency across production environments.', 'Led platform delivery.'] },
    { company: 'Beta Systems', title: 'Engineer', location: '', startDate: '2017', endDate: '2019', bullets: ['Built deployment automation.'] },
  ],
  education: [{ institution: 'Example University', degree: 'BEng Computer Science', dates: '2017', text: '' }],
  skills: ['JavaScript', 'Kubernetes'],
};

const expected = ['Zoë García', 'zoe@example.com', 'Acme Labs', 'Senior Engineer', 'Designed services that reduced latency', 'Beta Systems', 'Built deployment automation', 'Kubernetes', 'BEng Computer Science'];

test('real PDF generated from canonical Resume round-trips with content intact', { skip: !dependencies }, async () => {
  const pdf = generateResumePdf(resume, dependencies.jspdf.jsPDF);
  const buffer = pdf.output('arraybuffer');
  assert.ok(buffer.byteLength > 0);
  const document = await dependencies.pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true }).promise;
  const pages = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const content = await page.getTextContent();
    pages.push(pdfPageToText(content.items));
  }
  const extracted = pdfPagesToText(pages).text;
  for (const value of expected) assert.match(extracted, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(extracted, /PROFESSIONAL EXPERIENCE/);
  assert.ok(document.numPages >= 1);
});

test('real DOCX generated from canonical Resume round-trips with paragraphs and bullets intact', { skip: !dependencies }, async () => {
  const document = generateResumeDocx(resume, { Document: dependencies.docx.Document, HeadingLevel: dependencies.docx.HeadingLevel, Paragraph: dependencies.docx.Paragraph });
  const buffer = await dependencies.docx.Packer.toBuffer(document);
  assert.ok(buffer.byteLength > 0);
  const converted = await dependencies.mammoth.default.convertToHtml({ buffer });
  const extracted = docxHtmlToText(converted.value);
  for (const value of expected) assert.match(extracted, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal((extracted.match(/^- /gm) || []).length, 3);
});

test('all binary outputs originate from the same canonical content', () => {
  const text = generateResumeText(resume);
  assert.match(text, /Acme Labs/);
  assert.match(text, /Beta Systems/);
  assert.equal((text.match(/^• /gm) || []).length, 3);
});
