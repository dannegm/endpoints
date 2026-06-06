require('dotenv').config({ path: require('path').join(__dirname, '../../../../.env') });

const { createClient } = require('@supabase/supabase-js');
const { writeFile } = require('fs/promises');
const { join } = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const $schema = supabase.schema('bookworms');

async function main() {
    console.log('Fetching libids...');

    const { data, error } = await $schema
        .from('books')
        .select('libid');

    if (error) throw error;

    const libids = data.map(r => r.libid);

    await writeFile(
        join(__dirname, 'existing-libids.json'),
        JSON.stringify(libids)
    );

    console.log(`Done. ${libids.length} libids saved.`);
}

main().catch(console.error);
