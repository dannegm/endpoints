import axios from 'axios';
import { capitalize } from 'lodash';

import { Ntfy } from '@/services/ntfy';
import { buildCustomLogger } from '@/services/logger';
import { supabase } from '@/services/supabase';

import { parseText, stripedElements } from '@/helpers/strings';
import { withQueryParams } from '@/middlewares';
import { richQuote } from './helpers';

const IPINFO_TOKEN = process.env.IPINFO_TOKEN;
const APP_TOPIC = process.env.QUOTES_APP_TOPIC;

const logger = buildCustomLogger('quotes');
const ntfy = new Ntfy(APP_TOPIC);

const $schema = supabase.schema('quotes');

const allowedActionsForNotification = {
    // ...
    like: {
        type: 'like',
        actionDescription: 'liked',
        tags: 'heart',
    },
    balloons: {
        type: 'balloons',
        actionDescription: 'has exploded all the balloons',
        tags: 'balloon',
    },
};

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

const postActionQueryPayload = withQueryParams({
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
});
const registerAction = async (req, res) => {
    const { space, id, action } = req.params;
    const { code, ua } = req.query;
    const meta = req.body;

    const customReq = {
        ip: req.ip,
        headers: {
            'x-forwarded-for': req.headers['x-forwarded-for'],
            'user-agent': ua,
        },
    };

    if (id === 'none') {
        await logEvent(customReq, action, space, null, meta);

        return res.json({
            action,
            meta,
        });
    }

    await logEvent(customReq, action, space, id, { code, ...meta });

    const { data, error } = await $schema
        .from('quotes')
        .select('*')
        .eq('space', space)
        .eq('id', id)
        .single();

    if (error) return res.status(500).json({ error: error.message });

    if (Object.keys(allowedActionsForNotification).includes(action)) {
        await ntfy.pushRich({
            title: `${capitalize(space)} ${allowedActionsForNotification[action].actionDescription}`,
            message: parseText(data.quote, stripedElements).join(''),
            tags: allowedActionsForNotification[action].tags,
            click: `https://axolote.me/${space}?code=${code}`,
        });
    }

    return res.json({
        action,
        meta,
        code: req.query.code,
        ...data,
    });
};

const deleteActionById = async (req, res) => {
    const { actionId } = req.params;
    await $schema.from('events').delete().eq('id', actionId);
    return res.status(204).end();
};

const readAllActions = async (req, res) => {
    const { space } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const pageNum = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);

    const start = (pageNum - 1) * pageSize;
    const end = start + pageSize - 1;

    const { data, error } = await $schema
        .from('events')
        .select('*, quotes(*)')
        .eq('space', space)
        .order('created_at', { ascending: false })
        .range(start, end);

    if (error) return res.status(500).json({ error: error.message });

    const logs = data.map(item => {
        const { quotes, ...rest } = item;

        return {
            ...rest,
            quote: !quotes ? null : richQuote(quotes),
        };
    });

    return res.status(200).json(logs);
};

const deleteAllActions = async (req, res) => {
    const { space } = req.params;
    const { error } = await $schema.from('events').delete().eq('space', space);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
};

export const actionsRouter = router => {
    router.post('/:space/:id/action/:action', postActionQueryPayload, registerAction);
    router.delete('/actions/:actionId', deleteActionById);

    router.get('/:space/actions', readAllActions);
    router.delete('/:space/actions', deleteAllActions);
    return router;
};
