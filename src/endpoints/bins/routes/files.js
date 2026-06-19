import { Router } from 'express';
import { supabase } from '@/services/supabase.js';
import { MIME_TYPES } from '../helpers.js';

const router = Router();

router.get('/files/:fileId/:fileName?', async (req, res) => {
    const { fileId, fileName } = req.params;

    const { data, error } = await supabase
        .schema('bins')
        .from('bin_files')
        .select('content, language, name')
        .eq('id', fileId)
        .single();

    if (error || !data) {
        return res.status(404).json({ error: 'File not found' });
    }

    const mime = MIME_TYPES[data.language] ?? 'text/plain';
    const name = fileName ?? data.name;

    res.setHeader('Content-Type', `${mime}; charset=utf-8`);
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    return res.send(data.content ?? '');
});

export default router;
