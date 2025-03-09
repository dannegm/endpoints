import { supabase } from '@/services/supabase';
import { createIpMemoryHandler } from '@/helpers/handlers';
import { withQueryParams } from '@/middlewares';
import { richQuote } from './helpers';

const $schema = supabase.schema('quotes');

const registerViewById = async (space, quoteId, skip = false) => {
    // Skip actions if requested
    if (skip) return;

    // Optimistic continue, this is not too necesary
    if (!space || !quoteId) return;

    return await $schema.rpc('increment_views', { space, quote_id: quoteId });
};

const getAllQuotesQueryPayload = withQueryParams({
    includes: {
        type: Array,
        default: [],
    },
});
const readAllQuotes = async (req, res) => {
    const { space } = req.params;
    const { includes } = req.query;

    const publishedReference = includes.includes('future')
        ? new Date('3000-12-31T12:00:00.000Z')
        : new Date();

    const deletedReference = includes.includes('deleted')
        ? new Date('1970-01-01T00:00:00.000Z')
        : new Date();

    const $initialQuery = $schema
        .from('quotes')
        .select('*')
        .eq('space', space)
        .lte('published_at', publishedReference.toISOString())
        .gte('published_at', deletedReference.toISOString());

    const $query = $initialQuery;

    const { data, error } = await $query.order('published_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const mappedData = data.map(richQuote);

    return res.status(200).json(mappedData);
};

const createQuote = async (req, res) => {
    const { space } = req.params;
    const { quote } = req.body;

    if (!quote) return res.status(400).json({ error: 'Quote is required' });

    const { data, error } = await $schema
        .from('quotes')
        .insert({ space, ...req.body })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(richQuote(data));
};

const DEFAULT_REPEAT_PROBABLITY = 0.2;
const pickQuoteQueryPayload = withQueryParams({
    'quote.id': {
        type: Number,
        default: null,
    },
    'skip-actions': {
        type: Boolean,
        default: false,
    },
    repeatProbability: {
        type: Number,
        default: DEFAULT_REPEAT_PROBABLITY,
    },
});
const createMemoryHandlerByIp = createIpMemoryHandler();
const pickQuote = async (req, res) => {
    const { space } = req.params;
    const { repeatProbability } = req.query;

    if (req.query['quote.id']) {
        const { data, error } = await $schema
            .from('quotes')
            .select('*')
            .eq('space', space)
            .eq('id', req.query['quote.id'])
            .single();

        if (error) return res.status(400).json({ error: error.message });

        await registerViewById(space, req.query['quote.id'], req.query['skip-actions']);
        return res.json(richQuote(data));
    }

    const memoryHandler = createMemoryHandlerByIp(req.headers['x-forwarded-for']);

    const { data: countData, error: countError } = await $schema.rpc('count_non_repeated_quotes', {
        space_param: space,
        exclude_ids: memoryHandler.getMemory(),
    });

    if (!countData || countError) {
        memoryHandler.clearMemory();
    }

    const { data, error } = await $schema.rpc('get_random_quote', {
        space_param: space,
        exclude_ids: memoryHandler.getMemory(),
        repeat_probability: repeatProbability,
    });

    if (error) return res.status(500).json({ error: error.message });

    if (!data || data.length === 0) {
        return res.status(404).json({ error: 'No quotes found for this space' });
    }

    const [quote] = data;
    memoryHandler.updateMemory([...memoryHandler.getMemory(), quote.id]);

    await registerViewById(space, quote.id, req.query['skip-actions']);
    return res.json(richQuote(quote));
};

const readQuoteQueryPayload = withQueryParams({
    'skip-actions': {
        type: Boolean,
        default: false,
    },
});
const readQuoteById = async (req, res) => {
    const { space, id } = req.params;

    const { data, error } = await $schema
        .from('quotes')
        .select('*')
        .eq('space', space)
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    await registerViewById(space, id, req.query['skip-actions']);
    return res.json(richQuote(data));
};

const updateQuoteById = async (req, res) => {
    const { space, id } = req.params;

    const { data, error } = await $schema
        .from('quotes')
        .update(req.body)
        .eq('space', space)
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(richQuote(data));
};

const deleteQuoteById = async (req, res) => {
    const { space, id } = req.params;

    const { data, error } = await $schema
        .from('quotes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('space', space)
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(richQuote(data));
};

export const quotesRouter = router => {
    router.get('/:space', getAllQuotesQueryPayload, readAllQuotes);
    router.post('/:space', createQuote);
    router.get('/:space/pick', pickQuoteQueryPayload, pickQuote);
    router.get('/:space/:id', readQuoteQueryPayload, readQuoteById);
    router.put('/:space/:id', updateQuoteById);
    router.delete('/:space/:id', deleteQuoteById);
    return router;
};
