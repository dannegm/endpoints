import { Router } from 'express';
import { sha1 } from '@/helpers/crypto';

import ntfy from '@/services/ntfy';
import { totp } from '@/services/security';
import { supabase } from '@/services/supabase';

import { cache, getNoCacheFlag, getPagination, normalize } from './helpers';
import { apiKeyMiddleware } from './middlewares';

const router = Router();
router.use(apiKeyMiddleware);

const $schema = supabase.schema('bookworms');
const $storage = supabase.storage.from('bookworms');

router.all('/', (req, res) => {
    return res.send('OK - bookworms');
});

router.get('/summaries', async (req, res) => {
    const cacheKey = `bookworms.summaries`;
    const { data, cached, error } = await cache(
        cacheKey,
        async () => {
            const { data: authorsData } = await $schema.from('authors').select(`count`);
            const { data: seriesData } = await $schema.from('series').select(`count`);
            const { data: booksData } = await $schema.from('books').select('count');

            return {
                authors: authorsData[0]?.count || 0,
                series: seriesData[0]?.count || 0,
                books: booksData[0]?.count || 0,
            };
        },
        getNoCacheFlag(req),
    );

    res.setHeader('X-Cached', cached);

    if (error) {
        res.status(500).json({ message: 'Something went worng' });
    }

    return res.json(data);
});

router.get('/search', async (req, res) => {
    const query = normalize(req.query?.q || '');
    const pagination = getPagination(req);

    if (!query) {
        return res.status(400).json({
            message: 'You must provide at least a query',
        });
    }

    const cacheKey = `bookworms.search.${sha1(query + pagination)}`;
    const { data, cached, error } = await cache(
        cacheKey,
        async () => {
            const { data: authorsData } = await $schema
                .from('authors')
                .select(`name, views, books(count)`)
                .ilike('name_normalized', `%${query}%`)
                .range(...pagination);

            const { data: seriesData } = await $schema
                .from('series')
                .select(`name, views, books(count)`)
                .ilike('name_normalized', `%${query}%`)
                .range(...pagination);

            const { data: booksCount } = await $schema
                .from('books')
                .select('count')
                .ilike('title_normalized', `%${query}%`);

            const { data: booksData } = await $schema
                .from('books')
                .select(
                    'libid, title, filename, cover_id, views, downloads, serie_name, serie_sequence, authors(name)',
                )
                .ilike('title_normalized', `%${query}%`)
                .range(...pagination);

            const mapCount = item => ({
                name: item.name,
                views: item.views,
                books: item.books[0].count,
            });

            const [from, to] = pagination;

            return {
                authors: {
                    total: authorsData?.length || 0,
                    results: authorsData.map(mapCount) || [],
                },
                series: {
                    total: seriesData?.length || 0,
                    results: seriesData.map(mapCount) || [],
                },
                books: {
                    from,
                    to,
                    page: Number(req.query?.page || 1),
                    count: booksData?.length || 0,
                    total: booksCount[0]?.count || 0,
                    results: booksData || [],
                },
            };
        },
        getNoCacheFlag(req),
    );

    res.setHeader('X-Cached', cached);

    if (error) {
        res.status(500).json({ message: 'Something went worng' });
    }

    return res.json(data);
});

router.get('/top', async (req, res) => {
    const entity = req.query?.entity || 'books';
    const category = req.query?.category || 'views';
    const limit = Math.min(50, req.query?.limit || 10);

    const setupMap = {
        books: {
            categories: ['views', 'downloads'],
            fields: 'libid, title, filename, cover_id, views, downloads, serie_name, serie_sequence, authors(name)',
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

    const cacheKey = `bookworms.top.${entity}.${category}.${limit}`;
    const { data, cached, error } = await cache(
        cacheKey,
        async () => {
            const { data } = await $schema
                .from(entity)
                .select(setupMap[entity].fields)
                .order(category, { ascending: false })
                .limit(limit);

            return data;
        },
        getNoCacheFlag(req),
    );

    res.setHeader('X-Cached', cached);

    if (error) {
        res.status(500).json({ message: 'Something went worng' });
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

    const cacheKey = `bookworms.book.${libid}`;
    const { data, cached, error } = await cache(
        cacheKey,
        async () => {
            const { data: bookData, error: bookError } = await $schema
                .from('books')
                .select(
                    `libid, title, description, labels, published, pagecount, size, filename, cover_id, views, downloads, serie_name, serie_sequence, authors(name)`,
                )
                .eq('libid', libid)
                .single();

            if (!bookData || bookError) {
                throw { type: 'NOT_FOUND' };
            }

            return bookData;
        },
        getNoCacheFlag(req),
    );

    res.setHeader('X-Cached', cached);

    if (error && !error?.type) {
        res.status(500).json({ message: 'Something went worng' });
    }

    if (error?.type === 'NOT_FOUND') {
        return res.status(404).json({ message: 'Book not found' });
    }

    return res.json(data);
});

router.get('/author/:authorKey', async (req, res) => {
    const authorKey = req.params?.authorKey;

    if (!authorKey) {
        return res.status(404).json({
            message: 'Author not found',
        });
    }

    const cacheKey = `bookworms.author.${authorKey}`;
    const { data, cached, error } = await cache(
        cacheKey,
        async () => {
            const authorName = normalize(authorKey.replaceAll('-', ' '));
            const { data: authorData, error: authorError } = await $schema
                .from('authors')
                .select(
                    `name, views, books(libid, title, filename, cover_id, serie_name, serie_sequence, views, downloads)`,
                )
                .eq('name_normalized', authorName)
                .single();

            if (!authorData || authorError) {
                throw { type: 'NOT_FOUND' };
            }

            return authorData;
        },
        getNoCacheFlag(req),
    );

    res.setHeader('X-Cached', cached);

    if (error && !error?.type) {
        res.status(500).json({ message: 'Something went worng' });
    }

    if (error?.type === 'NOT_FOUND') {
        return res.status(404).json({ message: 'Author not found' });
    }

    return res.json(data);
});

router.get('/serie/:serieKey', async (req, res) => {
    const serieKey = req.params?.serieKey;

    if (!serieKey) {
        return res.status(404).json({
            message: 'Author not found',
        });
    }

    const cacheKey = `bookworms.author.${serieKey}`;
    const { data, cached, error } = await cache(
        cacheKey,
        async () => {
            const serieName = normalize(serieKey.replaceAll('-', ' '));
            const { data: serieData, error: serieError } = await $schema
                .from('series')
                .select(
                    `name, views, books(libid, title, filename, cover_id, serie_name, serie_sequence, views, downloads)`,
                )
                .eq('name_normalized', serieName)
                .single();

            if (!serieData || serieError) {
                throw { type: 'NOT_FOUND' };
            }

            return serieData;
        },
        getNoCacheFlag(req),
    );

    res.setHeader('X-Cached', cached);

    if (error && !error?.type) {
        res.status(500).json({ message: 'Something went worng' });
    }

    if (error?.type === 'NOT_FOUND') {
        return res.status(404).json({ message: 'Serie not found' });
    }

    return res.json(data);
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

router.get('/clear-bucket', async (req, res) => {
    await supabase.storage.emptyBucket('bookworms');
    return res.status(204).send();
});

export default router;
