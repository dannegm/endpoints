import { Router } from 'express';
import { supabase } from '@/services/supabase';

import { apiKeyMiddleware } from './middlewares';

const router = Router();
const $schema = supabase.schema('flags');

router.use(apiKeyMiddleware);

router.all('/', (req, res) => {
    return res.send('OK - flags');
});

router.post('/namespaces', async (req, res) => {
    const { name, description } = req.body;
    const { data, error } = await $schema
        .from('namespaces')
        .insert({ name, description })
        .select()
        .single();
    if (error) return res.status(400).json({ error });
    res.json(data);
});

router.get('/namespaces', async (_, res) => {
    const { data, error } = await $schema.from('namespaces').select();
    if (error) return res.status(400).json({ error });
    res.json(data);
});

router.post('/environments', async (req, res) => {
    const { namespace_id, name } = req.body;
    const { data, error } = await $schema
        .from('environments')
        .insert({ namespace_id, name })
        .select()
        .single();
    if (error) return res.status(400).json({ error });
    res.json(data);
});

router.post('/flags', async (req, res) => {
    const { environment_id, key, value, type, description, readonly, metadata } = req.body;

    const { data: existing, error } = await $schema
        .from('feature_flags')
        .select()
        .eq('environment_id', environment_id)
        .eq('key', key)
        .maybeSingle();

    if (!existing || error) {
        const { data, error: insertError } = await $schema
            .from('feature_flags')
            .insert({ environment_id, key, value, type, description, readonly, metadata })
            .select()
            .single();

        if (insertError) return res.status(400).json({ error: insertError });
        res.json(data);
    } else {
        const updatedFields = { value };
        if (type !== undefined) updatedFields.type = type;
        if (description !== undefined) updatedFields.description = description;
        if (metadata !== undefined) updatedFields.metadata = metadata;
        if (readonly !== undefined) updatedFields.readonly = readonly;

        const { data, error } = await $schema
            .from('feature_flags')
            .update(updatedFields)
            .eq('id', existing.id)
            .select()
            .single();

        if (error) return res.status(400).json({ error });
        return res.json(data);
    }
});

router.get('/namespaces/:id', async (req, res) => {
    const { id } = req.params;
    const { data: envs, error: envError } = await $schema
        .from('environments')
        .select('id, name')
        .eq('namespace_id', id);

    if (envError) return res.status(400).json({ error: envError });
    const envsIds = envs.map(env => env.id);

    const { data, error } = await $schema
        .from('feature_flags')
        .select(`key, value, environment: environments(id, name)`)
        .in('environment_id', envsIds);

    if (error) return res.status(400).json({ error });

    const result = {};
    data.forEach(f => {
        if (!result[f.environment.name]) result[f.environment.name] = {};
        result[f.environment.name][f.key] = f.value;
    });

    res.json(result);
});

router.get('/namespaces/:id/details', async (req, res) => {
    const { id } = req.params;

    const { data: namespaceData, error: namespaceError } = await $schema
        .from('namespaces')
        .select()
        .eq('id', id)
        .maybeSingle();

    if (namespaceError) return res.status(400).json({ error: namespaceError });
    if (!namespaceData) return res.status(404).json({ error: 'Namespace not found' });

    const { data: envData, error: envError } = await $schema
        .from('environments')
        .select(
            'id, name, flags: feature_flags(id, key, value, description, readonly, metadata, updated_at)',
        )
        .eq('namespace_id', id);

    if (envError) return res.status(400).json({ error: envError });

    res.json({
        ...namespaceData,
        environments: envData,
    });
});

router.get('/environment/:id', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await $schema
        .from('feature_flags')
        .select('key, value')
        .eq('environment_id', id);

    if (error) return res.status(400).json({ error });

    const result = {};
    data.forEach(f => (result[f.key] = f.value));
    res.json(result);
});

router.get('/environment/:id/details', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await $schema
        .from('environments')
        .select(
            'id, name, flags: feature_flags(id, key, value, description, readonly, metadata, updated_at)',
        )
        .eq('id', id)
        .maybeSingle();

    if (error) return res.status(400).json({ error });
    if (!data) return res.status(404).json({ error: 'Environment not found' });

    res.json(data);
});

router.get('/flags/:id', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await $schema
        .from('feature_flags')
        .select('key, value')
        .eq('id', id)
        .maybeSingle();

    if (error) return res.status(400).json({ error });
    if (!data) return res.status(404).json({ error: 'Flag not found' });
    res.json({ [data.key]: data.value });
});

router.get('/flags/:id/details', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await $schema
        .from('feature_flags')
        .select('key, value, description, readonly, metadata, updated_at')
        .eq('id', id)
        .maybeSingle();

    if (error) return res.status(400).json({ error });
    if (!data) return res.status(404).json({ error: 'Flag not found' });
    res.json(data);
});

export default router;
