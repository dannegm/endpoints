require('dotenv').config({ path: require('path').join(__dirname, '../../../../.env') });

const { createClient } = require('@supabase/supabase-js');
const { writeFile } = require('fs/promises');
const { join } = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const $schema = supabase.schema('bookworms');

const PAGE_SIZE = 1000;

async function main() {
    console.log('Fetching libids...');

    const libids = [];
    let from = 0;

    while (true) {
        const { data, error } = await $schema
            .from('books')
            .select('libid')
            .order('id')
            .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        libids.push(...data.map(r => r.libid));
        console.log(`  Fetched ${libids.length} so far...`);

        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    await writeFile(join(__dirname, 'existing-libids.json'), JSON.stringify(libids));

    console.log(`Done. ${libids.length} libids saved.`);
}

main().catch(console.error);
