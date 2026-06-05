import { Router } from 'express';

const router = Router();

const createProxy =
    (upstream, { headers: extraHeaders = {}, query: extraQuery = {}, body: extraBody = {} } = {}) =>
    async (req, res) => {
        try {
            const { host, ...headers } = req.headers;
            const params = new URLSearchParams({ ...extraQuery, ...req.query }).toString();
            const url = `${upstream}${req.path}${params ? '?' + params : ''}`;

            const isBodyless = ['GET', 'HEAD'].includes(req.method);
            const body = isBodyless ? undefined : JSON.stringify({ ...extraBody, ...req.body });

            const response = await fetch(url, {
                method: req.method,
                headers: { ...extraHeaders, ...headers },
                body,
            });

            const data = await response.json();
            res.status(response.status).json(data);
        } catch (err) {
            res.status(502).json({ error: err.message });
        }
    };

// Example: proxy a service that requires an API key as fallback,
// but lets the client override it with their own credentials.
//
// router.use('/example', createProxy('https://api.example.com', {
//     headers: { Authorization: `Bearer ${process.env.EXAMPLE_API_KEY}` },
//     query:   { version: '2' },
//     body:    { source: 'myapp' },
// }));

router.use('/meteo', createProxy('https://api.open-meteo.com'));

export default router;
