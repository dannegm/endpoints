import { Redis } from '@upstash/redis';
import { trim, lowerCase, deburr } from 'lodash';

import { pipe } from '@/helpers/utils';
import { isTruthy } from '@/helpers/booleans';

const redis = Redis.fromEnv();
const DEBUG = process.env.DEBUG === 'true';
const CACHE_TTL_SECONDS = 24 * 60 * 60;

const toString = str => str.toString();
export const normalize = pipe([toString, trim, lowerCase, deburr]);

export const getPagination = (req, size = 10) => {
    const page = Number(req.query?.page || 1);
    const limit = Number(req.query?.limit || size);
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    return [from + 1, to + 1];
};

export const getNoCacheFlag = req => {
    const params = new URLSearchParams(req.url.split('?')[1]);
    return (
        params.has('nocache') && (params.get('nocache') === '' || isTruthy(params.get('nocache')))
    );
};

export const cache = async (cacheKey, handler, nocache = false) => {
//     const cached = await redis.get(cacheKey);
//
//     if (!DEBUG && !nocache && cached) {
//         return { data: cached, cached: true };
//     }

    try {
        const data = await handler();

        // await redis.set(cacheKey, data);
        // await redis.expire(cacheKey, CACHE_TTL_SECONDS);

        return { data, cached: false };
    } catch (error) {
        return { error, cached: false };
    }
};
