// Proxy aman ke Gemini (API key disimpan di Netlify, tidak terlihat di browser)
const reply = (s, o) => ({ statusCode: s, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });

exports.handler = async (e) => {
  if (e.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });
  let b;
  try { b = JSON.parse(e.body); } catch { return reply(400, { error: 'Permintaan tidak valid' }); }
  const need = process.env.ACCESS_CODE;
  if (need && b.code !== need) return reply(401, { error: 'Kode akses salah' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return reply(500, { error: 'GEMINI_API_KEY belum diatur di Netlify' });
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const call = (cfg) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: String(b.prompt || '').slice(0, 6000) }] }],
      generationConfig: Object.assign({ responseMimeType: 'application/json', temperature: 0.7 }, cfg)
    })
  });
  try {
    // coba dengan thinking minimal agar cepat; jika model menolak, ulangi tanpa pengaturan itu
    let res = await call({ thinkingConfig: { thinkingBudget: 0 } });
    if (res.status === 400) res = await call({});
    const j = await res.json();
    if (!res.ok) return reply(502, { error: (j.error && j.error.message) || 'Gemini error' });
    const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    return reply(200, { text });
  } catch (err) {
    return reply(500, { error: String(err.message || err) });
  }
};
