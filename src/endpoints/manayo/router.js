import { Router } from 'express';
import { z } from 'zod';
import { OpenRouter } from '@openrouter/sdk';
import PocketBase from 'pocketbase';

const OPENROUTER_API_MODEL = process.env.OPENROUTER_API_MODEL || 'minimax/minimax-m2';

const router = Router();
const pb = new PocketBase(process.env.POCKETBASE_URL || 'https://base.hckr.mx');
const ia = new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * Get all settings from the database.
 * Returns an object like:
 * {
 *   ia_enabled: true,
 *   theme: "dark",
 *   whatever: 123
 * }
 */
export const getAllSettings = async () => {
    try {
        const records = await pb.collection('manayo_settings').getFullList({ fields: 'key,value' });

        const map = {};
        for (const r of records) {
            map[r.key] = r.value;
        }

        return map;
    } catch (err) {
        console.error('[getAllSettings] error:', err?.data || err);
        return {};
    }
};

/**
 * Get a single setting by key.
 * Returns the value or null if not found.
 */
export const getSetting = async key => {
    try {
        const record = await pb.collection('manayo_settings').getFullList(`key="${key}"`, {
            fields: 'value',
        });

        return record.at(0)?.value;
    } catch (err) {
        if (err?.status === 404) return null;
        console.error(`[getSetting:${key}] error:`, err?.data || err);
        return null;
    }
};

router.all('/', (req, res) => {
    return res.send('OK - manayo');
});

const ManayoAISuggestionSchema = z.object({
    jp: z.string().min(1),
    kana: z.string().min(1),
    romaji: z.string().min(1),
    meaning: z.string().min(1),
    type: z.enum([
        'instant',
        'sorcery',
        'enchantment',
        'creature',
        'slang',
        'command',
        'expression',
    ]),
    intensity: z.number().int().min(1).max(5),
    usage: z.object({
        jp: z.string().min(1),
        kana: z.string().min(1),
        romaji: z.string().min(1),
        es: z.string().min(1),
    }),
    flavor: z.string().min(1),
});

async function getExistingCardsSample(limit = 150) {
    const records = await pb.collection('manayo_cards').getList(1, limit, {
        sort: '-created',
        fields: 'jp,romaji,meaning',
    });

    return records.items.map(r => ({
        jp: r.jp,
        romaji: r.romaji,
        meaning: r.meaning,
    }));
}

function buildPrompt({ existingCards }) {
    const existingLines = existingCards
        .map(c => `- jp: ${c.jp} | romaji: ${c.romaji} | meaning: ${c.meaning}`)
        .join('\n');

    const baseInstruction = `
Eres un generador de cartas para una app llamada "Manayō".
Devuelves SIEMPRE un JSON válido (sin texto extra, sin markdown) exactamente con esta forma:

{
  "jp": "frase corta en japonés, estilo hechizo/catchphrase",
  "kana": "en caso de que la frase corta tenga kanjis, transcríbela en kana aquí",
  "romaji": "transcripción en romaji",
  "meaning": "su interpretación o significado en español",
  "type": "uno de: instant, sorcery, enchantment, creature, slang, command, expression",
  "intensity": numero entero entre 1 y 5,
  "usage": {
    "jp": "frase de ejemplo en japonés",
    "kana": "en caso de que la frase de ejemplo tenga kanjis, transcríbela en kana aquí",
    "romaji": "romaji del ejemplo",
    "es": "traducción del ejemplo"
  },
  "flavor": "una línea simpática/meta sobre la carta"
}

No repitas frases existentes ni muy parecidas a estas (son cartas ya creadas):
${existingLines || '- (no hay cartas registradas todavía)'}

Crea algo nuevo, juguetón pero útil en conversación real.
Agrega un poco de humor o picardía al significado y al flavor.
Nivel de picante: 75%.
Utiliza las cartas existentes como referencia de estilo y formato.
Recuerda: responde SOLO con JSON.
`;

    return baseInstruction;
}

router.post('/ai/suggest', async (req, res) => {
    const ia_enabled = await getSetting('ia_enabled');

    if (!ia_enabled) {
        return res.status(503).json({
            error: 'El endpoint de sugerencias AI está deshabilitado temporalmente.',
        });
    }

    try {
        const { mode, description } = req.body || {};

        const existingCards = await getExistingCardsSample(50);
        const systemPrompt = buildPrompt({ existingCards });

        const userPrompt = {
            role: 'user',
            content: `Genera una carta sorpresa basada en esta descripción: "${description}". Sé creativo y no te limites a lo literal. Ajusta el estilo de la carta a esa descripción.`,
        };
        const defaultPrompt = {
            role: 'user',
            content: 'Genera una carta sorpresa, sin tema específico, pero usable entre amigos.\n',
        };

        const finalPrompt = mode === 'prompt' ? userPrompt : defaultPrompt;
        const messages = [{ role: 'system', content: systemPrompt }, finalPrompt];

        const response = await ia.chat.send({
            chatRequest: {
                model: OPENROUTER_API_MODEL,
                messages,
            },
        });

        const output = response.choices[0].message.content || '';

        let parsed;

        try {
            const raw = JSON.parse(output);
            const result = ManayoAISuggestionSchema.safeParse(raw);

            if (!result.success) {
                console.error('❌ Zod validation error:', result.error.format());
                return res.status(502).json({
                    error: 'La IA devolvió un JSON con estructura inválida.',
                    issues: result.error.format(),
                    raw,
                });
            }

            parsed = result.data;
        } catch (e) {
            console.error('❌ JSON parse error:', e);
            return res.status(502).json({
                error: 'La IA no devolvió JSON válido.',
                raw: output,
            });
        }

        const data = { ...parsed, source: 'ia' };
        const isDuplicate = existingCards.some(c => c.jp === data.jp || c.romaji === data.romaji);

        return res.json({ ...data, duplicate: isDuplicate });
    } catch (err) {
        console.error('manayo/ai/suggest error:', err);
        return res.status(500).json({
            error: 'Error generando sugerencia.',
        });
    }
});

router.get('/settings', async (req, res) => {
    const settings = await getAllSettings();
    res.json(settings);
});

export default router;
