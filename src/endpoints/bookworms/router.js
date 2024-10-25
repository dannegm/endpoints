import { Router } from 'express';
import { trim, lowerCase, deburr } from 'lodash';

import ntfy from '@/services/ntfy';
import { totp } from '@/services/security';
import { supabase } from '@/services/supabase';
import { pipe } from '@/helpers/utils';

const router = Router();

const toString = str => str.toString();
const normalize = pipe([toString, trim, lowerCase, deburr]);

const $schema = supabase.schema('bookworms');
const $storage = supabase.storage.from('bookworms');

router.all('/', (req, res) => {
    return res.send('OK - bookworms');
});

router.get('/summaries', async (req, res) => {
    const { data: authorsData } = await $schema.from('authors').select(`count`);
    const { data: seriesData } = await $schema.from('series').select(`count`);
    const { data: booksData } = await $schema.from('books').select('count');

    return res.json({
        authors: authorsData[0].count || 0,
        series: seriesData[0].count || 0,
        books: booksData[0].count || 0,
    });
});

router.get('/search', async (req, res) => {
    const query = normalize(req.query?.q || '');

    if (!query) {
        return res.status(400).json({
            message: 'You must provide at least a query',
        });
    }

    const { data: authorsData } = await $schema
        .from('authors')
        .select(`name, views, books(count)`)
        .ilike('name_normalized', `%${query}%`)
        .order('name_normalized', { ascending: true });

    const { data: seriesData } = await $schema
        .from('series')
        .select(`name, views, books(count)`)
        .ilike('name_normalized', `%${query}%`)
        .order('name_normalized', { ascending: true });

    const { data: booksData } = await $schema
        .from('books')
        .select(
            'libid, title, filename, views, downloads, serie_name, serie_sequence, authors(name)',
        )
        .ilike('title_normalized', `%${query}%`)
        .order('title_normalized', { ascending: true })
        .order('serie_sequence', { ascending: true });

    const mapCount = item => ({ name: item.name, views: item.views, books: item.books[0].count });

    return res.json({
        authors: {
            count: authorsData.length,
            results: authorsData.map(mapCount),
        },
        series: {
            count: seriesData.length,
            results: seriesData.map(mapCount),
        },
        books: {
            count: booksData.length,
            results: booksData,
        },
    });
});

router.get('/top', async (req, res) => {
    const entity = req.query?.entity || 'books';
    const category = req.query?.category || 'views';
    const limit = Math.max(50, req.query?.limit || 10);

    const setupMap = {
        books: {
            categories: ['views', 'downloads'],
            fields: 'libid, title, filename, views, downloads, serie_name, serie_sequence, authors(name)',
        },
        series: {
            categories: ['views'],
            fields: 'name, views',
        },
        authors: {
            categories: ['views'],
            fields: 'name, views',
        },
    };

    if (!Object.keys(setupMap).includes(entity)) {
        return res.status(400).json({
            message: 'Provide a valid entity',
            allowedEntities: Object.keys(setupMap),
        });
    }

    if (!setupMap[entity].categories.includes(category)) {
        return res.status(400).json({
            message: 'Provide a valid category',
            allowedCategories: setupMap[entity].categories,
        });
    }

    const { data, error } = await $schema
        .from(entity)
        .select(setupMap[entity].fields)
        .order(category, { ascending: false })
        .limit(limit);

    if (error) {
        return res.status(500).json({
            message: 'Something went wrong',
            error,
        });
    }

    return res.json(data);
});

router.get('/book/:libid', async (req, res) => {
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

    return res.json(bookData);
});

router.get('/author/:authorKey', async (req, res) => {
    const authorKey = req.params?.authorKey;

    if (!authorKey) {
        return res.status(404).json({
            message: 'Author not found',
        });
    }

    const authorName = normalize(authorKey.replaceAll('-', ' '));

    const { data: authorData, error: authorError } = await $schema
        .from('authors')
        .select(
            `name, views, books(libid, title, filename, serie_name, serie_sequence, views, downloads)`,
        )
        .eq('name_normalized', authorName)
        .single();

    if (!authorData || authorError) {
        return res.status(404).json({
            message: 'Author not found',
        });
    }

    return res.json(authorData);
});

router.get('/serie/:serieKey', async (req, res) => {
    const serieKey = req.params?.serieKey;

    if (!serieKey) {
        return res.status(404).json({
            message: 'Author not found',
        });
    }

    const serieName = normalize(serieKey.replaceAll('-', ' '));

    const { data: serieData, error: serieError } = await $schema
        .from('series')
        .select(
            `name, views, books(libid, title, filename, serie_name, serie_sequence, views, downloads)`,
        )
        .eq('name_normalized', serieName)
        .single();

    if (!serieData || serieError) {
        return res.status(404).json({
            message: 'Serie not found',
        });
    }

    return res.json(serieData);
});

router.get('/request', async (req, res) => {
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
        message: 'Reach the validate url to see if your book is available',
        validateUrl: `/bookworms/validate?filename=${filename}`,
        filename,
    });
});

router.get('/validate', async (req, res) => {
    const filename = req.query?.filename;

    if (!filename && !author) {
        return res.status(400).json({
            message: 'Missing filename.',
        });
    }

    const { error } = await $storage.download(filename);

    if (error) {
        return res.status(404).json({
            message: 'Book not found, please request first and try again later',
            requestUrl: `/bookworms/request?filename=${filename}`,
            filename,
        });
    }

    return res.json({
        message: 'Book available and ready for download',
        downloadUrl: `/bookworms/download?filename=${filename}`,
        filename,
    });
});

router.get('/download', async (req, res) => {
    const filename = req.query?.filename;

    if (!filename) {
        return res.status(404).send();
    }

    const { data, error } = await $storage.download(filename);

    if (!data || error) {
        return res.status(404).send();
    }

    await $storage.remove([filename]);

    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/epub+zip');

    return res.send(buffer);
});

export default router;