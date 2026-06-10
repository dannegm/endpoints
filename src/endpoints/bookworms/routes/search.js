import fs from 'fs';
import path from 'path';
import Fuse from 'fuse.js';
import { Router } from 'express';

import { getPagination, normalize } from '../utils/helpers';

const router = Router();

const loadNdjson = file =>
    fs
        .readFileSync(path.join(__dirname, file), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line));

const booksRaw = loadNdjson('../data/catalog-books.ndjson').map(
    ([libid, title, authors_csv, , cover_id]) => ({
        libid,
        title,
        authors: authors_csv ? authors_csv.split(',') : [],
        cover_id,
    }),
);

const authorsRaw = loadNdjson('../data/catalog-authors.ndjson').map(([name, books]) => ({
    name,
    books,
}));
const seriesRaw = loadNdjson('../data/catalog-series.ndjson').map(([name, books]) => ({
    name,
    books,
}));

const mapperByEntity = {
    books: item => ({
        ...item,
        authors: item.authors.map(name => ({ name })),
    }),
    author: item => item,
    serie: item => item,
};

const fuseBooks = new Fuse(booksRaw, {
    keys: [
        { name: 'title', weight: 5 },
        { name: 'authors', weight: 3 },
    ],
    threshold: 0.3,
});

const fuseAuthors = new Fuse(authorsRaw, {
    keys: ['name'],
    threshold: 0.3,
});

const fuseSeries = new Fuse(seriesRaw, {
    keys: ['name'],
    threshold: 0.3,
});

router.get('/summaries', (req, res) => {
    return res.json({
        data: {
            authors: authorsRaw.length,
            series: seriesRaw.length,
            books: booksRaw.length,
        },
    });
});

const sample = (arr, n) => {
    const result = [];
    const taken = new Set();
    while (result.length < n) {
        const i = Math.floor(Math.random() * arr.length);
        if (!taken.has(i)) {
            taken.add(i);
            result.push(arr[i]);
        }
    }
    return result;
};

router.get('/search/suggestions', (req, res) => {
    const suggestions = [
        ...sample(booksRaw, 3).map(b => ({ entity: 'book', query: b.title })),
        ...sample(authorsRaw, 3).map(a => ({ entity: 'author', query: a.name })),
        ...sample(seriesRaw, 3).map(s => ({ entity: 'serie', query: s.name })),
    ].sort(() => Math.random() - 0.5);

    return res.json({ data: suggestions });
});

router.get('/search', (req, res) => {
    const query = normalize(req.query?.q || '');
    const pagination = getPagination(req);

    if (!query) {
        return res.status(400).json({ error: 'You must provide at least a query' });
    }

    const [from, to] = pagination;

    const allBooks = fuseBooks.search(query).map(r => mapperByEntity.books(r.item));
    const allAuthors = fuseAuthors.search(query).map(r => mapperByEntity.author(r.item));
    const allSeries = fuseSeries.search(query).map(r => mapperByEntity.serie(r.item));

    return res.json({
        data: {
            authors: {
                found: allAuthors.length,
                data: allAuthors,
            },
            series: {
                found: allSeries.length,
                data: allSeries,
            },
            books: {
                from,
                to,
                found: allBooks.length,
                count: allBooks.slice(from - 1, to).length,
                page: Number(req.query?.page || 1),
                pages: Math.ceil(allBooks.length / (to - from + 1)),
                data: allBooks.slice(from - 1, to),
            },
        },
    });
});

const fuseByEntity = {
    books: fuseBooks,
    author: fuseAuthors,
    serie: fuseSeries,
};

router.get('/search/:entity', (req, res) => {
    const { entity } = req.params;
    const fuse = fuseByEntity[entity];
    if (!fuse) return res.status(404).json({ error: 'Invalid entity' });

    const query = normalize(req.query?.q || '');
    if (!query) return res.status(400).json({ error: 'Missing query' });

    const [from, to] = getPagination(req);
    const mapper = mapperByEntity[entity] || (item => item);
    const all = fuse.search(query).map(r => mapper(r.item));

    return res.json({
        data: all.slice(from - 1, to),
        pagination: {
            from,
            to,
            found: all.length,
            count: all.slice(from - 1, to).length,
            page: Number(req.query?.page || 1),
            pages: Math.ceil(all.length / (to - from + 1)),
        },
    });
});

export default router;
