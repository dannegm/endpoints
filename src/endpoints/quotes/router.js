import { Router } from 'express';
import { Redis } from '@upstash/redis';

import { quotesRouter } from './quotes';
import { postsRouter } from './posts';
import { actionsRouter } from './actions';
import { sessionsRouter } from './sessions';
import { withApiKey } from '@/helpers/middlewares';

const router = Router();
const redis = Redis.fromEnv();

const API_KEY = process.env.QUOTES_SECRET_TOKEN || '';

router.all('/', (req, res) => {
    return res.send('OK - quotes');
});

router.post('/clear/ratelimit', withApiKey(API_KEY), async (req, res) => {
    const { ip } = req.query;

    if (!ip) {
        return res.status(400).json({ error: 'Invalid payload.' });
    }

    try {
        const keys = await redis.keys(`limiter:${ip}:*`);
        if (keys.length === 0) {
            return res.json({ message: 'OK' });
        }

        const pipeline = redis.pipeline();
        keys.forEach(key => {
            pipeline.del(key);
        });
        await pipeline.exec();
        await redis.del(`limiter:${ip}:*`);

        return res.json({ message: 'OK' });
    } catch (error) {
        console.error('Error clearing rate limit:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

const registerRouters = (instance, routers) =>
    routers.reduce(($instance, $router) => {
        return $router($instance);
    }, instance);

export default registerRouters(router, [
    // ...
    sessionsRouter,
    actionsRouter,
    postsRouter,
    quotesRouter,
]);
