const { readFile, writeFile } = require('fs/promises');
const { join } = require('path');
const { lowerCase, deburr } = require('lodash');

const normalize = str => deburr(lowerCase(str.toString()));

async function main() {
    const [indice, existingLibids, filenameToCover] = await Promise.all([
        readFile(join(__dirname, 'indice.json'), 'utf-8').then(JSON.parse),
        readFile(join(__dirname, 'existing-libids.json'), 'utf-8').then(JSON.parse),
        readFile(join(__dirname, 'filename_to_cover.json'), 'utf-8').then(JSON.parse),
    ]);

    const existingSet = new Set(existingLibids);

    let skipped = 0;
    let noCover = 0;

    const newBooks = [];

    for (const book of indice) {
        if (existingSet.has(book.libid)) {
            skipped++;
            continue;
        }

        const cover_id = filenameToCover[book.filename] ?? null;
        if (cover_id === null) noCover++;

        newBooks.push({
            libid:                  book.libid,
            title:                  book.title,
            title_normalized:       normalize(book.title),
            cover_id,
            description:            book.description    ?? null,
            labels:                 book.labels         ?? [],
            published:              book.published      ?? null,
            pagecount:              book.pagecount      ?? null,
            sha256sum:              book.sha256sum      ?? null,
            size:                   book.size           ?? null,
            filename:               book.filename,
            serie_name:             book.serie                        ?? null,
            serie_name_normalized:  book.serie ? normalize(book.serie) : null,
            serie_sequence:         book.serieseq                     ?? null,
            authors:                book.authors                      ?? [],
        });
    }

    await writeFile(
        join(__dirname, 'new-books.json'),
        JSON.stringify(newBooks)
    );

    console.log(`Total in index : ${indice.length}`);
    console.log(`Already in DB  : ${skipped}`);
    console.log(`New books      : ${newBooks.length}`);
    console.log(`Missing cover  : ${noCover}`);
}

main().catch(console.error);
