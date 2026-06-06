require('dotenv').config({ path: require('path').join(__dirname, '../../../../.env') });

const { createClient } = require('@supabase/supabase-js');
const { readFile, writeFile, appendFile, access } = require('fs/promises');
const { join } = require('path');
const { lowerCase, deburr } = require('lodash');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const $schema = supabase.schema('bookworms');

const normalize = str => deburr(lowerCase(str.toString()));

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

const FILES = {
    newBooks: join(__dirname, 'new-books.json'),
    pending:  join(__dirname, 'import-books-pending.ndjson'),
    done:     join(__dirname, 'import-books-done.ndjson'),
    authors:  join(__dirname, 'existing-authors.json'),
    series:   join(__dirname, 'existing-series.json'),
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fileExists(path) {
    try { await access(path); return true; }
    catch { return false; }
}

function classifyError(err) {
    const code = err.code || err.status;
    if (code === 429)     return 'Rate limit reached — wait a few minutes before retrying';
    if (code === '23505') return `Duplicate entry — record already exists (${err.details || ''})`;
    if (code === '23502') return `Missing required field — ${err.details || 'null value in non-nullable column'}`;
    if (code === '23503') return `Foreign key violation — referenced record not found (${err.details || ''})`;
    if (code === 'PGRST') return `PostgREST error — ${err.message}`;
    if (err.message?.includes('fetch')) return 'Network error — check your connection';
    if (err.message?.includes('timeout')) return 'Request timed out — server took too long to respond';
    return err.message || 'Unknown error';
}

// ── Pending file helpers ──────────────────────────────────────────────────────

async function ensurePending() {
    if (await fileExists(FILES.pending)) {
        console.log('Resuming from import-books-pending.ndjson...');
        return;
    }
    console.log('Generating import-books-pending.ndjson from new-books.json...');
    const books = JSON.parse(await readFile(FILES.newBooks, 'utf-8'));
    await writeFile(FILES.pending, books.map(b => JSON.stringify(b)).join('\n'));
    console.log(`${books.length} books queued.`);
}

async function readPending() {
    const content = await readFile(FILES.pending, 'utf-8');
    return content.trim().split('\n').filter(Boolean).map(JSON.parse);
}

async function writePending(books) {
    await writeFile(FILES.pending, books.map(b => JSON.stringify(b)).join('\n'));
}

// ── DB operations ─────────────────────────────────────────────────────────────

async function resolveAuthor(name, authorMap) {
    if (authorMap[name] !== undefined) return authorMap[name];

    const { data, error } = await $schema
        .from('authors')
        .insert({ name, name_normalized: normalize(name) })
        .select('id')
        .single();

    if (error) {
        if (error.code === '23505') {
            const { data: existing, error: fetchErr } = await $schema
                .from('authors')
                .select('id')
                .eq('name', name)
                .single();
            if (fetchErr) throw fetchErr;
            authorMap[name] = existing.id;
            return existing.id;
        }
        throw error;
    }

    authorMap[name] = data.id;
    return data.id;
}

async function insertBook(book) {
    const { authors, ...fields } = book;

    const { data, error } = await $schema
        .from('books')
        .insert(fields)
        .select('id')
        .single();

    if (error) {
        if (error.code === '23505') {
            const { data: existing, error: fetchErr } = await $schema
                .from('books')
                .select('id')
                .eq('libid', book.libid)
                .single();
            if (fetchErr) throw fetchErr;
            return existing.id;
        }
        throw error;
    }

    return data.id;
}

async function insertAuthorRelations(bookId, authorIds) {
    if (!authorIds.length) return;
    const rows = authorIds.map(author_id => ({ book_id: bookId, author_id }));
    const { error } = await $schema
        .from('authors_books')
        .upsert(rows, { onConflict: 'book_id,author_id', ignoreDuplicates: true });
    if (error) throw error;
}

async function resolveSerie(name, seriesMap) {
    if (seriesMap[name] !== undefined) return seriesMap[name];

    const { data, error } = await $schema
        .from('series')
        .insert({ name, name_normalized: normalize(name) })
        .select('id')
        .single();

    if (error) {
        if (error.code === '23505') {
            const { data: existing, error: fetchErr } = await $schema
                .from('series')
                .select('id')
                .eq('name', name)
                .single();
            if (fetchErr) throw fetchErr;
            seriesMap[name] = existing.id;
            return existing.id;
        }
        throw error;
    }

    seriesMap[name] = data.id;
    return data.id;
}

async function insertSerieRelation(bookId, serieId) {
    const { error } = await $schema
        .from('series_books')
        .upsert({ book_id: bookId, serie_id: serieId }, { onConflict: 'book_id,serie_id', ignoreDuplicates: true });
    if (error) throw error;
}

async function processBook(book, authorMap, seriesMap) {
    const authorIds = [];
    for (const name of book.authors) {
        const id = await resolveAuthor(name, authorMap);
        authorIds.push(id);
    }
    const bookId = await insertBook(book);
    await insertAuthorRelations(bookId, authorIds);
    if (book.serie_name) {
        const serieId = await resolveSerie(book.serie_name, seriesMap);
        await insertSerieRelation(bookId, serieId);
    }
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────

async function withRetry(label, fn) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const reason = classifyError(err);
            if (attempt === MAX_RETRIES) {
                console.error(`\n  ✗ ${label}`);
                console.error(`    Reason  : ${reason}`);
                console.error(`    Attempts: ${MAX_RETRIES}/${MAX_RETRIES} — giving up.\n`);
                throw err;
            }
            const wait = RETRY_DELAY * attempt;
            console.warn(`  ↻ ${label} — attempt ${attempt}/${MAX_RETRIES}: ${reason}. Retrying in ${wait}ms...`);
            await sleep(wait);
        }
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    await ensurePending();

    const authorMap  = JSON.parse(await readFile(FILES.authors, 'utf-8'));
    const seriesMap  = JSON.parse(await readFile(FILES.series, 'utf-8'));
    let pending = await readPending();

    const total = pending.length;
    let processed = 0;

    console.log(`\n${total} books to process.\n`);

    while (pending.length > 0) {
        const book = pending[0];

        try {
            await withRetry(`[${book.libid}] ${book.title}`, () => processBook(book, authorMap, seriesMap));
        } catch (err) {
            console.error(`  Script stopped at book ${processed + 1}/${total}.`);
            console.error(`  Fix the issue and restart — it will resume from this book.`);
            process.exit(1);
        }

        await appendFile(FILES.done, JSON.stringify(book) + '\n');
        pending = pending.slice(1);
        await writePending(pending);
        processed++;

        const pct = ((processed / total) * 100).toFixed(1);
        console.log(`[${pct}%] ${processed}/${total} — ${book.title}`);
    }

    console.log(`\nDone. ${processed} books imported.`);
}

main().catch(console.error);
