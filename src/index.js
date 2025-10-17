import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';

import { logger } from './services/logger';
import { buildSubdomainRouters } from './helpers/builders';

import { clientInfo } from './helpers/middlewares';
import { getEndpointsRouter } from './endpoints/router';
import shortenerRouter from './shortener';

const PORT = process.env.PORT || 3000;

const app = express();

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 500, // Limit each IP to 500 requests per `window` (here, per 15 minutes).
    standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
    ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
    // store: ... , // Redis, Memcached, etc. See below.
});

app
    // ...
    .use(limiter)
    .use(cors())
    .use(cookieParser())
    .use(
        morgan(':method :url :status :response-time ms - :user-agent', {
            stream: {
                write: message => logger.request(message.trim()),
            },
        }),
    )
    .use(clientInfo())
    .use(bodyParser.json());

const startApp = async app => {
    logger.info('Mounting server...');

    const endpointsRouter = await getEndpointsRouter();
    const server = buildSubdomainRouters(app, {
        's|shortener': shortenerRouter,
        default: endpointsRouter,
    });

    server.use('*', (req, res) => {
        return res.status(404).send('Not Found');
    });

    server.use((err, req, res, next) => {
        logger.error(err);
        return res.status(500).json({ error: 'Unexpected internal error' });
    });

    server.listen(PORT, () => {
        logger.info(`Server started at port ${PORT}`);
    });
};

startApp(app);
