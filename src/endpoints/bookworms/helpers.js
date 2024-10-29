import { Redis } from '@upstash/redis';
import { trim, lowerCase, deburr } from 'lodash';

import { pipe } from '@/helpers/utils';

const redis = Redis.fromEnv();
const DEBUG = process.env.DEBUG === 'true';
const CACHE_TTL_SECONDS = 24 * 60 * 60;

const toString = str => str.toString();
export const normalize = pipe([toString, trim, lowerCase, deburr]);

export const getPagination = req => {
    const page = req.query?.page || 1;
    const limit = req.query?.limit || 20;
    const pagination = [limit * (page - 1), limit * (page - 1) + limit];
    return pagination;
};

export const cache = async (cacheKey, handler) => {
    const cached = await redis.get(cacheKey);

    if (!DEBUG && cached) {
        return { data: cached, cached: true };
    }

    try {
        const data = await handler();

        await redis.set(cacheKey, data);
        await redis.expire(cacheKey, CACHE_TTL_SECONDS);

        return { data, cached: false };
    } catch (error) {
        return { error, cached: false };
    }
};
