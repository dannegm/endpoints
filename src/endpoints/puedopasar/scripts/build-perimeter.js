import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUTPUT = join(import.meta.dir, '../data/perimeter.json');
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!API_KEY) {
    console.error('✗ GOOGLE_MAPS_API_KEY no configurada');
    process.exit(1);
}

const QUERIES = [
    // Parciales — definen el borde exterior
    'Calzada Acoxpa & Avenida Las Torres, Coyoacán, Ciudad de México',
    'Anillo Periférico & Circuito Azteca, Coyoacán, Ciudad de México',
    'Anillo Periférico & Coscomate, Tlalpan, Ciudad de México',
    'Anillo Periférico & Renato Leduc, Tlalpan, Ciudad de México',
    'Anillo Periférico & Calzada de Tlalpan, Ciudad de México',
    'Calzada de Tlalpan & Viaducto Tlalpan, Ciudad de México',
    'Avenida del Imán & Gran Sur, Coyoacán, Ciudad de México',
    // Totales — interiores, amplían el hull
    'San Gabriel & Santa Úrsula, Coyoacán, Ciudad de México',
    'San Benjamín & Santa Úrsula, Coyoacán, Ciudad de México',
    // agregados (faltaban)
    'San Cástulo & Santa Úrsula, Coyoacán, Ciudad de México',
    'San Celso & Santa Úrsula, Coyoacán, Ciudad de México',
    'San León & Santa Úrsula, Coyoacán, Ciudad de México',
    'San Guillermo & Santa Úrsula, Coyoacán, Ciudad de México',
    'San Guillermo & San Alejandro, Coyoacán, Ciudad de México',
    'San Guillermo & San Jorge, Coyoacán, Ciudad de México',
    'Santo Tomás & San Alejandro, Coyoacán, Ciudad de México',
    'Santo Tomás & San Jorge, Coyoacán, Ciudad de México',
];

// Bounding box ~3km alrededor del estadio para descartar resultados erróneos
const BOUNDS = { minLat: 19.276, maxLat: 19.33, minLng: -99.179, maxLng: -99.123 };
const inBounds = ([lng, lat]) =>
    lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng;

async function geocode(address) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results.length) {
        console.warn(`  ⚠ Sin resultado (${data.status}): ${address}`);
        return null;
    }

    const { lat, lng } = data.results[0].geometry.location;
    const point = [lng, lat];

    if (!inBounds(point)) {
        console.warn(
            `  ⚠ Fuera del área esperada, descartado: ${data.results[0].formatted_address}`,
        );
        return null;
    }

    console.log(`  ✓ ${address}\n    → ${data.results[0].formatted_address}`);
    return point;
}

// Jarvis March (gift wrapping)
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
    console.log('Geocodificando vialidades con Google Maps...\n');

    const points = [];

    for (const query of QUERIES) {
        const point = await geocode(query);
        if (point) points.push(point);
    }

    console.log(`\n${points.length}/${QUERIES.length} puntos obtenidos`);

    if (points.length < 3) {
        console.error('✗ No hay suficientes puntos para calcular el hull.');
        process.exit(1);
    }

    const hull = convexHull(points);
    hull.push(hull[0]); // cerrar el polígono

    const lats = hull.map(p => p[1]);
    const lngs = hull.map(p => p[0]);
    const center = {
        lat: (Math.min(...lats) + Math.max(...lats)) / 2,
        lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    };

    const toKm = ([lng, lat]) => {
        const dlat = (lat - center.lat) * 111.32;
        const dlng = (lng - center.lng) * 111.32 * Math.cos((center.lat * Math.PI) / 180);
        return Math.sqrt(dlat ** 2 + dlng ** 2);
    };
    const radiusKm = Math.round(Math.max(...hull.map(toKm)) * 100) / 100;

    const geojson = {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [hull],
        },
        properties: {
            radiusKm,
            center,
        },
    };

    writeFileSync(OUTPUT, JSON.stringify(geojson, null, 2));
    console.log(
        `\n✅ perimeter.json generado — ${hull.length - 1} vértices, radio ~${radiusKm} km`,
    );
}

main();
