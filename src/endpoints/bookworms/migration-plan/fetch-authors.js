require('dotenv').config({ path: require('path').join(__dirname, '../../../../.env') });

const { createClient } = require('@supabase/supabase-js');
const { writeFile } = require('fs/promises');
const { join } = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const $schema = supabase.schema('bookworms');

const PAGE_SIZE = 1000;

async function main() {
    console.log('Fetching authors...');

    const authorMap = {};
    let from = 0;

    while (true) {
        const { data, error } = await $schema
            .from('authors')
            .select('id, name')
            .order('id')
            .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        for (const author of data) {
            authorMap[author.name] = author.id;
        }

        console.log(`  Fetched ${Object.keys(authorMap).length} so far...`);

        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    await writeFile(join(__dirname, 'existing-authors.json'), JSON.stringify(authorMap));

    console.log(`Done. ${Object.keys(authorMap).length} authors saved.`);
}

main().catch(console.error);
