import { OpenRouter } from '@openrouter/sdk';

const ia = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const MODEL = process.env.OPENROUTER_API_MODEL || 'google/gemini-3.1-flash-lite';

const buildSystemPrompt =
    currentDate => `Eres un agente de decisión sobre operativos viales en la Ciudad de México.
Recibirás datos extraídos de fuentes web y datos de respaldo (fallback).

Produce el JSON final del estado del operativo.
La fecha actual es: ${currentDate}

Reglas de confidence:
- "high": fuente principal es .gob.mx con datos recientes
- "medium": fuente principal es prensa nacional
- "low": solo datos de fallback disponibles

Si los datos web confirman los mismos datos que el fallback, igual marca "high" o "medium" según la fuente.
Si los datos web contradicen al fallback, prioriza los datos web y documenta en "source".

Para el campo "today": es true si la fecha actual corresponde a un día de operativo.
Nota: el partido del 11 jun tiene cierre parcial desde las 23:00 del día 10 (prevDay: true).

Devuelve SOLO este JSON. Sin explicaciones, sin markdown.
{
  "today": boolean,
  "dates": [{ "date": "YYYY-MM-DD", "partialClosure": "HH:MM", "totalClosure": "HH:MM" }],
  "affectedStreets": { "total": [], "partial": [] },
  "lastChecked": "ISO timestamp",
  "source": "URL principal",
  "confidence": "high|medium|low",
  "fallback": boolean
}
Nota: el campo "perimeter" lo agrega el orquestador desde perimeter.json. No lo incluyas.`;

export async function decider(extracted, fallback, currentDate) {
    const userContent = `Datos extraídos de fuentes web:\n${JSON.stringify(extracted, null, 2)}\n\nDatos de fallback:\n${JSON.stringify(fallback, null, 2)}`;

    const response = await ia.chat.send({
        chatRequest: {
            model: MODEL,
            messages: [
                { role: 'system', content: buildSystemPrompt(currentDate) },
                { role: 'user', content: userContent },
            ],
        },
    });

    const output = response.choices[0].message.content || '';

    try {
        const cleaned = output.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleaned);
    } catch {
        return {
            today: fallback.dates.some(d => d.date === currentDate.slice(0, 10)),
            dates: fallback.dates,
            affectedStreets: fallback.affectedStreets,
            lastChecked: currentDate,
            source: 'https://ssc.cdmx.gob.mx',
            confidence: 'low',
            fallback: true,
        };
    }
}
