import { Router } from 'express';
import axios from 'axios';

const router = Router();

router.all('/', (req, res) => {
    return res.send('OK - guestbook');
});

router.get('/proxy/download', async (req, res) => {
    const { url, filename = 'file.link' } = req.query;
    if (!url) return res.status(400).send('Missing URL');

    try {
        const response = await axios.get(url, {
            responseType: 'stream',
        });

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader(
            'Content-Type',
            response.headers['content-type'] || 'application/octet-stream',
        );

        response.data.pipe(res);
    } catch (err) {
        res.status(500).json({
            error: 'Failed to download file',
            details: err.message,
        });
    }
});

export default router;
