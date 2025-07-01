import { Router } from 'express';
import { Resend } from 'resend';

import { sha1 } from '@/helpers/crypto';

import ntfy from '@/services/ntfy';
import { totp } from '@/services/security';
import { supabase } from '@/services/supabase';

import { cache, getNoCacheFlag, getPagination, normalize } from './helpers';
import { apiKeyMiddleware } from './middlewares';

const resend = new Resend(process.env.RESEND_API_KEY || '');
const router = Router();
router.use(apiKeyMiddleware);

const $schema = supabase.schema('bookworms');
const $storage = supabase.storage.from('bookworms');

router.all('/', (req, res) => {
    return res.send('OK - bookworms');
});

router.get('/settings', async (req, res) => {
    const { data, error } = await $schema.from('settings').select('key, value');

    if (error) {
        res.status(500).json({ message: 'Something went worng' });
    }

    const config = Object.fromEntries(data.map(({ key, value }) => [key, value]));
    res.json(config);
});

router.put('/settings', async (req, res) => {
    const settings = req.body;
    const records = Object.entries(settings).map(([key, value]) => ({ key, value }));

    const { data, error } = await $schema
        .from('settings')
        .upsert(records, { onConflict: 'key' })
        .select();

    if (error) {
        res.status(500).json({ message: 'Something went worng' });
    }

    const config = Object.fromEntries(data.map(({ key, value }) => [key, value]));
    res.json(config);
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
                .order('id', { ascending: false })
                .ilike('name_normalized', `%${query}%`);
            // .range(...pagination)

            const { data: seriesData } = await $schema
                .from('series')
                .select(`name, views, books(count)`)
                .order('id', { ascending: false })
                .ilike('name_normalized', `%${query}%`);
            // .range(...pagination)

            const { data: booksCount } = await $schema
                .from('books')
                .select('count')
                .ilike('title_normalized', `%${query}%`);

            const { data: booksData } = await $schema
                .from('books')
                .select(
                    'libid, title, filename, cover_id, views, downloads, serie_name, serie_sequence, authors(name)',
                )
                .order('id', { ascending: false })
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

const entities = {
    books: {
        rpc: 'search_books_similar',
        rpc_counter: 'count_books_similar',
        threshold: 0.3,
        map: item => item,
    },
    author: {
        rpc: 'search_authors_similar',
        rpc_counter: 'count_authors_similar',
        threshold: 0.3,
        map: item => ({
            id: item.id,
            name: item.name,
            views: item.views,
            books: item.books_count,
        }),
    },
    serie: {
        rpc: 'search_series_similar',
        rpc_counter: 'count_series_similar',
        threshold: 0.3,
        map: item => ({
            id: item.id,
            name: item.name,
            views: item.views,
            books: item.books_count,
        }),
    },
};

router.get('/search/:entity', async (req, res) => {
    const { entity } = req.params;
    const config = entities[entity];
    if (!config) return res.status(404).json({ message: 'Invalid entity' });

    const query = normalize(req.query?.q || '');
    if (!query) return res.status(400).json({ message: 'Missing query' });

    const pagination = getPagination(req);
    const cacheKey = `bookworms.search.${sha1(entity + query + pagination)}`;

    const { data, cached, error } = await cache(
        cacheKey,
        async () => {
            const [from, to] = pagination;

            const { data, error } = await $schema.rpc(config.rpc, {
                q: query,
                threshold: config.threshold,
                from_index: from,
                to_index: to,
            });

            if (error) throw error;

            const { data: countData } = await $schema.rpc(config.rpc_counter, {
                q: query,
                threshold: config.threshold,
            });

            const totalCount = countData || 0;

            return {
                data: data?.map(config.map) || [],
                pagination: {
                    from,
                    to: to,
                    found: totalCount,
                    count: data?.length || 0,
                    page: Number(req.query?.page || 1),
                    pages: Math.ceil(totalCount / (to - from + 1)),
                },
            };
        },
        getNoCacheFlag(req),
    );

    res.setHeader('X-Cached', cached);

    if (error) {
        res.status(500).json({ error, message: 'Something went worng' });
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
                    `id, libid, title, description, labels, published, pagecount, size, filename, cover_id, views, downloads, serie_name, serie_sequence, authors(name, views, books(count))`,
                )
                .eq('libid', libid)
                .single();

            if (!bookData || bookError) {
                throw { type: 'NOT_FOUND' };
            }

            bookData.authors = bookData.authors.map(({ name, views, books }) => ({
                name,
                views,
                books: books[0]?.count || 0,
            }));

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

    await $schema.rpc('increment_field', {
        target_table: 'books',
        target_column: 'views',
        target_id: data.id,
    });

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
                    `id, name, views, books(libid, title, filename, cover_id, serie_name, serie_sequence, views, downloads)`,
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

    await $schema.rpc('increment_field', {
        target_table: 'authors',
        target_column: 'views',
        target_id: data.id,
    });

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
                    `id, name, views, books(libid, title, filename, cover_id, serie_name, serie_sequence, views, downloads)`,
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

    await $schema.rpc('increment_field', {
        target_table: 'series',
        target_column: 'views',
        target_id: data.id,
    });

    return res.json(data);
});

router.get('/category/:categoryKey', async (req, res) => {
    const { categoryKey } = req.params;

    const pagination = getPagination(req);
    const cacheKey = `bookworms.category.${categoryKey}.${sha1(pagination)}`;

    const { data, cached, error } = await cache(
        cacheKey,
        async () => {
            const [from, to] = pagination;

            const { data, error } = await $schema.rpc('match_books_by_label', {
                q: categoryKey,
                threshold: 0.3,
                from_index: from,
                to_index: to,
            });

            if (error) throw error;

            const { data: countData } = await $schema.rpc('count_books_by_label', {
                q: categoryKey,
                threshold: 0.3,
            });

            const totalCount = countData || 0;

            return {
                data,
                pagination: {
                    from,
                    to: to,
                    found: totalCount,
                    count: data?.length || 0,
                    page: Number(req.query?.page || 1),
                    pages: Math.ceil(totalCount / (to - from + 1)),
                },
            };
        },
        getNoCacheFlag(req),
    );

    res.setHeader('X-Cached', cached);

    if (error) {
        res.status(500).json({ error, message: 'Something went worng' });
    }

    return res.json(data);
});

router.get('/request', async (req, res) => {
    const filename = req.query?.filename;
    const format = req.query?.format || 'epub';

    if (!filename && !author) {
        return res.status(400).json({
            message: 'Missing filename.',
        });
    }

    const otp = totp.generate();
    const finalFilename = filename.replace(/\.epub$/i, `.${format}`);

    await ntfy.pushSimple({
        message: `requestBook::${filename}::${format}=${otp}`,
    });

    return res.json({
        message: 'Reach the validate url to see if your book is available',
        validateUrl: `/bookworms/validate?filename=${finalFilename}`,
        filename: finalFilename,
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

    const { data: bookData } = await $schema
        .from('books')
        .select('id')
        .eq('filename', filename)
        .single();

    await $schema.rpc('increment_field', {
        target_table: 'books',
        target_column: 'downloads',
        target_id: bookData.id,
    });

    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/epub+zip');
    return res.send(buffer);
});

router.get('/file', async (req, res) => {
    const filename = req.query?.filename;

    if (!filename) {
        return res.status(404).send({
            message: 'Missing filename.',
        });
    }

    const { data } = $storage.getPublicUrl(filename);

    if (!data) {
        return res.status(404).send({ message: 'Book file not found.' });
    }

    const { data: bookData } = await $schema
        .from('books')
        .select('id')
        .eq('filename', filename)
        .single();

    await $schema.rpc('increment_field', {
        target_table: 'books',
        target_column: 'downloads',
        target_id: bookData.id,
    });

    return res.json(data);
});

router.post('/sendto-kindle', async (req, res) => {
    const { email, filename } = req.body;

    if (!filename || !email) {
        return res.status(400).send({
            message: 'Invalid payload.',
        });
    }

    const { data: fileData, error: fileError } = await $storage.download(filename);

    if (!fileData || fileError) {
        console.error('Read book error:', fileError);
        return res.status(404).send();
    }

    await $storage.remove([filename]);

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const bookFilename = filename.split('/').pop();

    const { error: emailError } = await resend.emails.send({
        from: 'Bookworms <no-reply@mail.hckr.mx>',
        to: email,
        subject: 'Bookworms - ¡Tu libro está en camino a tu Kindle!',
        html: `
            <p>Has recibido un nuevo libro para tu Kindle.</p>
            <p>¡Disfruta tu lectura!, <br/>El equipo de Bookworms</p>
        `,
        attachments: [
            {
                content: buffer.toString('base64'),
                filename: bookFilename,
            },
        ],
    });

    if (emailError) {
        console.error('Error sending email:', emailError);
        return res.status(404).send();
    }

    const { data: bookData } = await $schema
        .from('books')
        .select('id')
        .eq('filename', filename.replace(/\.mobi/i, '.epub'))
        .single();

    await $schema.rpc('increment_field', {
        target_table: 'books',
        target_column: 'downloads',
        target_id: bookData.id,
    });

    res.status(200).json({ message: 'Email sent successfully.', filename, email });
});

router.get('/clear-bucket', async (req, res) => {
    await supabase.storage.emptyBucket('bookworms');
    return res.status(204).send();
});

export default router;
