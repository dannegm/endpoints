import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Router } from 'express';

import { withApiKey } from '@/helpers/middlewares';

import { state, canRefresh } from './state.js';
import { runOrchestrator } from './orchestrator.js';
import fallbackData from './data/fallback.json';
import perimeterData from './data/perimeter.json';

const router = Router();

router.use(withApiKey(process.env.APP_KEY));

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
    if (!canRefresh()) {
        return res.json({ ok: true, skipped: true, lastChecked: state.lastRefresh });
    }

    runOrchestrator();
    return res.json({ ok: true, started: true });
});

export default router;
