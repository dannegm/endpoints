import got from 'got';
import { supabase } from '@/services/supabase';
import { sha1 } from '@/helpers/crypto';

import { scrapper } from './metascraper';
import { makePrompt } from './chatgpt';

const $schema = supabase.schema('didntread');

const prompt = `
    You're going to be a machine that reads an article and gives me in a tweet (no more than
    240 characters), whit no hashtags, what the article's title is promising, saving me from
    reading all the useless filler content. I'll send the articles in markdown.
`;

const readerPrompt = makePrompt({ prompt });

export const findAbstractsByFingerprint = async ({ fingerprint }) => {
    const { data, error } = await $schema
        .from('fingerprint_abstracts')
        .select('abstracts(*)')
        .order('id', { ascending: false })
        .eq('fingerprint', fingerprint);

    if (!data || error) {
        return [null, error];
    }

    const flatData = data.map(({ abstracts }) => abstracts);
    return [flatData, error];
};

export const fetchAbstract = async ({ lang = 'infer', url = '' }) => {
    if (!url) {
        return [null, 'Invalid Url'];
    }

    const hash = `${lang}:${sha1(url)}`;
    const { data } = await $schema.from('abstracts').select().eq('hash', hash).single();

    if (data) {
        return [data, null, true];
    }

    try {
        const { body } = await got(url);
        const { markdown, ...metadata } = await scrapper({ url, html: body });

        const resume = await readerPrompt({ lang, message: markdown });

        const abstract = {
            ...metadata,
            resume,
            lang,
            hash,
        };

        return [abstract, null, false];
    } catch (err) {
        return [null, err];
    }
};

export const upsertAbstract = async ({ lang = 'infer', url = '', ...payload }) => {
    if (!url) {
        return [null, 'Invalid Url'];
    }

    const hash = `${lang}:${sha1(url)}`;

    const { data, error } = await $schema
        .from('abstracts')
        .upsert(
            {
                hash,
                lang,
                url,
                ...payload,
            },
            {
                onConflict: ['hash'],
            },
        )
        .select()
        .single();

    return [data, error];
};

export const linkAbstractToFingerprint = async ({ fingerprint, hash }) => {
    const { data, error } = await $schema
        .from('fingerprint_abstracts')
        .upsert({
            fingerprint,
            hash,
        })
        .select()
        .single();

    return [data, error];
};
