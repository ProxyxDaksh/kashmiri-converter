exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key not configured on server.' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  const { text, direction } = body;
  if (!text || !direction) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing text or direction.' }) };
  }

  if (text.length > 500) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Text too long (max 500 characters).' }) };
  }

  const ke = direction === 'KE';

  const prompt = ke
    ? `You are an expert Kashmiri (Koshur) translator.
Translate the following romanized Kashmiri into fluent, natural English.
Romanized Kashmiri uses conventions like: ch, sh, kh, gh, ts, dz, ny, etc.
Output ONLY the English translation. No notes, no original text, no explanations.

Text to translate:
${text}`
    : `You are an expert Kashmiri (Koshur) translator.
Translate the following English into romanized Kashmiri using Latin script only (NOT Nastaliq/Arabic script).
Use natural Kashmiri as spoken in the Kashmir Valley.
Output ONLY the romanized Kashmiri. No notes, no English, no explanations.

Text to translate:
${text}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
        })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      const code = res.status;
      if (code === 429) return { statusCode: 429, body: JSON.stringify({ error: 'Too many requests — please wait a moment.' }) };
      if (code === 400) return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request to AI.' }) };
      return { statusCode: code, body: JSON.stringify({ error: data?.error?.message || 'Translation failed.' }) };
    }

    const result = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!result) return { statusCode: 500, body: JSON.stringify({ error: 'Empty response from AI.' }) };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ translation: result })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error: ' + err.message }) };
  }
};
