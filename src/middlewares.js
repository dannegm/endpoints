import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getClientIp } from './helpers/http';
import { sha1 } from './helpers/crypto';
import { logger } from './services/logger';

const RATELIMIT_TOKENS = 100;
const RATELIMIT_WINDOW = '60 s';
const RATELIMIT_PREFIX = 'ratelimit::endpoints';

const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(RATELIMIT_TOKENS, RATELIMIT_WINDOW),
    prefix: RATELIMIT_PREFIX,
});

const rateLimitWhitelist = [
    // ...
    '/quotes',
];

export const ratelimitMiddleware = async (req, res, next) => {
    if (rateLimitWhitelist.some(prefix => req.path.startsWith(prefix))) {
        return next();
    }

    const rawIP = getClientIp(req);
    const identifier = sha1(`${rawIP}::${req.path}`);

    try {
        const { success } = await ratelimit.limit(identifier);

        if (!success) {
            return res.status(429).json({
                message: 'Too Many Requests',
                details: 'You have exceeded the limit of requests for this endpoint',
            });
        }

        return next();
    } catch (error) {
        logger.error(`Rate limit error: ${error}`);
        return res.status(503).json({
            message: 'Service Unavailable',
            details: 'Rate limit service is temporarily unavailable',
        });
    }
};

export const withQueryParams = (schema, errorHandler = null) => {
    return (req, res, next) => {
        const errors = [];
        const queryParams = req.query;

        for (const key in schema) {
            const { type, default: defaultValue, required } = schema[key];
            let value = queryParams[key];

            if (value === undefined) {
                if (required) {
                    errors.push(`${key} is required`);
                } else {
                    value = typeof defaultValue !== 'function' ? defaultValue : defaultValue(req);
                }
            } else {
                if (type === Array) {
                    if (typeof value === 'string') {
                        value = value.split(',').map(item => item.trim());
                    } else {
                        errors.push(`${key} must be a comma-separated list of values`);
                    }
                } else {
                    try {
                        if (type === Number) value = Number(value);
                        else if (type === Boolean) value = /^(true|1|on)$/i.test(value);
                        else if (type === String) value = String(value);
                    } catch (error) {
                        errors.push(`${key} must be of type ${type.name}`);
                    }
                }
            }

            queryParams[key] = value;
        }

        if (errors.length) {
            if (errorHandler) {
                errorHandler(res, errors);
            } else {
                res.status(400).json({ errors });
            }
        } else {
            next();
        }
    };
};
