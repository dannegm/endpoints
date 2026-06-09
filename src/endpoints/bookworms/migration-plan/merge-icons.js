const fs = require('fs');
const path = require('path');

const LAB_CSV = path.join(__dirname, '../lucide-lab-icons.csv');
const LUCIDE_CSV = path.join(__dirname, '../lucide-icons.csv');
const OUTPUT = path.join(__dirname, '../icons.csv');

const lines = ['library,name,tags'];

// lucide-lab: name,tags,categories → merge tags + categories
const labLines = fs.readFileSync(LAB_CSV, 'utf8').split('\n').slice(1).filter(Boolean);
for (const line of labLines) {
    const i1 = line.indexOf(',');
    const i2 = line.indexOf(',', i1 + 1);
    const name = line.substring(0, i1);
    const tags = line.substring(i1 + 1, i2);
    const categories = line.substring(i2 + 1);
    const merged = [tags, categories].filter(Boolean).join('|');
    lines.push(`lucide-lab,${name},${merged}`);
}

// lucide: name,tags
const lucideLines = fs.readFileSync(LUCIDE_CSV, 'utf8').split('\n').slice(1).filter(Boolean);
for (const line of lucideLines) {
    const i1 = line.indexOf(',');
    const name = line.substring(0, i1);
    const tags = line.substring(i1 + 1);
    lines.push(`lucide,${name},${tags}`);
}

fs.writeFileSync(OUTPUT, lines.join('\n'));
console.log(`Done. ${lines.length - 1} icons written to icons.csv`);
