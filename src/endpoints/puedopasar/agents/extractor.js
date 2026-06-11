import { OpenRouter } from '@openrouter/sdk';

const ia = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const MODEL = process.env.OPENROUTER_API_MODEL || 'google/gemini-3.1-flash-lite';

const SYSTEM_PROMPT = `Eres un agente extractor de datos sobre operativos viales en CDMX.
Recibirás el contenido de páginas web. Extrae ÚNICAMENTE:
- Fechas de operativo (formato YYYY-MM-DD)
- Hora de cierre parcial por fecha
- Hora de cierre total por fecha
- Nombres de calles afectadas con tipo (total/parcial)
- Radio del perímetro en km (si se menciona)

Devuelve SOLO un array JSON. Sin interpretación, sin conclusiones.
Si un dato no aparece en el texto, usa null.
Formato: [{ "dates": [{ "date": "...", "partialClosure": "HH:MM", "totalClosure": "HH:MM" }], "streets": { "total": [], "partial": [] }, "perimeterKm": null, "source": "URL" }]`;

async function fetchContent(url, snippet) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' },
            signal: AbortSignal.timeout(10_000),
        });
        const html = await res.text();
        const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000);
        return { url, text };
    } catch {
        return { url, text: snippet || '' };
    }
}

export async function extractor(sources) {
    if (!sources.length) return [];

    const contents = await Promise.all(sources.map(s => fetchContent(s.url, s.snippet)));

    const userContent = contents
        .map(({ url, text }) => `--- URL: ${url} ---\n${text}`)
        .join('\n\n');

    const response = await ia.chat.send({
        chatRequest: {
            model: MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userContent },
            ],
        },
    });

    const output = response.choices[0].message.content || '';

    try {
        const cleaned = output.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}
