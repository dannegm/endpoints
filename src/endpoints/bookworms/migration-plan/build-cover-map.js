const { readdir, readFile, writeFile } = require('fs/promises');
const { join } = require('path');
const { runInNewContext } = require('vm');

async function main() {
    const bookinfoDir = join(__dirname, 'bookinfo');
    const files = (await readdir(bookinfoDir)).filter(f => f.endsWith('.js'));

    const filenameToCover = {};
    const coverToFilename = {};

    for (const file of files) {
        const content = await readFile(join(bookinfoDir, file), 'utf-8');
        const ctx = {};
        runInNewContext(content, ctx);

        if (!ctx.binfo) {
            console.warn(`Skipping ${file} — no binfo found`);
            continue;
        }

        for (const [coverId, data] of Object.entries(ctx.binfo)) {
            const filename = data[3] + '.epub';
            const id = Number(coverId);
            filenameToCover[filename] = id;
            coverToFilename[id] = filename;
        }

        console.log(`✓ ${file}`);
    }

    await writeFile(
        join(__dirname, 'filename_to_cover.json'),
        JSON.stringify(filenameToCover)
    );
    await writeFile(
        join(__dirname, 'cover_to_filename.json'),
        JSON.stringify(coverToFilename)
    );

    console.log(`\nDone. ${Object.keys(filenameToCover).length} covers mapped.`);
}

main().catch(console.error);
