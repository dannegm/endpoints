import { Router } from 'express';

import { supabase } from '@/services/supabase';

const router = Router();
const $schema = supabase.schema('bookworms');

router.get('/settings', async (req, res) => {
    const { data, error } = await $schema.from('settings').select('key, value');

    if (error) {
        res.status(500).json({ message: 'Something went worng' });
    }

    const config = Object.fromEntries(data.map(({ key, value }) => [key, value]));
    res.json(config);
});

router.put('/settings', async (req, res) => {
    const settings = req.body;
    const records = Object.entries(settings).map(([key, value]) => ({ key, value }));

    const { data, error } = await $schema
        .from('settings')
        .upsert(records, { onConflict: 'key' })
        .select();

    if (error) {
        res.status(500).json({ message: 'Something went worng' });
    }

    const config = Object.fromEntries(data.map(({ key, value }) => [key, value]));
    res.json(config);
});

export default router;
