import { OpenRouter } from '@openrouter/sdk';

const ia = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const MODEL = process.env.OPENROUTER_API_MODEL || 'google/gemini-3.1-flash-lite';

const SYSTEM_PROMPT = `Eres un agente de búsqueda especializado en operativos viales de la Ciudad de México.
Tu única tarea es encontrar información oficial y reciente sobre el Operativo Última Milla
alrededor del Estadio Ciudad de México.

Prioriza fuentes en este orden:
1. ssc.cdmx.gob.mx
2. semovi.cdmx.gob.mx
3. alcaldiacoyoacan.cdmx.gob.mx
4. Prensa nacional (reforma.com, expansion.mx, elfinanciero.com.mx)

Devuelve SOLO un array JSON. Sin explicaciones, sin markdown, sin texto adicional.
Formato exacto: [{ "url": "...", "snippet": "...", "publishedAt": "YYYY-MM-DD" }]
Máximo 5 resultados. Si no encuentras nada relevante, devuelve [].`;

export async function searcher() {
    const response = await ia.chat.send({
        chatRequest: {
            model: MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content:
                        'Busca información actualizada sobre el Operativo Última Milla para los días de partido en el Estadio Ciudad de México durante el torneo internacional de fútbol de verano 2026.',
                },
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
