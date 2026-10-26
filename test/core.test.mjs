import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retrieve, chunksFor, validateAnswer, sample } from '../lib.mjs';
test('retrieval retains the physical PDF page', () => {
  const sources = retrieve([sample], 'Rubisco RuBP');
  assert.equal(sources[0].page, 3);
  assert.equal(sources[0].documentId, 'sample');
});
test('unrelated questions do not manufacture evidence', () => assert.deepEqual(retrieve([sample], 'medieval taxation'), []));
test('blank pages do not shift later page citations', () => {
  const sources = chunksFor({ id: 'x', name: 'Notes', pages: ['', 'Force equals mass times acceleration.'] });
  assert.equal(sources[0].page, 2);
});
test('chunk overlap preserves boundary context and page identity', () => {
  const chunks = chunksFor({ id: 'x', name: 'Long', pages: [Array.from({length: 400}, (_, n) => `word${n}`).join(' ')] });
  assert.ok(chunks[0].text.includes('word180'));
  assert.ok(chunks[1].text.startsWith('word180'));
  assert.ok(chunks.every(c => c.page === 1));
});
test('invented source IDs and uncited paragraphs are rejected', () => {
  assert.throws(() => validateAnswer({ paragraphs: [{ text: 'Claim', sources: ['S99'] }] }, [{ id: 'S1' }]));
  assert.throws(() => validateAnswer({ paragraphs: [{ text: 'Claim', sources: [] }] }, [{ id: 'S1' }]));
});
test('valid answer citations are deduplicated', () => assert.deepEqual(validateAnswer({ paragraphs: [{ text: 'Claim', sources: ['S1', 'S1'] }] }, [{ id: 'S1' }])[0].sources, ['S1']));
