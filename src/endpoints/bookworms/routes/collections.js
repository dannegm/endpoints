import { Router } from 'express';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { supabase } from '@/services/supabase';
import { Ntfy } from '@/services/ntfy';

import { seeder, prompter, picker } from '../agents';
import { matchBooks } from '../utils/matcher';
import { getPagination } from '../helpers';

const router = Router();
const $schema = supabase.schema('bookworms');
const ntfy = new Ntfy(process.env.APP_TOPIC);


const MAX_RETRIES = 3;
const MIN_BOOKS = 4;

function weightedRandom(topics) {
    const weights = topics.map(t => 1 / (t.times_used + 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < topics.length; i++) {
        r -= weights[i];
        if (r <= 0) return topics[i];
    }
    return topics[topics.length - 1];
}

async function runPipeline({
    prompt,
    topics,
    recentCollections,
    catalogCutoff,
    triedTopicIds = [],
}) {
    let pickerPrompt = prompt;
    let selectedTopic = null;

    if (!prompt) {
        const available = topics.filter(t => !triedTopicIds.includes(t.id));
        if (!available.length) return null;
        selectedTopic = weightedRandom(available);
        pickerPrompt = await prompter({
            topic: selectedTopic.topic,
            tags: selectedTopic.tags,
            recentCollections,
        });
    }

    const pickerResult = await picker({ prompt: pickerPrompt, catalogCutoff });

    const matched = matchBooks(pickerResult.books)
        .map((match, i) => (match ? { ...match, why: pickerResult.books[i].why } : null))
        .filter(Boolean);

    const seen = new Set();
    const books = matched.filter(b => {
        if (seen.has(b.libid)) return false;
        seen.add(b.libid);
        return true;
    });

    return {
        headline: pickerResult.headline,
        description: pickerResult.description,
        tags: pickerResult.tags,
        books,
        topic_id: selectedTopic?.id || null,
    };
}

// GET /topics
router.get('/topics', async (req, res) => {
    const [from, to] = getPagination(req);
    const { data, error } = await $schema
        .from('topics')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from - 1, to - 1);

    if (error?.code === 'PGRST103') return res.json([]);
    if (error) return res.status(500).json({ error: 'Error obteniendo topics.' });
    return res.json(data);
});

// POST /topics/generate
router.post('/topics/generate', async (req, res) => {
    const count = req.body?.count || 10;

    const [{ data: existing }, { data: cutoffSetting }] = await Promise.all([
        $schema.from('topics').select('topic'),
        $schema.from('settings').select('value').eq('key', 'library.last_update').single(),
    ]);

    const existingTopics = (existing || []).map(t => t.topic);
    const catalogCutoff = cutoffSetting?.value
        ? format(new Date(cutoffSetting.value), "MMMM 'de' yyyy", { locale: es })
        : 'enero de 2026';

    let topics;
    try {
        topics = await seeder({ count, existingTopics, catalogCutoff });
    } catch (err) {
        if (err?.type === 'INVALID_SCHEMA') {
            return res
                .status(502)
                .json({ error: 'La IA devolvió una estructura inválida.', issues: err.issues });
        }
        if (err?.type === 'INVALID_JSON') {
            return res.status(502).json({ error: 'La IA no devolvió JSON válido.', raw: err.raw });
        }
        console.error('seeder error:', err);
        return res.status(500).json({ error: 'Error generando topics.' });
    }

    const { data, error } = await $schema.from('topics').insert(topics).select();
    if (error) {
        console.error('topics insert error:', error);
        return res.status(500).json({ error: 'Error insertando topics.' });
    }

    return res.json(data);
});

// GET /topic/:id/collections
router.get('/topic/:id/collections', async (req, res) => {
    const { id } = req.params;
    const [from, to] = getPagination(req);

    const { data, error } = await $schema
        .from('collections')
        .select('*')
        .eq('topic_id', id)
        .order('created_at', { ascending: false })
        .range(from - 1, to - 1);

    if (error?.code === 'PGRST103') return res.json([]);
    if (error) return res.status(500).json({ error: 'Error obteniendo colecciones.' });
    return res.json(data);
});

// GET /collections
router.get('/collections', async (req, res) => {
    const [from, to] = getPagination(req);
    const { data, error } = await $schema
        .from('collections')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from - 1, to - 1);

    if (error?.code === 'PGRST103') return res.json([]);
    if (error) return res.status(500).json({ error: 'Error obteniendo colecciones.' });
    return res.json(data);
});

// GET /collections/last  ← before /:id
router.get('/collections/last', async (req, res) => {
    const { data, error } = await $schema
        .from('collections')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) return res.status(404).json({ error: 'No hay colecciones.' });
    return res.json(data);
});

// GET /collections/:id
router.get('/collections/:id', async (req, res) => {
    const { data, error } = await $schema
        .from('collections')
        .select('*')
        .eq('id', req.params.id)
        .single();

    if (error) return res.status(404).json({ error: 'Colección no encontrada.' });
    return res.json(data);
});

// POST /collections
router.post('/collections', async (req, res) => {
    const { headline, description, tags, topic_id, books } = req.body;

    if (!headline) return res.status(400).json({ error: 'headline es requerido.' });

    const { data, error } = await $schema
        .from('collections')
        .insert({ headline, description, tags, topic_id, books })
        .select()
        .single();

    if (error) return res.status(500).json({ error: 'Error creando colección.' });
    return res.status(201).json(data);
});

async function fetchPipelineContext(prompt) {
    const [{ data: topics }, { data: recentCollections }, { data: cutoffSetting }] =
        await Promise.all([
            $schema.from('topics').select('id, topic, tags, times_used'),
            $schema
                .from('collections')
                .select('headline, tags')
                .order('created_at', { ascending: false })
                .limit(20),
            $schema.from('settings').select('value').eq('key', 'library.last_update').single(),
        ]);

    if (!prompt && (!topics || !topics.length)) {
        return null;
    }

    return {
        topics: topics || [],
        recentCollections: recentCollections || [],
        catalogCutoff: cutoffSetting?.value
            ? format(new Date(cutoffSetting.value), "MMMM 'de' yyyy", { locale: es })
            : 'enero de 2026',
    };
}

async function runPipelineLoop({ prompt, topics, recentCollections, catalogCutoff }) {
    const triedTopicIds = [];
    let result = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        result = await runPipeline({
            prompt,
            topics,
            recentCollections,
            catalogCutoff,
            triedTopicIds,
        });

        if (!result) break;
        if (result.books.length >= MIN_BOOKS) break;
        if (result.topic_id) triedTopicIds.push(result.topic_id);
        result = null;
    }

    return result;
}

// POST /collections/suggest
router.post('/collections/suggest', async (req, res) => {
    const { prompt } = req.body || {};

    const ctx = await fetchPipelineContext(prompt);
    if (!ctx)
        return res
            .status(503)
            .json({ error: 'No hay topics disponibles. Ejecuta /topics/generate primero.' });

    let result;
    try {
        result = await runPipelineLoop({ prompt, ...ctx });
    } catch (err) {
        if (err?.type === 'INVALID_SCHEMA')
            return res
                .status(502)
                .json({ error: 'La IA devolvió una estructura inválida.', issues: err.issues });
        if (err?.type === 'INVALID_JSON')
            return res.status(502).json({ error: 'La IA no devolvió JSON válido.', raw: err.raw });
        console.error('pipeline error:', err);
        return res.status(500).json({ error: 'Error en el pipeline.' });
    }

    if (!result)
        return res
            .status(503)
            .json({ error: 'No se pudo generar una colección con suficientes libros válidos.' });

    return res.json(result);
});

// POST /collections/generate — fire and forget
router.post('/collections/generate', async (req, res) => {
    const { prompt } = req.body || {};

    const ctx = await fetchPipelineContext(prompt);
    if (!ctx)
        return res
            .status(503)
            .json({ error: 'No hay topics disponibles. Ejecuta /topics/generate primero.' });

    res.status(202).json({ message: 'Pipeline iniciado.' });

    ntfy.pushRich({
        title: 'Generando coleccion...',
        message: 'El pipeline de curacion ha comenzado.',
        tags: 'hourglass_flowing_sand',
    }).catch(() => {});

    (async () => {
        const startedAt = Date.now();
        const elapsed = () => {
            const ms = Date.now() - startedAt;
            const s = Math.floor(ms / 1000);
            return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
        };

        let result;
        try {
            result = await runPipelineLoop({ prompt, ...ctx });
        } catch (err) {
            console.error('pipeline error:', err);
            ntfy.pushRich({
                title: 'Error en el pipeline',
                message: `${err?.type || err?.message || 'Error desconocido'}\n_${elapsed()}_`,
                tags: 'rotating_light',
            }).catch(() => {});
            return;
        }

        if (!result) {
            ntfy.pushRich({
                title: 'Coleccion sin libros',
                message: `No se encontraron suficientes libros validos tras 3 intentos.\n_${elapsed()}_`,
                tags: 'warning',
            }).catch(() => {});
            return;
        }

        const { data, error } = await $schema
            .from('collections')
            .insert({
                headline: result.headline,
                description: result.description,
                tags: result.tags,
                topic_id: result.topic_id,
                books: result.books,
            })
            .select()
            .single();

        if (error) {
            console.error('collections insert error:', error);
            ntfy.pushRich({
                title: 'Error guardando coleccion',
                message: `${error.message}\n_${elapsed()}_`,
                tags: 'rotating_light',
            }).catch(() => {});
            return;
        }

        if (result.topic_id) {
            await $schema.rpc('increment_field', {
                target_table: 'topics',
                target_column: 'times_used',
                target_id: result.topic_id,
            });
        }

        ntfy.pushRich({
            title: 'Nueva coleccion disponible',
            message: `**${data.headline}**\n${data.description}\n_${elapsed()}_`,
            tags: 'books',
        }).catch(() => {});
    })();
});

// POST /collections/test-matcher
router.post('/collections/test-matcher', (req, res) => {
    const { books } = req.body;
    if (!Array.isArray(books) || books.length === 0) {
        return res.status(400).json({ message: 'Provide a books array' });
    }
    const matches = matchBooks(books);
    const results = books.map((book, i) => ({ input: book, match: matches[i] }));
    return res.json(results);
});

export default router;
