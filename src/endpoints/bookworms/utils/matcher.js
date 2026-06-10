import fs from 'fs';
import path from 'path';
import Fuse from 'fuse.js';

const catalogBooksPath = path.join(__dirname, '../data/catalog-books.ndjson');
const lines = fs.readFileSync(catalogBooksPath, 'utf8').split('\n').filter(Boolean);
const catalog = lines.map(line => {
    const [libid, title, authors_csv, published, cover_id] = JSON.parse(line);
    return { libid, title, authors: authors_csv.split(','), published, cover_id };
});

const fuse = new Fuse(catalog, {
    keys: [
        { name: 'title', weight: 5 },
        { name: 'authors', weight: 3 },
        { name: 'published', weight: 1 },
    ],
    threshold: 0.3,
    includeScore: true,
});

export function matchBook({ title, authors = [], published = null }) {
    console.time(`matcher:${title}`);
    const matches = fuse.search(title);
    console.timeEnd(`matcher:${title}`);

    if (!matches.length) return null;

    const scored = matches.map(({ item, score }) => {
        let bonus = 0;
        if (item.title.toLowerCase() === title.toLowerCase()) bonus += 3;
        if (authors.length) {
            const inputAuthors = authors.map(a => a.toLowerCase());
            const catalogAuthors = item.authors.map(a => a.toLowerCase());
            const authorMatch = inputAuthors.some(a =>
                catalogAuthors.some(c => c.includes(a) || a.includes(c)),
            );
            if (authorMatch) bonus += 2;
        }
        if (published && item.published === published) bonus += 1;
        return { item, score, bonus };
    });
    scored.sort((a, b) => b.bonus - a.bonus || a.score - b.score);

    const best = authors.length ? scored.find(r => r.bonus >= 2) : scored[0];

    if (!best) return null;

    const { item, score, bonus } = best;
    return {
        libid: item.libid,
        cover_id: item.cover_id,
        title: item.title,
        authors: item.authors,
        published: item.published,
        score: Number(score.toFixed(4)),
        bonus,
    };
}

export function matchBooks(books) {
    console.time('matcher:batch');
    const results = books.map(book => matchBook(book));
    console.timeEnd('matcher:batch');
    return results;
}
