import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Router } from 'express';

import { state, canRefresh } from './state.js';
import { runOrchestrator } from './orchestrator.js';
import fallbackData from './data/fallback.json';
import perimeterData from './data/perimeter.json';

const PUEDOPASAR_SECRET = process.env.APP_KEY;

const router = Router();

router.get('/data', (req, res) => {
    try {
        const raw = readFileSync(join(import.meta.dir, 'data', 'status.json'), 'utf-8');
        return res.json(JSON.parse(raw));
    } catch {
        return res.json({
            ...fallbackData,
            today: fallbackData.dates.some(d => d.date === new Date().toISOString().slice(0, 10)),
            perimeter: perimeterData,
            lastChecked: null,
            source: 'https://ssc.cdmx.gob.mx',
            confidence: 'low',
            fallback: true,
        });
    }
});

router.post('/refresh', (req, res) => {
    const key = req.headers['x-puedopasar-key'];

    if (key !== PUEDOPASAR_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!canRefresh()) {
        return res.json({ ok: true, skipped: true, lastChecked: state.lastRefresh });
    }

    runOrchestrator();
    return res.json({ ok: true, started: true });
});

export default router;
