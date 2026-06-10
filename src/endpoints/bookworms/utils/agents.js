import { z } from 'zod';
import { OpenRouter } from '@openrouter/sdk';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { findIcon } from './utils/icon-finder';

const ia = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const MODEL = process.env.OPENROUTER_API_MODEL;

// --- Seeder ---

const SeederTopicSchema = z.object({
    topic: z.string().min(1),
    tags: z.array(z.string()).min(1),
    hint: z.string().min(1),
    icon_hint: z.string().min(1),
});

const SeederOutputSchema = z.array(SeederTopicSchema);

export async function seeder({ count = 10, existingTopics = [], catalogCutoff }) {
    const existingList = existingTopics.length
        ? existingTopics.map(t => `- ${t}`).join('\n')
        : '(ninguno todavía)';

    const systemPrompt = `
Eres un asistente que genera categorías temáticas para una app de descubrimiento de libros en español.
El catálogo es exclusivamente en español y cubre títulos publicados hasta ${catalogCutoff}.

Devuelve SIEMPRE un JSON válido (sin texto extra, sin markdown) con esta estructura exacta:
[
  {
    "topic": "descripción breve del tema en español, como lo diría un lector",
    "tags": ["tag1", "tag2", "tag3"],
    "hint": "2-3 palabras que capturan el mood",
    "icon_hint": "2-3 keywords en inglés para buscar un icono visual"
  }
]

Reglas:
- Los tags deben estar en español
- El hint debe ser evocador y corto: "Algo oscuro", "Para pensar", "Ligero", "Otro mundo", "Que enganche"
- El icon_hint debe ser en inglés y describir visualmente el mood: "skull dark horror", "stars space rocket", "heart romance"
- No repitas topics ya existentes
- Responde SOLO con el array JSON
`.trim();

    const userPrompt = `Topics ya existentes (no repetir):\n${existingList}\n\nGenera ${count} topics nuevos y variados.`;

    const response = await ia.chat.send({
        chatRequest: {
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        },
    });

    const output = response.choices[0].message.content || '';

    let parsed;
    try {
        const raw = JSON.parse(output);
        const result = SeederOutputSchema.safeParse(raw);
        if (!result.success) {
            throw { type: 'INVALID_SCHEMA', issues: result.error.format() };
        }
        parsed = result.data;
    } catch (e) {
        if (e?.type) throw e;
        throw { type: 'INVALID_JSON', raw: output };
    }

    return parsed.map(({ icon_hint, ...topic }) => ({
        ...topic,
        icon: findIcon(icon_hint),
    }));
}

// --- Prompter ---

export async function prompter({ topic, tags, recentCollections = [] }) {
    const recentList = recentCollections.length
        ? recentCollections.map(c => `- ${c.headline}: ${c.tags?.join(', ')}`).join('\n')
        : null;

    const systemPrompt = `
Eres un asistente creativo para una app de descubrimiento de libros en español.
Tu tarea es tomar un topic y transformarlo en un prompt rico, personal y variado que inspire recomendaciones de libros únicas.

El prompt resultante debe sonar como un lector apasionado describiendo lo que quiere leer: evocador, específico, con personalidad. Incluye hashtags al final — los tags del topic son una guía, no una obligación: úsalos si encajan, ignóralos si no, y añade los que necesites para capturar mejor la idea.

${recentList ? `Colecciones recientes (evita generar algo demasiado similar):\n${recentList}` : 'Aún no hay colecciones — siéntete libre de sugerir sin restricciones.'}

Responde SOLO con el texto del prompt, sin explicaciones ni formato adicional.
`.trim();

    const userPrompt = `Topic: "${topic}"\nTags: ${tags.join(', ')}\n\nGenera el prompt.`;

    const response = await ia.chat.send({
        chatRequest: {
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        },
    });

    return response.choices[0].message.content?.trim() || '';
}

// --- Picker ---

const PickerBookSchema = z.object({
    title: z.string().min(1),
    authors: z.array(z.string()).min(1),
    published: z.number().int().optional(),
    why: z.string().max(120),
});

const PickerOutputSchema = z.object({
    headline: z.string().min(1),
    description: z.string().min(1),
    tags: z.array(z.string()).min(1),
    books: z.array(PickerBookSchema).min(12),
});

export async function picker({ prompt, catalogCutoff }) {
    const systemPrompt = `
Eres un curador literario experto en literatura en español.
El catálogo disponible es exclusivamente en español y cubre títulos publicados hasta ${catalogCutoff}.

Devuelve SIEMPRE un JSON válido (sin texto extra, sin markdown) con esta estructura exacta:
{
  "headline": "título evocador de la colección, máx 60 caracteres",
  "description": "descripción de 1-2 frases que invite a explorar la colección",
  "tags": ["tag1", "tag2"],
  "books": [
    {
      "title": "título exacto del libro",
      "authors": ["Nombre Apellido"],
      "published": 1985,
      "why": "por qué encaja en esta colección, máx 120 caracteres"
    }
  ]
}

Reglas:
- Sugiere al menos 12 libros — se esperan descartes, necesitas margen
- Los tags siempre en español
- Los títulos deben ser los usados en las ediciones en español
- El campo "why" debe ser específico y evocador, máx 120 caracteres
- La description debe sonar como un lector apasionado, no como ficha de catálogo. Varía el tono y la estructura: puede ser una pregunta, una afirmación rotunda, una invitación, una imagen evocadora. Nunca empieces con "Una selección de"
- Responde SOLO con el JSON
`.trim();

    const response = await ia.chat.send({
        chatRequest: {
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
        },
    });

    const output = response.choices[0].message.content || '';

    try {
        const raw = JSON.parse(output);
        const result = PickerOutputSchema.safeParse(raw);
        if (!result.success) {
            throw { type: 'INVALID_SCHEMA', issues: result.error.format() };
        }
        return result.data;
    } catch (e) {
        if (e?.type) throw e;
        throw { type: 'INVALID_JSON', raw: output };
    }
}
