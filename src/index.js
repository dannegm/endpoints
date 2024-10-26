import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';

import { logger } from './services/logger';
import { makeLoader } from './loader';
import { ratelimitMiddleware } from './middlewares';

const PORT = process.env.PORT || 3000;

const app = express();

app
    // ...
    .use(cors())
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

    app.all('/', (req, res) => {
        res.send('OK');
    });

    const loader = await makeLoader(app);

    app.use('*', (req, res) => {
        return res.status(404).send('Not Found');
    });

    app.use((err, req, res, next) => {
        logger.error(err);
        return res.status(500).json({ error: 'Unexpected internal error' });
    });

    loader.listen(PORT, () => {
        logger.info(`Server started at port ${PORT}`);
    });
};

startApp(app);
