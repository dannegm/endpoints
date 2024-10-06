import { spendTokens, upsertFingerprint } from './fingerprints';

const API_KEY = process.env.DIDNTREAD__APP_KEY;

const getSourcesCost = ({ source }) => {
    const sources = {
        '/scrapper': 1,
    };

    return sources[source] || 0;
};

export const apiKeyMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-dnn-apikey'];

    if (apiKey !== API_KEY) {
        return res.status(401).json({ error: 'Invalid API Key' });
    }

    req.apiKey = apiKey;

    next();
};

export const fingerprintMiddleware = async (req, res, next) => {
    const fingerprint = req.headers['x-dnn-fingerprint'];

    if (!fingerprint) {
        return res.status(401).json({ error: 'Invalid Fingerprint' });
    }

    const [fingerprintResult, fingerprintError] = await upsertFingerprint({
        fingerprint,
    });

    if (fingerprintError) {
        return res.status(500).json({ error: fingerprintError });
    }

    req.fingerprint = fingerprintResult;

    next();
};

export const tokenMiddleware = async (req, res, next) => {
    const fingerprint = req.fingerprint;
    const tokenCost = getSourcesCost({ source: req.path });

    const [remainingTokens, tokensError] = await spendTokens({
        fingerprint: fingerprint.fingerprint,
        tokens: tokenCost,
        source: req.path,
        payload: req.body,
    });

    if (tokensError) {
        return res.status(403).json({ error: tokensError });
    }

    req.fingerprint = fingerprint;
    req.remainingTokens = remainingTokens;

    next();
};
