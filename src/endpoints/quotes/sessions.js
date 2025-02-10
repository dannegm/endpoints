import axios from 'axios';
import crypto from 'crypto';
import { capitalize } from 'lodash';

import { parseISO, subMinutes, isBefore, formatISO } from 'date-fns';

import { Ntfy } from '@/services/ntfy';
import { supabase } from '@/services/supabase';
import { blacklist } from './constants';

const IPINFO_TOKEN = process.env.IPINFO_TOKEN;
const APP_TOPIC = process.env.QUOTES_APP_TOPIC;

const ntfy = new Ntfy(APP_TOPIC);

const $schema = supabase.schema('quotes');

const SESSION_TIMEOUT_MIN = 15;

const generateSessionId = (ip, userAgent) => {
    const secret = process.env.HASH_SECRET || 'default_secret';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(ip + userAgent);
    return hmac.digest('hex');
};

const registerSession = async (req, res) => {
    const { space } = req.params;
    const { ua } = req.query;

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
    let ip_location = 'unknown';

    if (ip !== 'unknown') {
        const { data } = await axios.get(`https://ipinfo.io/${ip}/json?token=${IPINFO_TOKEN}`);
        ip_location = data.city ? `${data.city}, ${data.region}, ${data.country}` : 'unknown';
    }

    const user_agent = ua || req.headers['user-agent'] || 'unknown';
    const referer = req.headers['referer'] || '';
    const session_id = generateSessionId(ip, user_agent);
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

export const sessionsRouter = router => {
    router.post('/:space/track', registerSession);
    return router;
};
