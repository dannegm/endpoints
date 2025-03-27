import axios from 'axios';
import { capitalize } from 'lodash';

import { parseISO, subMinutes, isBefore, formatISO } from 'date-fns';

import { Ntfy } from '@/services/ntfy';
import { supabase } from '@/services/supabase';

import { blacklist } from './constants';
import { encryptCode } from './helpers';
import { withAuth } from './middlewares';

const IPINFO_TOKEN = process.env.IPINFO_TOKEN;
const APP_TOPIC = process.env.QUOTES_APP_TOPIC;

const SECRET_TOKEN = process.env.QUOTES_SECRET_TOKEN;
const SECRET_SEED = process.env.QUOTES_SECRET_SEED;

const ntfy = new Ntfy(APP_TOPIC);

const $schema = supabase.schema('quotes');

const SESSION_TIMEOUT_MIN = 15;

const getClientData = async req => {
    const { ua, sid } = req.query;

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
    let ip_location = 'unknown';

    if (ip !== 'unknown') {
        const { data } = await axios.get(`https://ipinfo.io/${ip}/json?token=${IPINFO_TOKEN}`);
        ip_location = data.city ? `${data.city}, ${data.region}, ${data.country}` : 'unknown';
    }

    const user_agent = ua || req.headers['user-agent'] || 'unknown';
    const referer = req.headers['referer'] || '';
    const session_id = sid;

    return {
        ip,
        ip_location,
        user_agent,
        referer,
        session_id,
    };
};

const registerSession = async (req, res) => {
    const { space } = req.params;
    const { ip, ip_location, user_agent, referer, session_id } = await getClientData(req);

    const now = new Date();

    const { data: lastSession } = await $schema
        .from('sessions')
        .select('id, started_at, ended_at')
        .eq('space', space)
        .eq('session_id', session_id)
        .order('ended_at', { ascending: false })
        .limit(1)
        .single();

    const timeWindow = subMinutes(now, SESSION_TIMEOUT_MIN);
    const endedAt = !lastSession?.ended_at ? now : parseISO(lastSession.ended_at);

    if (!lastSession || isBefore(endedAt, timeWindow)) {
        await $schema.from('sessions').insert({
            space,
            session_id,
            ip,
            ip_location,
            user_agent,
            referer,
            started_at: formatISO(now),
            ended_at: formatISO(now),
        });
        if (!blacklist.includes(ip)) {
            await ntfy.pushSimple({
                message: `${capitalize(space)} comenzó una sesión`,
            });
        }
    } else {
        await $schema
            .from('sessions')
            .update({ ended_at: formatISO(now) })
            .eq('id', lastSession.id);
    }

    res.sendStatus(204);
};

const requestToken = async (req, res) => {
    const { ip, ip_location, user_agent } = await getClientData(req);

    const tokenFromHeader = req.headers['x-dnn-tracker'];
    const { code } = req.body;

    if (!tokenFromHeader || !code) {
        console.error('Invalid payload:', { tokenFromHeader, code });
        return res.status(400).json({ error: 'Invalid payload.' });
    }

    if (tokenFromHeader !== SECRET_TOKEN) {
        console.error('Invalid token:', { tokenFromHeader });
        return res.status(401).json({ error: 'Invalid payload.' });
    }

    const encodedCode = encryptCode(SECRET_SEED, code);

    const { data, error } = await $schema
        .from('passwords')
        .select('*')
        .eq('password', encodedCode)
        .single();

    if (!data || error) {
        console.error('Invalid code:', { tokenFromHeader, code, encodedCode, data, error });
        return res.status(403).json({ error: 'Invalid payload.' });
    }

    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    await $schema.from('tokens').insert({
        token,
        user_agent,
        ip,
        ip_location,
    });

    if (error) {
        console.error('Error inserting session:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    return res.json({ token });
};

const validateToken = async (req, res) => {
    const { expires_at } = req.session;
    return res.json({ valid: true, expires_at });
};

export const sessionsRouter = router => {
    router.post('/:space/track', registerSession);
    router.post('/:space/auth/token', requestToken);
    router.get('/:space/auth/validate', withAuth, validateToken);
    return router;
};
