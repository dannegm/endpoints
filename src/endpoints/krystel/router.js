import { Router } from 'express';
import { createIpMemoryHandler } from '@/helpers/handlers';
import { getRandomQuote, quoteFromSettings } from './quotes';

const router = Router();

router.all('/', (req, res) => {
    return res.send('OK - krystel');
});

const getQuote = (code, memoryHandler) => {
    if (code) {
        return quoteFromSettings(code);
    }

    return getRandomQuote(memoryHandler);
};

const createMemoryHandlerByIp = createIpMemoryHandler();

router.get('/quote', (req, res) => {
    const code = req.query.code;
    const memoryHandler = createMemoryHandlerByIp(
        req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    );

    const quote = getQuote(code, memoryHandler);

    return res.json(quote);
});

export default router;
