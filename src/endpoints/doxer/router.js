import { Router } from 'express';
import { withApiKey } from '@/helpers/middlewares';

const router = Router();

router.use(withApiKey(process.env.APP_KEY || ''));

router.all('/', (req, res) => {
    return res.send('OK - doxer');
});

router.all('/client', (req, res) => {
    const data = req.clientData || {};
    return res.send(data);
});

router.all('/info', (req, res) => {
    const { ip } = req.clientData || {};
    return res.send({
        ip,
        method: req.method,
        path: req.originalUrl,
        protocol: req.protocol,
        hostname: req.hostname,
        headers: req.headers,
        cookies: req.cookies,
        query: req.query,
        params: req.params,
        body: req.body,
    });
});

router.all('/headers', (req, res) => {
    const data = req.headers || {};
    return res.send({
        request: req.headers,
        response: res.getHeaders(),
    });
});

router.all('/body', (req, res) => {
    const data = req.body || {};
    return res.send(data);
});

router.all('/query', (req, res) => {
    const data = req.query || {};
    return res.send(data);
});

router.all('/params*', (req, res) => {
    return res.send({ path: req.params?.[0] || '<root>' });
});

router.all('/method', (req, res) => {
    const method = req.method || {};
    return res.send({ method });
});

router.all('/status/:code?', (req, res) => {
    const code = req.params?.code || 200;
    return res.status(Number(code)).send({ status: Number(code) });
});

router.all('/cookies', (req, res) => {
    const data = req.cookies || {};
    return res.status(200).send(data);
});

router.all('/time', (req, res) => {
    const now = new Date();
    return res.send({
        utc: now.toISOString(),
        timestamp: now.getTime(),
        offset: now.getTimezoneOffset(),
    });
});

// * Env Logic

const SENSITIVE_KEY_PATTERNS = [
    /KEY/i,
    /SECRET/i,
    /TOKEN/i,
    /PASSWORD/i,
    /DB_/i,
    /^AWS_/i,
    /PRIVATE/i,
    /JWT/i,
    /CREDENTIAL/i,
    /ENCRYPT/i,
    /TOPIC/i,
];

const SYSTEM_DIR_PREFIXES = [
    '/root',
    '/home',
    '/Users/danielgarcia',
    '/Users/dannegm',
    '/Users/dnn',
    '/Users/home',
    '/Users',
    '/usr',
    '/var',
    '/etc',
    '/bin',
    '/sbin',
    '/opt',
    '/mnt',
    '/media',
    '/dev',
    '/proc',
    '/sys',
    '/home',
    'C:\\Windows',
    'C:\\Program Files',
    'C:\\Users',
];

const truncateIfLong = (s, max = 80, head = 38) => {
    if (s.length <= max) return s;
    const tail = max - head - 5;
    return `${s.slice(0, head)}[...]${s.slice(-tail)}`;
};

const maskSecret = s => {
    if (!s) return s;
    const str = String(s);
    if (str.length <= 8) return '****';
    const middle = str.slice(4, -4).replace(/./g, '*');
    return truncateIfLong(`${str.slice(0, 4)}${middle}${str.slice(-4)}`);
};

const maskPathsAndTruncate = raw => {
    if (raw == null) return raw;
    let value = String(raw);

    const projectRoot = process.cwd();

    // Replace project root absolute paths with <PROJECT_ROOT>
    try {
        // escape special chars for RegExp
        const escRoot = projectRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reRoot = new RegExp(escRoot, 'g');
        value = value.replace(reRoot, '<PROJECT_ROOT>');
    } catch (e) {
        // ignore regexp errors
    }

    // Replace common system dir prefixes with <SYSTEM_PATH>
    for (const prefix of SYSTEM_DIR_PREFIXES) {
        const normalized = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(normalized, 'gi');
        value = value.replace(re, '<SYSTEM_PATH>');
    }

    // Final truncate
    return truncateIfLong(value);
};

const processEnvValue = (key, val) => {
    if (val == null) return val;

    // If key looks sensitive -> mask heavily
    if (SENSITIVE_KEY_PATTERNS.some(re => re.test(key))) {
        return maskSecret(val);
    }

    // For non-string types, stringify
    if (typeof val !== 'string') {
        try {
            val = JSON.stringify(val);
        } catch (e) {
            val = String(val);
        }
    }

    // Mask or truncate paths, system dirs, long strings
    return maskPathsAndTruncate(val);
};

router.all('/env', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).send({ error: 'Not found' });
    }

    const out = {};
    for (const key of Object.keys(process.env)) {
        out[key] = processEnvValue(key, process.env[key]);
    }

    return res.status(200).send(out);
});

export default router;
