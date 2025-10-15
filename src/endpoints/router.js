// routers/s.js
import path from 'path';
import express from 'express';
import { makeLoader } from '@/loader';
const router = express.Router();

export const getEndpointsRouter = async () => {
    router.use('/', express.static(path.join(__dirname, '../../', '/home/dist')));

    const endpointsRouter = await makeLoader(router);
    return endpointsRouter;
};

export default router;
