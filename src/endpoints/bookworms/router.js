import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { lowerCase, deburr } from 'lodash';
import axios from 'axios';

import ntfy from '@/services/ntfy';
import { totp } from '@/services/security';
import { supabase } from '@/services/supabase';
import { pipe } from '@/helpers/utils';
import { buildCustomLogger } from '@/services/logger';

const router = Router();
const logger = buildCustomLogger('bookworms');

const toString = str => str.toString();
const sanitize = pipe([toString, lowerCase, deburr]);

const initializeDB = async ({ extarlnalUrl, localName }) => {
    const outputPath = path.join(__dirname, localName);

    logger.info(`Initializing DB: ${outputPath}`);

    if (fs.existsSync(outputPath)) {
        logger.info(`DB already exists: ${outputPath}`);
        return;
    }

    try {
        const response = await axios({
            method: 'get',
            url: extarlnalUrl,
            responseType: 'stream',
        });

        const writer = fs.createWriteStream(outputPath);

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', () => {
                logger.success(`DB downloaded successfully to: ${outputPath}`);
                resolve();
            });
            writer.on('error', error => {
                logger.error('Error writing DB');
                reject(error);
            });
        });
    } catch (error) {
        logger.error('Error downloading DB: ' + error.message);
    }
};

initializeDB({
    extarlnalUrl:
        'https://firebasestorage.googleapis.com/v0/b/d4nn36m.appspot.com/o/indice.json?alt=media&token=f25e77fc-c93f-49e9-9576-ee6183f2e4b6',
    localName: 'indice.json',
});

router.all('/', (req, res) => {
    return res.send('OK - bookworms');
});

router.all('/book/:libid', async (req, res) => {
    const startTime = Date.now();
    const libid = req.params?.libid;

    if (!libid) {
        return res.status(404).json({
            message: 'Book not found',
        });
    }

    const { default: books } = await import(`./indice.json`);

    const { filename, ...book } = books.find(book => {
        return String(book.libid) === String(libid);
    });

    if (!book) {
        return res.status(404).json({
            message: 'Book not found',
        });
    }

    return res.json({
        ...book,
        startTime,
        requestUrl: `/bookworms/request?filename=${filename}`,
        downloadUrl: `/bookworms/download?filename=${filename}`,
    });
});

router.all('/search', async (req, res) => {
    const startTime = Date.now();
    const title = sanitize(req.query?.title || '');
    const author = sanitize(req.query?.author || '');

    if (!title && !author) {
        return res.status(400).json({
            message: 'You must provide at least a title or author',
        });
    }

    const { default: books } = await import(`./indice.json`);

    const results = books
        .filter(book => {
            const matchTitle = title !== '' ? sanitize(book.title).includes(title) : false;
            const matchAuthor = author !== '' ? sanitize(book.authors).includes(author) : false;
            return matchTitle || matchAuthor;
        })
        .map(({ filename, ...book }) => ({
            ...book,
            requestUrl: `/bookworms/request?filename=${filename}`,
            downloadUrl: `/bookworms/download?filename=${filename}`,
        }));

    return res.json({
        duration: Date.now() - startTime,
        count: results.length,
        results,
    });
});

router.all('/request', async (req, res) => {
    const filename = req.query?.filename;

    if (!filename && !author) {
        return res.status(400).json({
            message: 'Missing filename.',
        });
    }

    const otp = totp.generate();

    await ntfy.pushSimple({
        message: `requestBook::${filename}=${otp}`,
    });

    return res.json({
        downloadUrl: `/bookworms/download?filename=${filename}`,
    });
});

router.all('/download', async (req, res) => {
    const filename = req.query?.filename;

    if (!filename && !author) {
        return res.status(400).json({
            message: 'Missing filename.',
        });
    }
    const { data, error } = await supabase.storage.from('bookworms').download(filename);

    if (error) {
        return res.status(404).json({
            message: 'Book not found, please request first and try again later',
            requestUrl: `/bookworms/request?filename=${filename}`,
        });
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/epub+zip');

    return res.send(buffer);
});

export default router;
