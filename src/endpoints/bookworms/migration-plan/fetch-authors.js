require('dotenv').config({ path: require('path').join(__dirname, '../../../../.env') });

const { createClient } = require('@supabase/supabase-js');
const { writeFile } = require('fs/promises');
const { join } = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const $schema = supabase.schema('bookworms');

async function main() {
    console.log('Fetching authors...');

    const { data, error } = await $schema
        .from('authors')
        .select('id, name');

    if (error) throw error;

    const authorMap = {};
    for (const author of data) {
        authorMap[author.name] = author.id;
    }

    await writeFile(
        join(__dirname, 'existing-authors.json'),
        JSON.stringify(authorMap)
    );

    console.log(`Done. ${data.length} authors saved.`);
}

main().catch(console.error);
