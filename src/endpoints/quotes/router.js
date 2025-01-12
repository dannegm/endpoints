import { Router } from 'express';
import axios from 'axios';

import { Ntfy } from '@/services/ntfy';
import { buildCustomLogger } from '@/services/logger';
import { supabase } from '@/services/supabase';
import { createIpMemoryHandler } from '@/helpers/handlers';
import { parseText, stripedElements } from '@/helpers/strings';
import { withQueryParams } from '@/middlewares';

const IPINFO_TOKEN = process.env.IPINFO_TOKEN;
const APP_TOPIC = process.env.QUOTES_APP_TOPIC;

const logger = buildCustomLogger('quotes');
const ntfy = new Ntfy(APP_TOPIC);

const router = Router();
const $schema = supabase.schema('quotes');

const DEFAULT_REPEAT_PROBABLITY = 0.25;
const createMemoryHandlerByIp = createIpMemoryHandler();

const logEvent = async (req, type, space, quote_id, metadata = null) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
    let ip_location = 'unknown';

    if (ip !== 'unknown') {
        const { data } = await axios.get(`https://ipinfo.io/${ip}/json?token=${IPINFO_TOKEN}`);
        ip_location = data.city ? `${data.city}, ${data.region}, ${data.country}` : 'unknown';
    }

    const user_agent = req.headers['user-agent'] || 'unknown';

    logger.info(`[${type}] ID:${quote_id} IP:${ip} UA:${user_agent}`);

    await $schema.from('events').insert({
        ip,
        user_agent,
        created_at: new Date().toISOString(),
        type,
        space,
        quote_id,
        metadata,
        ip_location,
    });
};

router.all('/', (req, res) => {
    return res.send('OK - quotes');
});

router.get('/:space', async (req, res) => {
    const { space } = req.params;

    try {
        const { data, error } = await $schema
            .from('quotes')
            .select('*')
            .eq('space', space)
            .order('id', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'No quotes found for the given space' });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch quotes', details: error.message });
    }
});

router.get(
    '/:space/pick',
    withQueryParams({
        'quote.id': {
            type: Number,
            default: null,
        },
        repeatProbability: {
            type: Number,
            default: DEFAULT_REPEAT_PROBABLITY,
        },
    }),
    async (req, res) => {
        const { space } = req.params;
        const { repeatProbability } = req.query;

        if (req.query['quote.id']) {
            const { data, error } = await $schema
                .from('quotes')
                .select('*')
                .eq('space', space)
                .eq('id', req.query['quote.id'])
                .single();

            await logEvent(req, 'view', space, req.query['quote.id']);

            if (error) return res.status(400).json({ error: error.message });
            return res.json(data);
        }

        const memoryHandler = createMemoryHandlerByIp(req.headers['x-forwarded-for']);

        const { data: countData, error: countError } = await $schema.rpc(
            'count_non_repeated_quotes',
            {
                space_param: space,
                exclude_ids: memoryHandler.getMemory(),
            },
        );

        if (!countData || countError) {
            memoryHandler.clearMemory();
        }

        const { data, error } = await $schema.rpc('get_random_quote', {
            space_param: space,
            exclude_ids: memoryHandler.getMemory(),
            repeat_probability: repeatProbability,
        });

        if (error) return res.status(400).json({ error: error.message });

        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'No quotes found for this space' });
        }

        const [quote] = data;
        memoryHandler.updateMemory([...memoryHandler.getMemory(), quote.id]);
        await logEvent(req, 'view', space, quote.id);

        return res.json(quote);
    },
);

router.get('/:space/:id', async (req, res) => {
    const { space, id } = req.params;

    const { data, error } = await $schema
        .from('quotes')
        .select('*')
        .eq('space', space)
        .eq('id', id)
        .single();

    if (error) return res.status(400).json({ error: error.message });

    await logEvent(req, 'view', space, id);
    return res.json(data);
});

router.put('/:space/:id', async (req, res) => {
    const { space, id } = req.params;
    const { quote } = req.body;

    if (!quote) return res.status(400).json({ error: 'Quote is required' });

    const { data, error } = await $schema
        .from('quotes')
        .update({ quote })
        .eq('space', space)
        .eq('id', id)
        .select();

    if (error) return res.status(400).json({ error: error.message });
    await logEvent(req, 'updated', space, id);
    return res.json(data);
});

router.delete('/:space/:id', async (req, res) => {
    const { space, id } = req.params;

    const { data, error } = await $schema
        .from('quotes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('space', space)
        .eq('id', id)
        .select();

    if (error) return res.status(400).json({ error: error.message });
    await logEvent(req, 'deleted', space, id);
    return res.json(data);
});

router.post('/:space/bulk', async (req, res) => {
    const { space } = req.params;
    const { quotes } = req.body;

    if (!Array.isArray(quotes) || quotes.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty quotes array' });
    }

    const dataToInsert = quotes.map(quote => ({ space, quote }));

    try {
        const { data, error } = await $schema.from('quotes').insert(dataToInsert);

        if (error) throw error;

        res.status(201).json({ success: true, inserted: data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to insert quotes', details: error.message });
    }
});

router.post('/:space', async (req, res) => {
    const { space } = req.params;
    const { quote } = req.body;

    if (!quote) return res.status(400).json({ error: 'Quote is required' });

    const { data, error } = await $schema.from('quotes').insert({ space, quote }).select();

    if (error) return res.status(400).json({ error: error.message });
    await logEvent(req, 'created', space, data.id);
    return res.status(201).json(data);
});

const allowedActionsForNotification = [
    // ...
    'like',
];

router.post(
    '/:space/:id/action/:action',
    withQueryParams({
        code: {
            type: String,
            default: req => {
                const { id } = req.params;
                return `${id}:0:0:0:0`;
            },
        },
        ua: {
            type: String,
            default: 'unknown',
        },
    }),
    async (req, res) => {
        const { space, id, action } = req.params;
        const { code, ua } = req.query;
        const meta = req.body;

        const { data, error } = await $schema
            .from('quotes')
            .select('*')
            .eq('space', space)
            .eq('id', id)
            .single();

        if (error) return res.status(400).json({ error: error.message });

        const customReq = {
            ip: req.ip,
            headers: {
                'x-forwarded-for': req.headers['x-forwarded-for'],
                'user-agent': ua,
            },
        };

        await logEvent(customReq, action, space, id, { code, ...meta });

        if (allowedActionsForNotification.includes(action)) {
            await ntfy.pushRich({
                title: 'Krystel liked',
                message: parseText(data.quote, stripedElements).join(''),
                tags: 'heart',
                click: `https://axolote.me/krystel?code=${code}`,
            });
        }

        return res.json({
            action,
            code: req.query.code,
            ...data,
        });
    },
);

export default router;
