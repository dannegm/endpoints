const { readFile, writeFile } = require('fs/promises');
const { join } = require('path');

async function main() {
    const indice = await readFile(join(__dirname, 'indice.json'), 'utf-8').then(JSON.parse);

    const seriesMap = new Map();
    for (const book of indice) {
        if (!book.serie) continue;
        seriesMap.set(book.serie, (seriesMap.get(book.serie) ?? 0) + 1);
    }

    const lines = [...seriesMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, count]) => JSON.stringify([name, count]));

    await writeFile(join(__dirname, '../data/catalog-series.ndjson'), lines.join('\n'));

    console.log(`Done. ${lines.length} series written to catalog-series.ndjson`);
}

main().catch(console.error);
