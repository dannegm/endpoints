const https = require('https');
const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, '../lucide-icons.csv');

function get(url, cb) {
    https
        .get(url, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirect = res.headers.location.startsWith('http')
                    ? res.headers.location
                    : `https://unpkg.com${res.headers.location}`;
                return get(redirect, cb);
            }
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => cb(data));
        })
        .on('error', err => {
            console.error('Error fetching:', err.message);
            process.exit(1);
        });
}

get('https://unpkg.com/lucide-static@latest/tags.json', data => {
    const tags = JSON.parse(data);
    const lines = ['name,tags'];
    for (const [name, tagList] of Object.entries(tags)) {
        lines.push(`${name},${tagList.join('|')}`);
    }
    fs.writeFileSync(OUTPUT, lines.join('\n'));
    console.log(`Done. ${lines.length - 1} icons written to lucide-icons.csv`);
});
