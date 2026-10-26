import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
function fixturePDF() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  const stream = 'BT /F1 12 Tf 50 700 Td (Photosynthesis converts sunlight into chemical energy stored in sugars.) Tj ET';
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}
test('HTTP: upload PDF, retrieve, validate model citations, delete, and reject foreign origins', { timeout: 30000 }, async () => {
  const data = await mkdtemp(join(tmpdir(), 'whisperer-test-'));
  let captured;
  const mock = http.createServer(async (req, res) => { const chunks = []; for await(const c of req) chunks.push(c); captured = JSON.parse(Buffer.concat(chunks).toString()); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ message: { content: JSON.stringify({ paragraphs: [{ text: 'Photosynthesis stores sunlight as chemical energy.', sources: ['S1'] }] }) } })); });
  await new Promise(r => mock.listen(0, '127.0.0.1', r));
  const server = spawn(process.execPath, ['server.mjs'], { cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: '3219', DATA_DIR: data, OLLAMA_URL: `http://127.0.0.1:${mock.address().port}` }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; server.stderr.on('data', c => output += c);
  try {
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('Startup timeout: ' + output)), 15000); server.stdout.on('data', () => { clearTimeout(timer); resolve(); }); server.on('exit', code => { clearTimeout(timer); reject(Error('Server exit ' + code + output)); }); });
    const base = 'http://127.0.0.1:3219';
    assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(base + '/api/documents', { headers: { Origin: 'https://foreign.example' } })).status, 403);
    assert.equal((await fetch(base + '/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: 'invalid' })).status, 400);
    const upload = await fetch(base + '/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-File-Name': 'Fixture.pdf' }, body: fixturePDF() });
    assert.equal(upload.status, 201); const doc = await upload.json(); assert.equal(doc.pageCount, 1);
    const query = { question: 'What is photosynthesis?', documentIds: [doc.id], mode: 'skipped', demo: true };
    const ask = async input => (await fetch(base + '/api/chat', { method: 'POST', body: JSON.stringify(input) })).json();
    const preview = await ask(query); assert.equal(preview.demo, true); assert.equal(preview.sources[0].page, 1); assert.match(preview.sources[0].text, /chemical energy/);
    const answer = await ask({ ...query, demo: false }); assert.equal(answer.demo, false); assert.deepEqual(answer.paragraphs[0].sources, ['S1']); assert.match(captured.messages[0].content, /sophomore who skipped class/);
    assert.equal((await fetch(base + `/api/documents/${doc.id}/pdf`)).status, 200);
    assert.equal((await fetch(base + `/api/documents/${doc.id}`, { method: 'DELETE' })).status, 200);
    assert.deepEqual(await (await fetch(base + '/api/documents')).json(), []);
  } finally { server.kill(); await new Promise(r => server.exitCode !== null ? r() : server.on('exit', r)); await new Promise(r => mock.close(r)); await rm(data, { recursive: true, force: true }); }
});
