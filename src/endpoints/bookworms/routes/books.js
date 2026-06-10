import { Router } from 'express';

import { sha1 } from '@/helpers/crypto';
import { supabase } from '@/services/supabase';

import { cache, getNoCacheFlag, getPagination, normalize } from '../utils/helpers';

const router = Router();
const $schema = supabase.schema('bookworms');

router.get('/book/:libid', async (req, res) => {
    const libid = req.params?.libid;

    if (!libid) {
        return res.status(404).json({ error: 'Book not found' });
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
        return res.status(500).json({ error: 'Something went wrong' });
    }

    if (error?.type === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Book not found' });
    }

    await $schema.rpc('increment_field', {
        target_table: 'books',
        target_column: 'views',
        target_id: data.id,
    });

    return res.json({ data });
});

router.get('/author/:authorKey', async (req, res) => {
    const authorKey = req.params?.authorKey;

    if (!authorKey) {
        return res.status(404).json({ error: 'Author not found' });
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
        return res.status(500).json({ error: 'Something went wrong' });
    }

    if (error?.type === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Author not found' });
    }

    await $schema.rpc('increment_field', {
        target_table: 'authors',
        target_column: 'views',
        target_id: data.id,
    });

    return res.json({ data });
});

router.get('/serie/:serieKey', async (req, res) => {
    const serieKey = req.params?.serieKey;

    if (!serieKey) {
        return res.status(404).json({ error: 'Serie not found' });
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
        return res.status(500).json({ error: 'Something went wrong' });
    }

    if (error?.type === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Serie not found' });
    }

    await $schema.rpc('increment_field', {
        target_table: 'series',
        target_column: 'views',
        target_id: data.id,
    });

    return res.json({ data });
});

router.get('/category/:categoryKey', async (req, res) => {
    const { categoryKey } = req.params;

    const pagination = getPagination(req);
    const cacheKey = `bookworms.category.${categoryKey}.${sha1(pagination.join(','))}`;

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
        return res.status(500).json({ error: 'Something went wrong' });
    }

    return res.json(data);
});

export default router;
