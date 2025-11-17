import { Router } from 'express';
import { trim } from 'lodash';

import { urlValidator } from '@/helpers/validators';

import { tokenMiddleware, fingerprintMiddleware, withCostMiddleware } from './middlewares';
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

router.get('/tokens', tokenMiddleware, fingerprintMiddleware, async (req, res) => {
    const fingerprint = req.fingerprint;
    return res.json(fingerprint);
});

router.get('/abstracts', tokenMiddleware, fingerprintMiddleware, async (req, res) => {
    const fingerprint = req.fingerprint.fingerprint;
    const [abstracts] = await findAbstractsByFingerprint({ fingerprint });
    return res.json(abstracts);
});

router.post(
    '/scrapper',
    tokenMiddleware,
    fingerprintMiddleware,
    withCostMiddleware,
    async (req, res) => {
        const url = req.body.url;
        const sanitizedUrl = trim(url.trim(), '.');
        const lang = req.body.lang || 'infer';

        if (!urlValidator(sanitizedUrl)) {
            return res.status(400).json({ message: 'Invalid url' });
        }

        const [abstract, abstractError, cached] = await fetchAbstract({ lang, url: sanitizedUrl });

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
