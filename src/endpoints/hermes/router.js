import { Router } from 'express';
import { ulid } from 'ulid';
import { buildCustomLogger } from '@/services/logger.js';
import { withApiKey } from '@/helpers/middlewares';

const APP_KEY = process.env.APP_KEY;

const logger = buildCustomLogger('hermes');

const router = Router();
const topics = new Map();

router.use(withApiKey(APP_KEY));

router.all('/', (req, res) => {
    return res.send('OK - hermes');
});

router.get('/sub/:topic', (req, res) => {
    const { topic } = req.params;

    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });
    res.flushHeaders();
    res.write(`retry: 1000\n\n`);

    if (!topics.has(topic)) topics.set(topic, new Set());
    topics.get(topic).add(res);

    logger.info(`New subscription to topic: ${topic} (${topics.get(topic).size} subscribers)`);

    req.on('close', () => {
        const set = topics.get(topic);
        set?.delete(res);
        if (set?.size === 0) topics.delete(topic);
    });
});

router.post('/pub/:topic/:event', (req, res) => {
    const { topic, event } = req.params;
    const data = JSON.stringify(req.body);

    const clients = topics.get(topic);
    if (!clients) return res.sendStatus(404);

    for (const res of clients) {
        try {
            res.write(`id: ${ulid()}\n`);
            res.write(`event: ${event}\n`);
            res.write(`data: ${data}\n\n`);

            logger.info(`Published event "${event}" to topic "${topic}"`);
        } catch (err) {
            logger.error(`Error sending event "${event}" to topic "${topic}": ${err.message}`);
        }
    }

    res.sendStatus(200);
});

export default router;
