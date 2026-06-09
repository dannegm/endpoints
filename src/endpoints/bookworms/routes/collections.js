import { Router } from 'express';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { supabase } from '@/services/supabase';

import { seeder } from '../agents';
import { matchBooks } from '../utils/matcher';

const router = Router();
const $schema = supabase.schema('bookworms');

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
            return res.status(502).json({ error: 'La IA devolvió una estructura inválida.', issues: err.issues });
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

// POST /collections/test-matcher
// Body: { books: [{ title, authors?, published? }] }
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
