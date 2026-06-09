const { readFile, writeFile } = require('fs/promises');
const { join } = require('path');

async function main() {
    const [indice, existingLibids, filenameToCover] = await Promise.all([
        readFile(join(__dirname, 'indice.json'), 'utf-8').then(JSON.parse),
        readFile(join(__dirname, 'existing-libids.json'), 'utf-8').then(JSON.parse),
        readFile(join(__dirname, 'filename_to_cover.json'), 'utf-8').then(JSON.parse),
    ]);

    const existingSet = new Set(existingLibids);

    let nocover = 0;

    const updates = [];

    for (const book of indice) {
        if (!existingSet.has(book.libid)) continue;

        const cover_id = filenameToCover[book.filename] ?? null;
        if (cover_id === null) {
            nocover++;
            continue;
        }

        updates.push({ libid: book.libid, cover_id });
    }

    await writeFile(join(__dirname, 'cover-updates.json'), JSON.stringify(updates));

    console.log(`Existing books   : ${existingSet.size}`);
    console.log(`Updates ready    : ${updates.length}`);
    console.log(`Missing cover    : ${nocover}`);
}

main().catch(console.error);
