# Resume / ATS Application Architecture Review

## Current architecture

The application is currently a client-heavy Astro page with a small server-side AI proxy.

```text
User selects PDF/DOCX
        ↓
Browser reads file locally
        ↓
PDF.js or Mammoth extracts plain text
        ↓
Client-side heuristic validator scores raw text
        ↓
User optionally sends extracted text to /api/resume
        ↓
Node API sends free-form prompt to OpenAI
        ↓
API returns { text: "formatted resume..." }
        ↓
Browser displays text and generates TXT/DOCX/DOC/PDF
```

### 1. Upload → parsing → validation → rewrite → output

Main implementation:

- Upload UI and orchestration: `src/pages/ai-resume-validtor-ats.astro`
- File validation and reading: the `atsForm` submit handler
- Rewrite request: the `rewriteForm` submit handler
- Output generation: the download handlers for TXT, DOCX, DOC, and PDF

The file is processed locally in the browser. Only the extracted text is sent to the server for rewriting.

The separate Resume Creator follows a similar free-form text architecture in `src/pages/ai-resume-creator.astro`.

### 2. Scoring formula

The full scoring implementation is in `src/pages/ai-resume-validtor-ats.astro`, in the `validate(text)` function.

The current weights are:

| Component | Maximum |
|---|---:|
| Email | 8 |
| Phone | 5 |
| LinkedIn | 2 |
| Four sections | 32 |
| Bullets | 15 |
| Word count | 10 |
| Action words | 10 |
| Long-line penalty | -10 |
| Total theoretical maximum | 82 |

The result is clamped to 100, but it cannot reach 100 because the positive weights only total 82.

The score is presented as a 100-point score in `renderReport(report)`.

### 3. Parsing locations

PDF parsing is implemented by `extractPdf(buffer)` using `pdfjs-dist`.

DOCX parsing is implemented by `extractDocx(buffer)` using Mammoth.

TXT parsing does not currently exist. TXT is offered as a download format, but the upload input only accepts PDF and DOCX. If a TXT file were forced into the input, the code would treat it as DOCX and pass it to Mammoth.

### 4. Heading and bullet detection

Headings are detected by `hasSection(text, names)`.

Current behavior:

- Case-insensitive matching.
- Requires the heading at the beginning of the text or after a newline.
- Requires the heading to occupy a full line or end with `:`.
- Supports only a small hard-coded alias list.

Bullets are detected inside `validate(text)` by checking the beginning of each extracted line. Supported markers include `•`, `●`, `▪`, `◦`, `-`, `*`, and numbered bullets such as `1.`.

The implementation only counts bullets when the marker occurs at the beginning of an extracted line.

The PDF parser currently joins all PDF text items on a page with spaces. This can destroy heading and bullet boundaries.

### 5. AI rewrite representation

The AI output is unstructured text throughout the system.

The client sends:

```js
{ mode: 'rewrite', text, targetRole }
```

The server returns:

```js
{ text: 'formatted resume text' }
```

The server implementation is in `server/resume-api.mjs`.

The AI is instructed to produce four textual sections, but there is no schema, field-level validation, or guarantee that the output follows the requested structure.

The browser stores the result only in `rewriteOutput.textContent`.

### 6. Is rewritten output revalidated?

No.

The original input is validated once with `validate(extractedResume)`. After rewriting, the result is assigned directly to `rewriteOutput.textContent`. There is no call to `validate(rewritten)`.

When the downloaded document is uploaded again, it is parsed again and may produce different structure and a different score.

### 7. Existing tests and coverage

There are no dedicated resume, parser, validator, API, or round-trip tests.

The repository contains:

- Astro build/check scripts in `package.json`.
- CI that performs a fast Astro build in `.github/workflows/ci.yml`.
- A deployment workflow in `.github/workflows/deploy.yml`.
- A local static verification script in `deploy/scripts/verify-local.sh`.

The CI currently runs `pnpm run build:fast`, which does not run `astro check`.

There is no test framework configured and no test fixture directory.

### 8. Exact files and functions that should change

#### Existing files likely to change

- `src/pages/ai-resume-validtor-ats.astro`
  - Client orchestration.
  - Upload handling.
  - `extractPdf`.
  - `extractDocx`.
  - `cleanText`.
  - `hasSection`.
  - `validate`.
  - Rewrite result handling.
  - Output generation.

- `server/resume-api.mjs`
  - Structured AI request/response handling.
  - AI output validation.
  - Bounded optimization loop.
  - Request validation and response schema.

- `src/pages/ai-resume-creator.astro`
  - Eventually consume the same canonical resume model and output generators.

- `package.json`
  - Add test scripts and test dependencies.

- `.github/workflows/ci.yml`
  - Run unit, parser, round-trip, and API contract tests in CI.

#### New files recommended

```text
src/lib/resume/
  model.ts
  aliases.ts
  normalize.ts
  scoring.ts
  findings.ts
  parsers/
    pdf.ts
    docx.ts
    txt.ts
  generators/
    pdf.ts
    docx.ts
    txt.ts
  ai-schema.ts
  optimize.ts

tests/
  fixtures/
    perfect-resume.txt
    incomplete-resume.txt
    sample-resume.docx
    sample-resume.pdf
  resume-model.test.ts
  scoring.test.ts
  parsing.test.ts
  round-trip.test.ts
  ai-contract.test.ts
  optimization.test.ts
```

## Proposed architecture

```text
PDF / DOCX / TXT
       ↓
Format-specific parser
       ↓
Canonical Resume model
       ↓
Deterministic validator
       ├── component scores
       ├── findings
       └── hard failures
       ↓
Optional semantic AI analysis
       ↓
Structured AI rewrite
       ↓
Canonical Resume model
       ↓
Deterministic revalidation
       ↓
Bounded improvement loop
       ↓
Canonical document generators
       ├── PDF
       ├── DOCX
       └── TXT
```

The canonical model should contain structured fields such as:

```ts
type Resume = {
  identity: {
    name: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    website?: string;
  };
  summary?: string;
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  metadata: {
    sourceFormat: 'pdf' | 'docx' | 'txt';
    parserWarnings: string[];
  };
};
```

The validator should receive `Resume`, not arbitrary extracted text.

## Phased implementation proposal

### Phase 1 — Validator contract

Create a formal scoring contract with exactly 100 points.

Recommended separation:

- Deterministic ATS structure score: 70–80 points.
- Semantic/job-match score: separate AI-assisted score, not mixed silently into the objective score.
- Parser quality warnings: warnings, not hidden score penalties.

Every component should return an explainable result such as:

```ts
{
  id: 'contact.email',
  label: 'Email address',
  earned: 5,
  possible: 5,
  passed: true,
  explanation: 'A plain-text email address was found.'
}
```

Tests should prove:

- A canonical perfect resume scores exactly 100.
- Each component has a known maximum.
- The sum of maxima is exactly 100.
- Missing fields reduce only the relevant component.
- Parser warnings do not unpredictably alter unrelated scores.

### Phase 2 — Canonical resume model

Introduce the normalized model and make every parser produce it.

Responsibilities:

- Normalize whitespace and Unicode.
- Normalize section names.
- Convert bullets into arrays.
- Normalize contact fields.
- Preserve parser warnings and source metadata.
- Represent unknown or missing data explicitly.

The validator should no longer inspect raw text with regular expressions.

### Phase 3 — Document parsing

Implement separate parsers:

- PDF parser preserving approximate reading order, line boundaries, and paragraph boundaries.
- DOCX parser preserving paragraphs, headings, and list items.
- TXT parser preserving lines and bullet markers.

Heading detection should be case-insensitive, normalize punctuation and whitespace, support common aliases, and avoid false positives inside body text.

Bullet detection should preserve the bullet marker, bullet text, ordered versus unordered lists, and paragraph boundaries.

Round-trip tests should cover:

```text
TXT → canonical model
DOCX → canonical model
PDF → canonical model
canonical model → DOCX → canonical model
canonical model → PDF → canonical model
canonical model → TXT → canonical model
```

Some formatting differences are expected, but section identity and bullet content should remain stable.

### Phase 4 — AI rewrite

The AI should return structured data matching a schema, for example:

```json
{
  "summary": "...",
  "skills": ["..."],
  "experience": [
    {
      "employer": "...",
      "title": "...",
      "dates": "...",
      "bullets": ["..."]
    }
  ],
  "education": []
}
```

The server should validate the JSON schema, reject malformed output, preserve facts from the source, detect unsupported additions where possible, and run the deterministic validator after parsing the AI result.

The AI must never provide the authoritative objective score.

### Phase 5 — Optimization loop

Implement a bounded server-side loop:

```text
parse input
→ deterministic analysis
→ optional semantic analysis
→ AI rewrite
→ parse structured AI output
→ deterministic validation
→ ask AI for targeted improvements
→ repeat up to N times
```

Recommended safeguards:

- Maximum of 2–3 rewrite iterations.
- Stop when the target score is reached.
- Stop when score improvement is below a threshold.
- Stop when output becomes less complete or introduces unsupported facts.
- Preserve the highest-scoring valid version.
- Enforce request, token, timeout, and cost limits.

The AI should receive explicit failed components, not simply be told to “make it better.”

### Phase 6 — Output

Generate all files from the canonical model:

- TXT generator.
- DOCX generator.
- PDF generator.

The generated output should use the same headings, sections, and bullets represented internally.

This removes the inconsistency where the AI produces one text string and each download format independently interprets that string.

## Main risks

- ATS systems differ; a deterministic score is an internal quality indicator, not a universal employer score.
- PDF reading order is difficult for multi-column or visually complex resumes.
- PDF text can contain positioned fragments without reliable semantic structure.
- AI may invent or subtly alter facts unless constrained and checked.
- Optimization loops increase latency and OpenAI API cost.
- Structured AI responses may fail schema validation.
- Existing browser-side dependencies may significantly increase bundle size.
- Migrating the current page logic could temporarily affect the separate Resume Creator.
- Generated PDFs need tests for page breaks, long bullets, Unicode, and missing fields.
- Resume data is sensitive; logging and API payload handling must avoid accidental persistence or exposure.
- The current API has a fixed request size limit and in-memory IP rate limiting, which may need review as structured payloads grow.

## Recommended implementation order

1. Establish the validator contract and scoring tests.
2. Extract current validator logic into pure, testable modules.
3. Define and implement the canonical resume model.
4. Add TXT parsing first as the simplest reference parser.
5. Add DOCX parsing and round-trip tests.
6. Improve PDF extraction and add PDF fixtures.
7. Replace free-form AI output with schema-validated structured output.
8. Revalidate AI output deterministically.
9. Add the bounded optimization loop.
10. Replace independent download formatting with canonical generators.
11. Update the Resume Creator to use the shared model and generators.
12. Add CI test execution before changing deployment behavior.

## Tests that should be added

### Validator tests

- Perfect canonical resume reaches exactly 100.
- Score component maxima total exactly 100.
- Missing email, phone, section, skill, experience, or education affects only its intended component.
- Short, long, empty, and unusually dense resumes behave predictably.
- Findings explain every failed component.
- Semantic AI scores remain separate from deterministic scores.

### Normalization tests

- Whitespace and Unicode normalization.
- Case-insensitive headings.
- Heading aliases.
- Punctuation variants.
- Contact field normalization.
- Ordered and unordered bullet normalization.

### Parser tests

- TXT parsing.
- DOCX paragraph and list parsing.
- PDF line and reading-order parsing.
- Scanned/image-only PDF behavior and warnings.
- Multi-page PDF behavior.
- Multi-column PDF warning behavior.

### Round-trip tests

- TXT to model and back.
- DOCX to model and back.
- PDF to model and back.
- Section and bullet preservation across generated documents.

### AI/API tests

- Valid structured AI output is accepted.
- Malformed JSON is rejected.
- Missing required fields are rejected or normalized according to contract.
- Unsupported invented facts are detected or flagged.
- API errors and rate limiting are handled.
- The AI cannot override deterministic scoring.

### Optimization tests

- Loop stops at the target score.
- Loop stops after the iteration limit.
- Loop stops when there is no meaningful improvement.
- Lower-scoring candidates are discarded.
- Unsupported AI changes are not accepted.
