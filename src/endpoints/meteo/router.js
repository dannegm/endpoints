import { Router } from 'express';
import axios from 'axios';

const router = Router();

const UPSTREAM = 'https://api.open-meteo.com';

router.all('/*', async (req, res) => {
    try {
        const upstream = await axios({
            method: req.method,
            url: `${UPSTREAM}${req.path}`,
            params: req.query,
            data: req.body,
        });

        res.status(upstream.status).json(upstream.data);
    } catch (err) {
        const status = err.response?.status || 502;
        res.status(status).json(err.response?.data ?? { error: err.message });
    }
});

export default router;
