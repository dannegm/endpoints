// routers/s.js
import express from 'express';
import { makeLoader } from '@/loader';
const router = express.Router();

export const getEndpointsRouter = async () => {
    router.all('/', (req, res) => {
        res.send('OK');
    });

    const endpointsRouter = await makeLoader(router);
    return endpointsRouter;
};

export default router;
