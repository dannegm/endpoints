const { readFile, writeFile } = require('fs/promises');
const { join } = require('path');

async function main() {
    const [indice, filenameToCover] = await Promise.all([
        readFile(join(__dirname, 'indice.json'), 'utf-8').then(JSON.parse),
        readFile(join(__dirname, 'filename_to_cover.json'), 'utf-8').then(JSON.parse),
    ]);

    const lines = indice.map(book => {
        const cover_id = filenameToCover[book.filename] ?? null;
        const authors  = (book.authors ?? []).join(',');
        return JSON.stringify([book.libid, book.title, authors, book.published ?? null, cover_id]);
    });

    await writeFile(
        join(__dirname, 'catalog-books.ndjson'),
        lines.join('\n')
    );

    console.log(`Done. ${lines.length} entries written to catalog-books.ndjson`);
}

main().catch(console.error);
