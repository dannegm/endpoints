import { Router } from 'express';
import { lowerCase, deburr } from 'lodash';

import ntfy from '@/services/ntfy';
import { totp } from '@/services/security';
import { supabase } from '@/services/supabase';
import { pipe } from '@/helpers/utils';
import { loadBooks } from './migrate';

const router = Router();

const toString = str => str.toString();
const normalize = pipe([toString, lowerCase, deburr]);

const $schema = supabase.schema('bookworms');

router.all('/', (req, res) => {
    return res.send('OK - bookworms');
});

router.all('/book/:libid', async (req, res) => {
    const libid = req.params?.libid;

    if (!libid) {
        return res.status(404).json({
            message: 'Book not found',
        });
    }

    const { data: bookData, error: bookError } = await $schema
        .from('books')
        .select(
            `libid, title, description, labels, published, pagecount, size, filename, views, downloads, serie_name, serie_sequence, authors(name)`,
        )
        .eq('libid', libid)
        .single();

    if (!bookData || bookError) {
        return res.status(404).json({
            message: 'Book not found',
        });
    }

    const { filename, ...book } = bookData;

    return res.json({
        ...book,
        requestUrl: `/bookworms/request?filename=${filename}`,
        downloadUrl: `/bookworms/download?filename=${filename}`,
    });
});

router.all('/search', async (req, res) => {
    const title = normalize(req.query?.title || '');
    const author = normalize(req.query?.author || '');

    if (!title && !author) {
        return res.status(400).json({
            message: 'You must provide at least a title or author',
        });
    }

    const getBooks = async ({ title = undefined, authors = [] }) => {
        const query = [];

        if (title) {
            query.push(`title_normalized.ilike.%${title}%`);
        }

        if (authors.length) {
            query.push(`id.in.(${authors})`);
        }

        const { data: booksData, error } = await $schema
            .from('books')
            .select(
                `libid, title, description, labels, published, pagecount, size, filename, views, downloads, serie_name, serie_sequence, authors(name)`,
            )
            .or(query);

        const data = booksData.map(({ filename, ...book }) => ({
            ...book,
            downloadUrl: `/bookworms/download?filename=${filename}`,
            requestUrl: `/bookworms/request?filename=${filename}`,
        }));

        return { data, error };
    };

    let authorsBooks = [];

    if (author) {
        const { data: authorsData } = await $schema
            .from('authors')
            .select(`name, books(id)`)
            .or(`name_normalized.ilike.%${author}%)`);

        authorsBooks = authorsData.flatMap(author => author.books).map(({ id }) => id);
    }

    const { data: booksData } = await getBooks({ title, authors: authorsBooks });

    return res.json({
        booksData,
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
