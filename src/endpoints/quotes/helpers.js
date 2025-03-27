import crypto from 'crypto';
import axios from 'axios';
import { Redis } from '@upstash/redis';
import { extractConfigsAndContent, parseText, stripedElements } from '@/helpers/strings';

const IPINFO_TOKEN = process.env.IPINFO_TOKEN;
const redis = Redis.fromEnv();

export const richQuote = quote => {
    return {
        ...quote,
        quoteStripped: parseText(quote.quote, stripedElements).join(''),
        configs: extractConfigsAndContent(quote.quote).configs,
    };
};

export const richPost = post => {
    return {
        ...post,
        contentStripped: parseText(post.content, stripedElements).join(''),
        configs: extractConfigsAndContent(post.settings).configs,
    };
};

export const encryptCode = (seed, code) => {
    const hmac = crypto.createHmac('sha256', String(seed));
    hmac.update(String(code));
    return hmac.digest('hex');
};

export const getCounter = async key => {
    try {
        const currentCount = await redis.get(key);
        return [currentCount || 0, null];
    } catch (error) {
        return [null, error];
    }
};

export const setCounter = async (key, data, ttl = 30) => {
    try {
        await redis.set(key, data);
        await redis.expire(key, ttl);
        return null;
    } catch (error) {
        return error;
    }
};

export const getIp = req => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
};

export const getClientData = async req => {
    const { ua, sid } = req.query;

    const ip = getIp(req);
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
