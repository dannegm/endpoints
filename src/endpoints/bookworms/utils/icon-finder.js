import fs from 'fs';
import path from 'path';
import Fuse from 'fuse.js';

const csvPath = path.join(__dirname, '../icons.csv');
const lines = fs.readFileSync(csvPath, 'utf8').split('\n').slice(1).filter(Boolean);

const icons = lines.map(line => {
    const i1 = line.indexOf(',');
    const i2 = line.indexOf(',', i1 + 1);
    const library = line.substring(0, i1);
    const name = line.substring(i1 + 1, i2);
    const tags = line.substring(i2 + 1).split('|');
    return { library, name, tags };
});

const fuse = new Fuse(icons, {
    keys: [{ name: 'tags', weight: 1 }],
    threshold: 0.5,
    includeScore: true,
});

export function findIcon(hint) {
    const words = hint.toLowerCase().split(/\s+/).filter(Boolean);

    const bestScore = new Map();
    const itemMap = new Map();

    for (const word of words) {
        const results = fuse.search(word);
        for (const r of results) {
            if (r.score < 0.4) {
                const current = bestScore.get(r.item.name) ?? Infinity;
                if (r.score < current) {
                    bestScore.set(r.item.name, r.score);
                    itemMap.set(r.item.name, r.item);
                }
            }
        }
    }

    if (!bestScore.size) return null;

    const [bestName] = [...bestScore.entries()].sort((a, b) => a[1] - b[1])[0];
    const { library, name } = itemMap.get(bestName);
    return { library, name };
}
