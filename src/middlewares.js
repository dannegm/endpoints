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

export const ratelimitMiddleware = async (req, res, next) => {
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
