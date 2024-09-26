import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';

import { makeLoader } from './loader';

const PORT = process.env.PORT || 3000;

const app = express();

app
    // ...
    .use(cors())
    .use(morgan(':method :url :status :response-time ms - ":user-agent"'))
    .use(bodyParser.json());

const startApp = app => {
    console.log('Mounting server...');

    app.all('/', (req, res) => {
        res.send('OK');
    });

    const loader = makeLoader(app);

    app.use('*', (req, res) => {
        return res.status(404).send('Not Found');
    });

    loader.listen(PORT, () => {
        console.log(`Server started at port ${PORT}`);
    });
};

startApp(app);
