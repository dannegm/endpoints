import fs from 'fs';
import path from 'path';
import Fuse from 'fuse.js';
import { Router } from 'express';

import { getPagination, normalize } from '../helpers';

const router = Router();

const loadNdjson = file =>
    fs.readFileSync(path.join(__dirname, file), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line));

const booksRaw = loadNdjson('../catalog-books.ndjson').map(([libid, title, authors_csv, , cover_id]) => ({
    libid,
    title,
    authors: authors_csv ? authors_csv.split(',') : [],
    cover_id,
}));

const authorsRaw = loadNdjson('../catalog-authors.ndjson').map(([name, books]) => ({ name, books }));
const seriesRaw = loadNdjson('../catalog-series.ndjson').map(([name, books]) => ({ name, books }));

const fuseBooks = new Fuse(booksRaw, {
    keys: [{ name: 'title', weight: 5 }, { name: 'authors', weight: 3 }],
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
        authors: authorsRaw.length,
        series: seriesRaw.length,
        books: booksRaw.length,
    });
});

router.get('/search', (req, res) => {
    const query = normalize(req.query?.q || '');
    const pagination = getPagination(req);

    if (!query) {
        return res.status(400).json({ message: 'You must provide at least a query' });
    }

    const [from, to] = pagination;

    const allBooks = fuseBooks.search(query).map(r => r.item);
    const allAuthors = fuseAuthors.search(query).map(r => r.item);
    const allSeries = fuseSeries.search(query).map(r => r.item);

    return res.json({
        authors: {
            total: allAuthors.length,
            results: allAuthors,
        },
        series: {
            total: allSeries.length,
            results: allSeries,
        },
        books: {
            from,
            to,
            page: Number(req.query?.page || 1),
            count: allBooks.slice(from, to + 1).length,
            total: allBooks.length,
            results: allBooks.slice(from, to + 1),
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
    if (!fuse) return res.status(404).json({ message: 'Invalid entity' });

    const query = normalize(req.query?.q || '');
    if (!query) return res.status(400).json({ message: 'Missing query' });

    const [from, to] = getPagination(req);
    const all = fuse.search(query).map(r => r.item);

    return res.json({
        data: all.slice(from, to + 1),
        pagination: {
            from,
            to,
            found: all.length,
            count: all.slice(from, to + 1).length,
            page: Number(req.query?.page || 1),
            pages: Math.ceil(all.length / (to - from + 1)),
        },
    });
});


export default router;
