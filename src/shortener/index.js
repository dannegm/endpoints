import express from 'express';
import axios from 'axios';

import { supabase } from '@/services/supabase';
import { nanoid, sha1 } from '@/helpers/crypto';

const IPINFO_TOKEN = process.env.IPINFO_TOKEN;

const router = express.Router();
const $schema = supabase.schema('shortener');

const getBaseUrl = req => {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return `${proto}://${host}`;
};

const withShort = (data, host) => ({ ...data, short: `${host}/${data.code}` });

const hit = async (req, code) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
    let ip_location = 'unknown';

    if (ip !== 'unknown') {
        const { data } = await axios.get(`https://ipinfo.io/${ip}/json?token=${IPINFO_TOKEN}`);
        ip_location = data.city ? `${data.city}, ${data.region}, ${data.country}` : 'unknown';
    }

    const user_agent = req.headers['user-agent'] || 'unknown';
    const referer = req.headers['referer'] || null;

    await $schema.from('hits').insert({
        code,
        ip,
        ip_location,
        user_agent,
        referer,
    });
};

router.post('/shorten', async (req, res) => {
    const { url, code, redirect_type = 'temporal' } = req.body;
    const host = getBaseUrl(req);

    if (!url) return res.status(400).json({ error: 'Missing URL' });

    const hash = sha1(url);
    const { data: existing } = await $schema.from('links').select('*').eq('hash', hash).single();

    if (existing) return res.json(withShort(existing, host));

    const finalCode = code || nanoid(6);
    const { data, error } = await $schema
        .from('links')
        .insert({
            code: finalCode,
            url,
            hash,
            redirect_type,
        })
        .select()
        .single();

    if (error) return res.status(500).json({ error });
    res.status(201).json(withShort(data, host));
});

router.get('/:code', async (req, res) => {
    const { data, error } = await $schema
        .from('links')
        .select('*')
        .eq('code', req.params.code)
        .single();

    if (error || !data) return res.status(404).send('Not found');

    await hit(req, req.params.code);

    const status = data.redirect_type === 'temporal' ? 302 : 301;
    res.redirect(status, data.url);
});

router.get('/meta/:code', async (req, res) => {
    const host = getBaseUrl(req);
    const { data, error } = await $schema
        .from('links')
        .select('*')
        .eq('code', req.params.code)
        .single();

    if (error || !data) return res.status(404).send('Not found');
    res.json(withShort(data, host));
});

router.get('/all', async (req, res) => {
    const host = getBaseUrl(req);
    const { data, error } = await $schema
        .from('links')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'DB error' });
    res.json(data.map(row => withShort(row, host)));
});

router.get('/qr/:code', async (req, res) => {
    const host = getBaseUrl(req);
    const url = `${host}/${req.params.code}`;

    try {
        const qr = await QRCode.toDataURL(url);
        const base64 = qr.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64, 'base64');
        res.set('Content-Type', 'image/png');
        res.send(buffer);
    } catch {
        res.status(500).json({ error: 'QR generation failed' });
    }
});

router.get('/', (req, res) => {
    res.send(`OK - shortener`);
});

export default router;
