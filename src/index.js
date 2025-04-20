import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

import { logger } from './services/logger';
import { ratelimitMiddleware } from './middlewares';
import { buildSubdomainRouters } from './helpers/builders';

import { getEndpointsRouter } from './endpoints/router';
import shortenerRouter from './shortener';

const PORT = process.env.PORT || 3000;

const app = express();

app
    // ...
    .use(cors())
    .use(cookieParser())
    .use(
        morgan(':method :url :status :response-time ms - :user-agent', {
            stream: {
                write: message => logger.request(message.trim()),
            },
        }),
    )
    .use(bodyParser.json())
    .use(ratelimitMiddleware);

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
