import { Router } from 'express';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import React from 'react';
import { supabase } from '@/services/supabase.js';
import { getFonts, fetchIcon, fetchAvatar } from '../helpers.js';
import { BinPreview } from '../preview.jsx';

const router = Router();

router.get('/bins/:binId/preview-image.:format(svg|png)', async (req, res) => {
    const { binId, format } = req.params;

    const [binResult, filesResult] = await Promise.all([
        supabase.schema('bins').from('bins').select('id, title, views, author_id').eq('id', binId).single(),
        supabase.schema('bins').from('bin_files').select('language').eq('bin_id', binId),
    ]);

    if (binResult.error || !binResult.data) {
        return res.status(404).json({ error: 'Bin not found' });
    }

    const bin = binResult.data;
    const files = filesResult.data ?? [];

    const { data: author } = await supabase
        .schema('bins')
        .from('profiles')
        .select('name, color_dark')
        .eq('uuid', bin.author_id)
        .single();

    const accentColor = author?.color_dark ?? '#f39c12';
    const uniqueLangs = [...new Set(files.map(f => f.language))];
    const extraLangs = Math.max(0, uniqueLangs.length - 3);

    const [fonts, avatarUri, ...iconResults] = await Promise.all([
        getFonts(),
        fetchAvatar(`${author?.name ?? ''}${bin.author_id}`, accentColor),
        ...uniqueLangs.slice(0, 3).map(fetchIcon),
    ]);

    const svg = await satori(
        React.createElement(BinPreview, {
            binId: bin.id,
            title: bin.title ?? 'Untitled',
            authorName: author?.name ?? 'anonymous',
            accentColor,
            fileCount: files.length,
            views: bin.views ?? 0,
            languageIcons: iconResults.filter(Boolean),
            extraLangs,
            avatarUri,
        }),
        { width: 1200, height: 630, fonts },
    );

    if (format === 'svg') {
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.send(svg);
    }

    const resvg = new Resvg(svg);
    const png = resvg.render().asPng();
    res.setHeader('Content-Type', 'image/png');
    return res.send(Buffer.from(png));
});

export default router;
