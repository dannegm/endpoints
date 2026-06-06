require('dotenv').config({ path: require('path').join(__dirname, '../../../../.env') });

const { createClient } = require('@supabase/supabase-js');
const { writeFile } = require('fs/promises');
const { join } = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const $schema = supabase.schema('bookworms');

async function main() {
    console.log('Fetching series...');

    const { data, error } = await $schema
        .from('series')
        .select('id, name');

    if (error) throw error;

    const seriesMap = {};
    for (const serie of data) {
        seriesMap[serie.name] = serie.id;
    }

    await writeFile(
        join(__dirname, 'existing-series.json'),
        JSON.stringify(seriesMap)
    );

    console.log(`Done. ${data.length} series saved.`);
}

main().catch(console.error);
