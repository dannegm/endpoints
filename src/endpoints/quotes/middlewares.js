import { supabase } from '@/services/supabase';
import { getCounter, getIp, setCounter } from './helpers';

const $schema = supabase.schema('quotes');

const SECRET_TOKEN = process.env.QUOTES_SECRET_TOKEN;
const RATE_LIMIT_MIN = 60;
const RATE_LIMIT_TTL = 60;

export const withSecret = (req, res, next) => {
    const token = req.headers['x-dnn-secret'];

    if (!token) {
        console.error('Invalid secret:', { token });
        return res.status(401).json({ error: 'Invalid secret.' });
    }

    if (token !== SECRET_TOKEN) {
        console.error('Invalid secret:', { token });
        return res.status(403).json({ error: 'Invalid secret.' });
    }

    next();
};

export const withLimit =
    (limit = RATE_LIMIT_MIN, ttl = RATE_LIMIT_TTL) =>
    async (req, res, next) => {
        const ip = await getIp(req);

        const counterKey = `limiter:${ip}:${req.path}`;
        const [counter, counterError] = await getCounter(counterKey);

        await setCounter(counterKey, counter + 1, ttl);

        if (counterError) {
            console.error('Too many request:', { error: counterError });
            return res.status(429).json({ error: 'Too many request.' });
        }

        if (counter && counter >= limit) {
            console.error('Too many request:', { counter });
            return res.status(429).json({ error: 'Too many request.' });
        }

        next();
    };

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
        return res.status(403).json({ error: 'Invalid session.' });
    }

    req.session = data;

    next();
};
