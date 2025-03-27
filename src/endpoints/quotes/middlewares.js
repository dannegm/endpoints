import { supabase } from '@/services/supabase';

const $schema = supabase.schema('quotes');

export const withAuth = async (req, res, next) => {
    const token = req.headers['x-dnn-tracker'];

    if (!token) {
        console.error('Invalid session:', { token });
        return res.status(401).json({ error: 'Invalid session.' });
    }

    await $schema.from('tokens').delete().lt('expires_at', new Date().toISOString());

    const { data, error } = await $schema
        .from('tokens')
        .select('*')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .maybeSingle();

    if (error || !data) {
        console.error('Invalid session:', { token, data, error });
        return res.status(401).json({ error: 'Invalid session.' });
    }

    req.session = data;

    next();
};
