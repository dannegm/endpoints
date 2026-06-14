import { Router } from 'express';

const router = Router();

const HOP_BY_HOP = new Set([
    'host',
    'connection',
    'keep-alive',
    'transfer-encoding',
    'te',
    'trailers',
    'upgrade',
    'proxy-authenticate',
    'proxy-authorization',
    'content-encoding',
    'content-length',
]);

const CUSTOM_HOP_BY_HOP = new Set([...HOP_BY_HOP, 'origin', 'referer', 'x-proxy-target']);

const PROXY_UA = 'DNN-Endpoints/1.1.0';

const readBody = async (req, extraBody = {}) => {
    if (['GET', 'HEAD'].includes(req.method)) return undefined;
    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (ct.includes('application/json')) return JSON.stringify({ ...extraBody, ...req.body });
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return Buffer.concat(chunks);
};

const sendResponse = async (response, res) => {
    for (const [key, value] of response.headers.entries()) {
        if (!HOP_BY_HOP.has(key.toLowerCase())) res.setHeader(key, value);
    }
    const buffer = await response.arrayBuffer();
    res.status(response.status).send(Buffer.from(buffer));
};

const createProxy =
    (upstream, { headers: extraHeaders = {}, query: extraQuery = {}, body: extraBody = {} } = {}) =>
    async (req, res) => {
        try {
            const headers = Object.fromEntries(
                Object.entries(req.headers).filter(([k]) => !HOP_BY_HOP.has(k.toLowerCase())),
            );

            const params = new URLSearchParams({ ...extraQuery, ...req.query }).toString();
            const url = `${upstream}${req.path}${params ? '?' + params : ''}`;
            const body = await readBody(req, extraBody);

            const response = await fetch(url, {
                method: req.method,
                headers: { ...extraHeaders, ...headers },
                body,
                tls: { rejectUnauthorized: false },
            });

            await sendResponse(response, res);
        } catch (err) {
            res.status(502).json({ error: err.message });
        }
    };

// Custom proxy — the target URL (path + query included) goes in x-proxy-target.
//
// curl 'https://endpoints.hckr.mx/proxys/custom' \
//      -H 'x-proxy-target: https://endpoints.hckr.mx/starfish/otp'
//
// curl -X POST 'https://endpoints.hckr.mx/proxys/custom' \
//      -H 'x-proxy-target: https://api.example.com/users?active=true' \
//      -H 'Content-Type: application/json' \
//      -d '{"name":"dan"}'

router.use('/custom', async (req, res) => {
    try {
        const target = req.headers['x-proxy-target'];
        if (!target) return res.status(400).json({ error: 'Missing x-proxy-target header' });

        const headers = Object.fromEntries(
            Object.entries(req.headers).filter(([k]) => !CUSTOM_HOP_BY_HOP.has(k.toLowerCase())),
        );
        headers['user-agent'] = PROXY_UA;

        const body = await readBody(req);
        const response = await fetch(target, {
            method: req.method,
            headers,
            body,
            tls: { rejectUnauthorized: false },
        });

        await sendResponse(response, res);
    } catch (err) {
        console.error('Proxy error:', err);
        res.status(502).json({ error: err.message });
    }
});

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
