import { Readable } from 'node:stream';
import { Router } from 'express';

const router = Router();

router.all('/', (req, res) => {
    return res.send('OK - guestbook');
});

router.get('/proxy/download', async (req, res) => {
    const { url, filename = 'file.link' } = req.query;
    if (!url) return res.status(400).send('Missing URL');

    try {
        const response = await fetch(url);

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');

        Readable.fromWeb(response.body).pipe(res);
    } catch (err) {
        res.status(500).json({ error: 'Failed to download file', details: err.message });
    }
});

export default router;
