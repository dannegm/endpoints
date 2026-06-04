import { Router } from 'express';

const router = Router();

const createProxy = upstream => async (req, res) => {
    try {
        const { host, ...headers } = req.headers;
        const params = new URLSearchParams(req.query).toString();
        const url = `${upstream}${req.path}${params ? '?' + params : ''}`;

        const response = await fetch(url, {
            method: req.method,
            headers,
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
};

router.use('/meteo', createProxy('https://api.open-meteo.com'));

export default router;
