const $ = s => document.querySelector(s);
let docs = [], mode = 'standard', busy = false;
const selected = new Set();
async function api(path, options) { const res = await fetch(path, options); const data = await res.json(); if (!res.ok) throw Error(data.error || 'Request failed'); return data; }
const notice = text => { $('#notice').textContent = text; };
function el(tag, text, cls) { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; }
function renderDocs() {
  $('#count').textContent = docs.length; $('#documents').replaceChildren();
  for (const doc of docs) {
    const row = el('div', null, 'document'), label = el('label'), input = el('input'); input.type = 'checkbox'; input.checked = selected.has(doc.id); input.addEventListener('change', () => input.checked ? selected.add(doc.id) : selected.delete(doc.id));
    const name = el('span', doc.name); name.title = doc.name; name.append(el('small', `${doc.pageCount} pages${doc.sample ? ' · original sample' : ''}`)); label.append(input, name);
    const remove = el('button', '×', 'remove'); remove.setAttribute('aria-label', `Remove ${doc.name}`); remove.onclick = async () => { try { await api(`/api/documents/${doc.id}`, { method: 'DELETE' }); docs = docs.filter(d => d.id !== doc.id); selected.delete(doc.id); renderDocs(); } catch(e) { notice(e.message); } }; row.append(label, remove); $('#documents').append(row);
  }
}
async function sample() { const doc = await api('/api/sample', { method: 'POST' }); if (!docs.some(d => d.id === doc.id)) docs.push(doc); selected.add(doc.id); renderDocs(); }
$('#sample').onclick = () => sample().catch(e => notice(e.message));
async function upload(files) {
  for (const file of files) { if (file.size > 25 * 1024 * 1024) { notice(`${file.name} exceeds 25 MB.`); continue; } notice(`Reading ${file.name}…`); try { const doc = await api('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(file.name) }, body: file }); docs.push(doc); selected.add(doc.id); renderDocs(); notice(`Added ${doc.name} · ${doc.pageCount} pages ready.`); } catch(e) { notice(e.message); } } $('#upload').value = '';
}
$('#upload').onchange = e => upload(e.target.files);
for (const type of ['dragover','dragleave','drop']) $('#dropzone').addEventListener(type, e => { e.preventDefault(); $('#dropzone').classList.toggle('drag', type === 'dragover'); if (type === 'drop') upload(e.dataTransfer.files); });
for (const key of ['standard', 'skipped']) $(`#${key}`).onclick = () => { mode = key; for (const k of ['standard', 'skipped']) $(`#${k}`).setAttribute('aria-pressed', k === key); $('#mode-note').textContent = key === 'skipped' ? 'Plain English. Helpful analogies. No judgment. Applies to Local AI answers.' : 'The concepts, the details, and the evidence.'; };
function showSource(source) { $('#source-title').textContent = `${source.name} · page ${source.page}`; $('#source-text').textContent = source.text; $('#source-link').hidden = source.documentId === 'sample'; $('#source-link').href = `/api/documents/${source.documentId}/pdf#page=${source.page}`; $('#source-dialog').showModal(); }
for (const dialog of document.querySelectorAll('dialog')) dialog.querySelector('.close').onclick = () => dialog.close();
$('#setup').onclick = $('#status').onclick = () => $('#setup-dialog').showModal();
async function status() { try { const s = await api('/api/status'); $('#status').textContent = s.available ? `● ${s.model} · ready` : s.connected ? '◌ Download model · setup' : '◌ Local AI · setup'; } catch { $('#status').textContent = 'Server disconnected'; } }
$('#preview').onchange = () => { notice($('#preview').checked ? 'Source preview returns exact passages without AI. Explanation style applies in Local AI mode.' : 'Local AI mode uses Ollama to explain your sources.'); status(); };
$('#chat').onsubmit = async e => {
  e.preventDefault(); if (busy) return; const question = $('#question').value.trim(); if (!question) return; if (!selected.size) { notice('Add a PDF or try the biology sample first.'); return; }
  busy = true; $('#send').disabled = true; $('#send').textContent = 'Reading…'; notice('');
  if ($('.starters')) $('#conversation').replaceChildren();
  $('#conversation').append(el('div', question, 'question'));
  try {
    const result = await api('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, mode, documentIds: [...selected], demo: $('#preview').checked }) });
    const answer = el('article', null, 'answer'); answer.append(el('div', result.demo ? 'SOURCE PREVIEW · NO AI GENERATED' : `WHISPERER · ${mode === 'skipped' ? 'SKIPPED CLASS' : 'BY THE BOOK'}`, 'answer-label'));
    for (const paragraph of result.paragraphs) { answer.append(el('p', paragraph.text)); for (const id of paragraph.sources) { const source = result.sources.find(s => s.id === id); if (!source) continue; const button = el('button', `${source.name} · p. ${source.page}`, 'citation'); button.onclick = () => showSource(source); answer.append(button); } }
    const copy = el('button', 'Copy answer & citations', 'answer-tools'); copy.onclick = async () => { try { await navigator.clipboard.writeText(result.paragraphs.map(p => p.text + ' ' + p.sources.map(id => { const s = result.sources.find(s => s.id === id); return `[${s.name}, PDF p. ${s.page}]`; }).join(' ')).join('\n\n')); notice('Copied answer with page references.'); } catch { notice('Clipboard is unavailable in this browser. Select the answer to copy it.'); } }; answer.append(document.createElement('br'), copy); $('#conversation').append(answer); $('#question').value = ''; answer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch(e) { notice(e.message); } finally { busy = false; $('#send').disabled = false; $('#send').textContent = 'Ask whisperer ↑'; }
};
$('#question').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chat').requestSubmit(); } };
document.querySelectorAll('[data-question]').forEach(button => button.onclick = async () => { try { if (!docs.length) await sample(); $('#question').value = button.dataset.question; $('#question').focus(); } catch(e) { notice(e.message); } });
try { docs = await api('/api/documents'); docs.forEach(d => selected.add(d.id)); renderDocs(); } catch(e) { notice(e.message); }
status();
