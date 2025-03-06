import { supabase } from '@/services/supabase';
import { withQueryParams } from '@/middlewares';
import { Ntfy } from '@/services/ntfy';
import { richPost } from './helpers';

const APP_TOPIC = process.env.QUOTES_APP_TOPIC;

const $schema = supabase.schema('quotes');
const ntfy = new Ntfy(APP_TOPIC);

const getAllPostsQueryPayload = withQueryParams({
    includes: {
        type: Array,
        default: [],
    },
});
const readAllPost = async (req, res) => {
    const { space } = req.params;
    const { includes } = req.query;

    let $query = $schema.from('posts').select('*').eq('space', space);

    if (!includes.includes('indev')) {
        $query = $query.is('indev', false);
    }

    if (!includes.includes('deleted')) {
        $query = $query.is('deleted_at', null);
    }

    const { data, error } = await $query.order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const mappedData = data.map(richPost);

    return res.status(200).json(mappedData);
};

const createPost = async (req, res) => {
    const { space } = req.params;
    const { skipActions, content, type = 'post', ...rest } = req.body;

    if (!content) return res.status(400).json({ error: 'Content is required' });

    const { data, error } = await $schema
        .from('posts')
        .insert({ space, content, type, ...rest })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    if (!skipActions) {
        ntfy.pushRich({
            message: `Krystel posted an ${type}`,
            click: `https://axolote.me/${space}/posts`,
        });
    }

    return res.status(201).json(richPost(data));
};

const readPost = async (req, res) => {
    const { space, id } = req.params;

    const { data, error } = await $schema
        .from('posts')
        .select('*')
        .eq('space', space)
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json(richPost(data));
};

const updatePost = async (req, res) => {
    const { space, id } = req.params;

    const { data, error } = await $schema
        .from('posts')
        .update(req.body)
        .eq('space', space)
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(richPost(data));
};

const deletePost = async (req, res) => {
    const { space, id } = req.params;

    const { data, error } = await $schema
        .from('posts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('space', space)
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(richPost(data));
};

const destroyPost = async (req, res) => {
    const { space, id } = req.params;

    const { data, error } = await $schema
        .from('posts')
        .delete()
        .eq('space', space)
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(richPost(data));
};

export const postsRouter = router => {
    router.get('/:space/posts', getAllPostsQueryPayload, readAllPost);
    router.post('/:space/posts', createPost);
    router.get('/:space/posts/:id', readPost);
    router.put('/:space/posts/:id', updatePost);
    router.delete('/:space/posts/:id', deletePost);
    router.delete('/:space/posts/:id/destroy', destroyPost);
    return router;
};
