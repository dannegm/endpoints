import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUTPUT = join(import.meta.dir, '../data/perimeter.json');

const QUERIES = [
    // Parciales — definen el borde exterior
    'Calzada Acoxpa y Avenida Las Torres, Coyoacán, Ciudad de México',
    'Periférico Sur y Circuito Azteca, Coyoacán, Ciudad de México',
    'Periférico Sur y Coscomate, Tlalpan, Ciudad de México',
    'Periférico Sur y Renato Leduc, Tlalpan, Ciudad de México',
    'Periférico Sur y Calzada de Tlalpan, Ciudad de México',
    'Calzada de Tlalpan y Viaducto Tlalpan, Ciudad de México',
    'Avenida del Imán y Gran Sur, Coyoacán, Ciudad de México',
    // Totales — interiores, amplían el hull
    'San Gabriel y Santa Úrsula, Coyoacán, Ciudad de México',
    'San Benjamín y Santa Úrsula, Coyoacán, Ciudad de México',
    'San Guillermo y Santa Úrsula, Coyoacán, Ciudad de México',
    'Santo Tomás y San Alejandro, Coyoacán, Ciudad de México',
    'San Guillermo y San Jorge, Coyoacán, Ciudad de México',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function geocode(query) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=mx&format=json&limit=1`;
    const res = await fetch(url, {
        headers: { 'User-Agent': 'puedopasar-perimeter-builder/1.0 (endpoints.hckr.mx)' },
    });
    const data = await res.json();
    if (!data.length) {
        console.warn(`  ⚠ Sin resultado: ${query}`);
        return null;
    }
    const { lat, lon, display_name } = data[0];
    console.log(`  ✓ ${query}\n    → ${display_name}`);
    return [parseFloat(lon), parseFloat(lat)];
}

// Jarvis March (gift wrapping) — devuelve los puntos del convex hull en orden
function convexHull(points) {
    const n = points.length;
    if (n < 3) return points;

    const leftmost = points.reduce((a, b) => (a[0] < b[0] ? a : b));
    const hull = [];
    let current = leftmost;

    do {
        hull.push(current);
        let next = points[0];
        for (const p of points) {
            const cross =
                (next[0] - current[0]) * (p[1] - current[1]) -
                (next[1] - current[1]) * (p[0] - current[0]);
            if (next === current || cross < 0) next = p;
        }
        current = next;
    } while (current !== leftmost);

    return hull;
}

async function main() {
    console.log('Geocodificando vialidades...\n');

    const points = [];

    for (const query of QUERIES) {
        const point = await geocode(query);
        if (point) points.push(point);
        await sleep(1100); // Nominatim: máx 1 req/s
    }

    if (points.length < 3) {
        console.error(`\n✗ Solo se obtuvieron ${points.length} puntos, necesito al menos 3.`);
        process.exit(1);
    }

    console.log(`\nCalculando convex hull sobre ${points.length} puntos...`);
    const hull = convexHull(points);
    hull.push(hull[0]); // cerrar el polígono

    const lats = hull.map(p => p[1]);
    const lngs = hull.map(p => p[0]);
    const center = {
        lat: (Math.min(...lats) + Math.max(...lats)) / 2,
        lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    };

    // Radio aproximado: distancia máxima del centroide a cualquier vértice del hull
    const toKm = ([lng, lat]) => {
        const dlat = (lat - center.lat) * 111.32;
        const dlng = (lng - center.lng) * 111.32 * Math.cos((center.lat * Math.PI) / 180);
        return Math.sqrt(dlat ** 2 + dlng ** 2);
    };
    const radiusKm = Math.max(...hull.map(toKm));

    const geojson = {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [hull],
        },
        properties: {
            radiusKm: Math.round(radiusKm * 100) / 100,
            center,
        },
    };

    writeFileSync(OUTPUT, JSON.stringify(geojson, null, 2));
    console.log(`\n✅ perimeter.json generado con ${hull.length - 1} vértices (radio ~${geojson.properties.radiusKm} km)`);
}

main();
