import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import ntfy from '@/services/ntfy';
import { totp } from '@/services/security';

import { state } from './state.js';
import { searcher } from './agents/searcher.js';
import { extractor } from './agents/extractor.js';
import { decider } from './agents/decider.js';
import fallbackData from './data/fallback.json';
import perimeterData from './data/perimeter.json';

const push = msg => ntfy.pushSimple({ message: msg }).catch(() => {});

const pushCommand = cmd => {
    const otp = totp.generate();
    return ntfy.pushSimple({ message: `[${otp}]${cmd}` }).catch(() => {});
};

export const runOrchestrator = async () => {
    push('🚀 [puedopasar] Iniciando refresh de datos...');

    try {
        push('🔍 [puedopasar] Agente 1: buscando fuentes oficiales...');
        const urls = await searcher();

        push(`📄 [puedopasar] Agente 2: extrayendo datos de ${urls.length} fuentes...`);
        const extracted = await extractor(urls);

        push('🧠 [puedopasar] Agente 3: tomando decisión final...');
        const currentDate = new Date().toISOString();
        const decision = await decider(extracted, fallbackData, currentDate);

        const final = { ...decision, perimeter: perimeterData };

        const statusPath = join(import.meta.dir, 'data', 'status.json');
        writeFileSync(statusPath, JSON.stringify(final, null, 2));

        push(`✅ [puedopasar] Datos actualizados. Confidence: ${final.confidence}. Fuente: ${final.source}`);

        pushCommand(`updatePuedoPasar({"dataUrl":"https://endpoints.hckr.mx/puedopasar/data"})`);

        state.lastRefresh = currentDate;
        state.lastResult = final;
    } catch (err) {
        push(`❌ [puedopasar] Error en el pipeline: ${err.message}`);
    }
};
