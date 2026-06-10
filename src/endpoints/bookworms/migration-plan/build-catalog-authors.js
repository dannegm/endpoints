const { readFile, writeFile } = require('fs/promises');
const { join } = require('path');

async function main() {
    const indice = await readFile(join(__dirname, 'indice.json'), 'utf-8').then(JSON.parse);

    const authorsMap = new Map();
    for (const book of indice) {
        for (const author of (book.authors ?? [])) {
            authorsMap.set(author, (authorsMap.get(author) ?? 0) + 1);
        }
    }

    const lines = [...authorsMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, count]) => JSON.stringify([name, count]));

    await writeFile(join(__dirname, '../catalog-authors.ndjson'), lines.join('\n'));

    console.log(`Done. ${lines.length} authors written to catalog-authors.ndjson`);
}

main().catch(console.error);
