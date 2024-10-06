import { Router } from 'express';

import { apiKeyMiddleware, fingerprintMiddleware, tokenMiddleware } from './middlewares';
import {
    fetchAbstract,
    findAbstractsByFingerprint,
    linkAbstractToFingerprint,
    upsertAbstract,
} from './abstracts';

const router = Router();

router.all('/', (_, res) => {
    return res.send('OK - didntread');
});

router.get('/tokens', apiKeyMiddleware, fingerprintMiddleware, async (req, res) => {
    const fingerprint = req.fingerprint;
    return res.json(fingerprint);
});

router.get('/abstracts', apiKeyMiddleware, fingerprintMiddleware, async (req, res) => {
    const fingerprint = req.fingerprint.fingerprint;

    const [abstracts] = await findAbstractsByFingerprint({ fingerprint });
    return res.json(abstracts);
});

router.post(
    '/scrapper',
    apiKeyMiddleware,
    fingerprintMiddleware,
    tokenMiddleware,
    async (req, res) => {
        const url = req.body.url;
        const lang = req.body.lang || 'infer';

        if (!url) {
            return res.status(400).json({ message: 'Missing url' });
        }

        const [abstract, abstractError, cached] = await fetchAbstract({ lang, url });

        if (abstractError) {
            return res.status(500).json({ error: abstractError });
        }

        await upsertAbstract(abstract);
        await linkAbstractToFingerprint({
            fingerprint: req.fingerprint.fingerprint,
            hash: abstract.hash,
        });

        return res.status(200).json({
            ...abstract,
            cached,
            remainingTokens: req.remainingTokens || null,
        });
    },
);

export default router;
