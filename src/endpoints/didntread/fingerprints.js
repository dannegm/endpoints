import { supabase } from '@/services/supabase';

const $schema = supabase.schema('didntread');
const FREE_TOKENS = 15;
const TransactionTypes = {
    SPENT: 'spent',
    EARNED: 'earned',
    FAILED: 'failed',
};

export const findFingerprint = async ({ fingerprint }) => {
    const { data, error } = await $schema
        .from('fingerprints')
        .select()
        .eq('fingerprint', fingerprint)
        .single();

    return [data, error];
};

export const upsertFingerprint = async ({ fingerprint }) => {
    let { data, error } = await $schema
        .from('fingerprints')
        .select()
        .eq('fingerprint', fingerprint)
        .single();

    if (!data || error) {
        const { data: created, createdError } = await $schema
            .from('fingerprints')
            .insert({
                fingerprint,
                tokens: FREE_TOKENS,
            })
            .select()
            .single();

        data = created;
        error = createdError;
    }

    return [data, error];
};

export const updateFingerprint = async ({ fingerprint, ...body }) => {
    return await $schema.from('fingerprints').update(body).eq('fingerprint', fingerprint);
};

export const registerTransaction = async ({ fingerprint, tokens, type, source, payload = {} }) => {
    return await $schema.from('transactions').insert({
        fingerprint,
        tokens,
        type,
        source,
        payload,
    });
};

export const spendTokens = async ({ fingerprint, tokens, source, payload = {} }) => {
    const [{ tokens: availableTokens }, fingerprintError] = await findFingerprint({ fingerprint });

    if (fingerprintError) {
        return [null, fingerprintError];
    }

    if (availableTokens < tokens) {
        await registerTransaction({
            fingerprint,
            source,
            payload,
            tokens: 0,
            type: TransactionTypes.FAILED,
        });
        return [0, 'Insufficient tokens'];
    }

    const updatedTokens = availableTokens - tokens;

    await updateFingerprint({ fingerprint, tokens: updatedTokens });
    await registerTransaction({
        fingerprint,
        source,
        payload,
        tokens,
        type: TransactionTypes.SPENT,
    });

    return [updatedTokens, null];
};
