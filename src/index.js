import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

import { logger } from './services/logger';
import { ratelimitMiddleware, createCorsOriginChecker } from './helpers/middlewares';
import { buildSubdomainRouters } from './helpers/builders';

import { clientInfo, umami } from './helpers/middlewares';
import { getEndpointsRouter } from './endpoints/router';
import shortenerRouter from './shortener';

const PORT = process.env.PORT || 3000;

// Lista de dominios permitidos
const allowedDomains = [
    // ...
    'hckr.mx',
    'dnn.im',
    'danielgarcia.me',
    'didntread.app',
    'didnotread.app',
];

const app = express();

app
    // ...
    // .use(
    //     cors({
    //         origin: createCorsOriginChecker(allowedDomains),
    //         credentials: true,
    //     }),
    // )
    .use(cookieParser())
    .use(
        morgan(':method :url :status :response-time ms - :user-agent', {
            stream: {
                write: message => logger.request(message.trim()),
            },
        }),
    )
    // .use(clientInfo())
    // .use(umami())
    // .use(ratelimitMiddleware())
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
