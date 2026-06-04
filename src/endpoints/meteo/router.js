import { Router } from 'express';

const router = Router();

const UPSTREAM = 'https://api.open-meteo.com';

router.all('/*', async (req, res) => {
    try {
        const { host, ...headers } = req.headers;
        const params = new URLSearchParams(req.query).toString();
        const url = `${UPSTREAM}${req.path}${params ? '?' + params : ''}`;

        const upstream = await fetch(url, {
            method: req.method,
            headers,
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
        });

        const data = await upstream.json();
        res.status(upstream.status).json(data);
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

export default router;
