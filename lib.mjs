export const tokenize = s => s.toLowerCase().match(/[a-z0-9]{2,}/g) || [];
const stop = new Set('the a an is are was were what how why to of in for and or it this that me you explain can does do with'.split(' '));
export function chunksFor(doc) {
  return doc.pages.flatMap((text, i) => {
    const words = text.split(/\s+/).filter(Boolean), result = [];
    for (let n = 0; n < words.length; n += 180) result.push({ documentId: doc.id, name: doc.name, page: i + 1, text: words.slice(n, n + 240).join(' ') });
    return result;
  });
}
export function retrieve(documents, query, limit = 6) {
  const terms = [...new Set(tokenize(query).filter(t => !stop.has(t)))];
  const chunks = documents.flatMap(chunksFor);
  const frequencies = new Map(terms.map(t => [t, chunks.filter(c => tokenize(c.text).includes(t)).length]));
  return chunks.map(c => {
    const tokens = tokenize(c.text);
    const score = terms.reduce((sum, term) => {
      const tf = tokens.filter(t => t === term).length;
      return sum + (tf ? Math.log(1 + (chunks.length + 1) / (1 + frequencies.get(term))) * tf / (tf + 1.2 * (.25 + .75 * tokens.length / 240)) : 0);
    }, 0);
    return { ...c, score };
  }).filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((c, i) => ({ ...c, id: `S${i + 1}` }));
}
export function validateAnswer(raw, sources) {
  if (!raw || !Array.isArray(raw.paragraphs) || !raw.paragraphs.length) throw new Error('The model returned an invalid answer. Try again.');
  const ids = new Set(sources.map(s => s.id));
  return raw.paragraphs.map(p => {
    if (typeof p.text !== 'string' || !p.text.trim() || !Array.isArray(p.sources) || !p.sources.length || p.sources.some(id => !ids.has(id))) throw new Error('The model returned an unsupported citation. Please rephrase your question.');
    return { text: p.text, sources: [...new Set(p.sources)] };
  });
}
export const sample = { id: 'sample', name: 'Biology 101 · sample notes', sample: true, pages: [
  'Photosynthesis converts light energy into chemical energy stored in sugars. Plants take in carbon dioxide and water and, using sunlight, produce glucose and oxygen. Chlorophyll pigments absorb light in chloroplasts. The overall equation is 6 CO2 + 6 H2O + light energy → C6H12O6 + 6 O2.',
  'The light-dependent reactions occur in the thylakoid membranes of chloroplasts. Light excites electrons in chlorophyll. Water is split, releasing oxygen. Electron transport builds a proton gradient that powers ATP synthase. These reactions produce ATP and NADPH, which supply energy and reducing power for the Calvin cycle.',
  'The Calvin cycle occurs in the stroma of the chloroplast. Rubisco fixes carbon dioxide to RuBP. ATP and NADPH from the light-dependent reactions help convert the resulting molecules into G3P. Some G3P is used to build sugars; the rest regenerates RuBP. The Calvin cycle does not directly use light, but depends on products of the light-dependent reactions.'
] };
