import http from 'node:http';

const port = Number(process.env.PORT || 8787);
const maxBodyBytes = 280_000;
const requests = new Map();

const promptFor = (body) => {
  if (body.mode === 'rewrite') {
    return `Rewrite the resume below into a polished, professional, ATS-friendly resume. Return only resume text. Use exactly these sections: PROFESSIONAL SUMMARY, CORE SKILLS, PROFESSIONAL EXPERIENCE, EDUCATION. Use plain text, one column, standard headings, concise bullets, strong action verbs, and measurable outcomes only when supported. Preserve every truthful fact. Never invent employers, dates, technologies, metrics, or credentials. Do not use tables, columns, graphics, emojis, or commentary. Target role: ${body.targetRole || 'not specified'}\n\nRESUME:\n${body.text}`;
  }
  const data = body.data || {};
  return `You are a senior professional resume writer. Create a polished, professional, ATS-friendly resume from the candidate details below. Return only resume text. Use exactly these sections: PROFESSIONAL SUMMARY, CORE SKILLS, PROFESSIONAL EXPERIENCE, EDUCATION. Use plain text, one column, standard headings, concise bullets, strong action verbs, and measurable outcomes only when supported. Never invent facts. Do not use tables, columns, graphics, emojis, markdown, or commentary.\n\nFull name: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone || 'Not provided'}\nLinkedIn: ${data.linkedin || 'Not provided'}\nPersonal website/blog: ${data.website || 'Not provided'}\nEducation: ${data.education}\nExperience: ${data.experience}\nSkills: ${data.skills}`;
};

const allowed = (req) => {
  const address = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (requests.get(address) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 8) return false;
  recent.push(now);
  requests.set(address, recent);
  return true;
};

const send = (res, status, payload) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(payload));
};

const readBody = async (req) => {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error('Request is too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/health') return send(res, 200, { ok: true });
  if (req.method !== 'POST' || req.url !== '/api/resume') return send(res, 404, { error: 'Not found' });
  if (!allowed(req)) return send(res, 429, { error: 'Please wait before trying again' });
  if (!process.env.OPENAI_API_KEY) return send(res, 503, { error: 'AI service is not configured' });
  try {
    const body = await readBody(req);
    if (!body || !['create', 'rewrite'].includes(body.mode)) return send(res, 400, { error: 'Invalid request' });
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.2, messages: [{ role: 'user', content: promptFor(body) }] }),
    });
    if (!response.ok) return send(res, 502, { error: 'AI provider request failed' });
    const json = await response.json();
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return send(res, 502, { error: 'AI provider returned no resume' });
    return send(res, 200, { text });
  } catch (error) {
    return send(res, error instanceof SyntaxError ? 400 : 500, { error: error instanceof Error ? error.message : 'Request failed' });
  }
});

server.listen(port, '127.0.0.1', () => console.log(`resume API listening on 127.0.0.1:${port}`));
