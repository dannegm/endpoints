require('dotenv').config({ path: require('path').join(__dirname, '../../../../.env') });

const { createClient } = require('@supabase/supabase-js');
const { readFile, writeFile, appendFile, access } = require('fs/promises');
const { join } = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const $schema = supabase.schema('bookworms');

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

const FILES = {
    coverUpdates: join(__dirname, 'cover-updates.json'),
    pending: join(__dirname, 'update-covers-pending.ndjson'),
    done: join(__dirname, 'update-covers-done.ndjson'),
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fileExists(path) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

function classifyError(err) {
    const code = err.code || err.status;
    if (code === 429) return 'Rate limit reached — wait a few minutes before retrying';
    if (code === '23505') return `Duplicate entry — record already exists (${err.details || ''})`;
    if (code === '23502')
        return `Missing required field — ${err.details || 'null value in non-nullable column'}`;
    if (code === '23503')
        return `Foreign key violation — referenced record not found (${err.details || ''})`;
    if (code === 'PGRST') return `PostgREST error — ${err.message}`;
    if (err.message?.includes('fetch')) return 'Network error — check your connection';
    if (err.message?.includes('timeout'))
        return 'Request timed out — server took too long to respond';
    return err.message || 'Unknown error';
}

// ── Pending file helpers ──────────────────────────────────────────────────────

async function ensurePending() {
    if (await fileExists(FILES.pending)) {
        console.log('Resuming from update-covers-pending.ndjson...');
        return;
    }
    console.log('Generating update-covers-pending.ndjson from cover-updates.json...');
    const updates = JSON.parse(await readFile(FILES.coverUpdates, 'utf-8'));
    await writeFile(FILES.pending, updates.map(u => JSON.stringify(u)).join('\n'));
    console.log(`${updates.length} covers queued.`);
}

async function readPending() {
    const content = await readFile(FILES.pending, 'utf-8');
    return content.trim().split('\n').filter(Boolean).map(JSON.parse);
}

async function writePending(items) {
    await writeFile(FILES.pending, items.map(u => JSON.stringify(u)).join('\n'));
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
            console.warn(
                `  ↻ ${label} — attempt ${attempt}/${MAX_RETRIES}: ${reason}. Retrying in ${wait}ms...`,
            );
            await sleep(wait);
        }
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    await ensurePending();

    let pending = await readPending();
    const total = pending.length;
    let processed = 0;

    console.log(`\n${total} covers to update.\n`);

    while (pending.length > 0) {
        const item = pending[0];
        const label = `libid ${item.libid} → cover_id ${item.cover_id}`;

        try {
            await withRetry(label, async () => {
                const { error } = await $schema
                    .from('books')
                    .update({ cover_id: item.cover_id })
                    .eq('libid', item.libid);
                if (error) throw error;
            });
        } catch (err) {
            console.error(`  Script stopped at record ${processed + 1}/${total}.`);
            console.error(`  Fix the issue and restart — it will resume from this record.`);
            process.exit(1);
        }

        await appendFile(FILES.done, JSON.stringify(item) + '\n');
        pending = pending.slice(1);
        await writePending(pending);
        processed++;

        const pct = ((processed / total) * 100).toFixed(1);
        console.log(`[${pct}%] ${processed}/${total} — libid ${item.libid}`);
    }

    console.log(`\nDone. ${processed} covers updated.`);
}

main().catch(console.error);
