import { Router } from 'express';

import { sha1 } from '@/helpers/crypto';
import { supabase } from '@/services/supabase';

import { cache, getNoCacheFlag, getPagination, normalize } from '../helpers';

const router = Router();
const $schema = supabase.schema('bookworms');

router.get('/summaries', async (req, res) => {
    const cacheKey = `bookworms.summaries`;
    const { data, cached, error } = await cache(
        cacheKey,
        async () => {
            const { data: authorsData } = await $schema.from('authors').select(`count`);
            const { data: seriesData } = await $schema.from('series').select(`count`);
            const { data: booksData } = await $schema.from('books').select('count');

            return {
                authors: authorsData?.[0]?.count || 0,
                series: seriesData?.[0]?.count || 0,
                books: booksData?.[0]?.count || 0,
            };
        },
        getNoCacheFlag(req),
    );

    res.setHeader('X-Cached', cached);

    if (error) {
        console.error(error);
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

    const cacheKey = `bookworms.search.${sha1(query + pagination.join(','))}`;
    const { data, cached, error } = await cache(
        cacheKey,
        async () => {
            const { data: authorsData } = await $schema
                .from('authors')
                .select(`name, views, books(count)`)
                .order('id', { ascending: false })
                .ilike('name_normalized', `%${query}%`);

            const { data: seriesData } = await $schema
                .from('series')
                .select(`name, views, books(count)`)
                .order('id', { ascending: false })
                .ilike('name_normalized', `%${query}%`);

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
    const cacheKey = `bookworms.search.${sha1(entity + query + pagination.join(','))}`;

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

export default router;
