import { supabase } from '@/services/supabase';

const $schema = supabase.schema('didntread');
const FREE_TOKENS = 15;
const TransactionTypes = {
    SPENT: '',
    EARNED: '',
    FAILED: '',
};

export const upsertFingerprint = async ({ fingerprint }) => {
    const { data, error } = await $schema
        .from('fingerprints')
        .upsert(
            {
                fingerprint,
                tokens: FREE_TOKENS,
            },
            {
                onConflict: ['fingerprint'],
            },
        )
        .select()
        .single();

    return [data, error];
};

export const updateFingerprint = async ({ fingerprint, body }) => {
    return await $schema
        .from('fingerprints')
        .update({ ...body })
        .eq('fingerprint', fingerprint);
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
    const [{ tokens: availableTokens }, userError] = await upsertFingerprint({ fingerprint });

    if (userError) {
        return [null, userError];
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
