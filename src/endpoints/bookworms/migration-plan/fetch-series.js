require('dotenv').config({ path: require('path').join(__dirname, '../../../../.env') });

const { createClient } = require('@supabase/supabase-js');
const { writeFile } = require('fs/promises');
const { join } = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const $schema = supabase.schema('bookworms');

const PAGE_SIZE = 1000;

async function main() {
    console.log('Fetching series...');

    const seriesMap = {};
    let from = 0;

    while (true) {
        const { data, error } = await $schema
            .from('series')
            .select('id, name')
            .order('id')
            .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        for (const serie of data) {
            seriesMap[serie.name] = serie.id;
        }

        console.log(`  Fetched ${Object.keys(seriesMap).length} so far...`);

        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    await writeFile(
        join(__dirname, 'existing-series.json'),
        JSON.stringify(seriesMap)
    );

    console.log(`Done. ${Object.keys(seriesMap).length} series saved.`);
}

main().catch(console.error);
