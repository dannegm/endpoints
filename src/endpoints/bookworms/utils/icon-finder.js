import fs from 'fs';
import path from 'path';
import Fuse from 'fuse.js';

const csvPath = path.join(__dirname, '../lucide-lab-icons.csv');
const lines = fs.readFileSync(csvPath, 'utf8').split('\n').slice(1).filter(Boolean);

const icons = lines.map(line => {
    const i1 = line.indexOf(',');
    const i2 = line.indexOf(',', i1 + 1);
    const name = line.substring(0, i1);
    const tags = line.substring(i1 + 1, i2).split('|');
    const categories = line.substring(i2 + 1).split('|');
    return { name, tags, categories };
});

const fuse = new Fuse(icons, {
    keys: [
        { name: 'tags', weight: 3 },
        { name: 'categories', weight: 1 },
    ],
    threshold: 0.3,
    includeScore: true,
});

export function findIcon(hint) {
    const results = fuse.search(hint);
    const candidates = results.filter(r => r.score < 0.3);

    if (!candidates.length) return null;

    const { item } = candidates[Math.floor(Math.random() * candidates.length)];
    return { library: 'lucide-lab', name: item.name };
}
