import { Router } from 'express';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import React from 'react';
import sharp from 'sharp';
import { join } from 'path';
import { supabase } from '@/services/supabase';
import { BookPreview } from '../preview.jsx';

const router = Router();
const $schema = supabase.schema('bookworms');

const BUCKET_URL = 'https://bookworms-bucket.hckr.mx';
const SPRITE_COLS = 4;
const SPRITE_ROWS = 3;

let fontsCache = null;

async function getFonts() {
    if (fontsCache) return fontsCache;
    const dir = join(import.meta.dir, '../../../../node_modules/@fontsource');
    const [regular, bold, notoRegular, notoSemibold] = await Promise.all([
        Bun.file(join(dir, 'merriweather/files/merriweather-latin-400-normal.woff')).arrayBuffer(),
        Bun.file(join(dir, 'merriweather/files/merriweather-latin-700-normal.woff')).arrayBuffer(),
        Bun.file(join(dir, 'noto-sans/files/noto-sans-latin-400-normal.woff')).arrayBuffer(),
        Bun.file(join(dir, 'noto-sans/files/noto-sans-latin-600-normal.woff')).arrayBuffer(),
    ]);
    fontsCache = [
        { name: 'Merriweather', data: regular, weight: 400, style: 'normal' },
        { name: 'Merriweather', data: bold, weight: 700, style: 'normal' },
        { name: 'Noto Sans', data: notoRegular, weight: 400, style: 'normal' },
        { name: 'Noto Sans', data: notoSemibold, weight: 600, style: 'normal' },
    ];
    return fontsCache;
}

async function fetchCover(cover_id) {
    if (cover_id == null) return null;
    try {
        const imageNumber = (cover_id / (SPRITE_COLS * SPRITE_ROWS)) | 0;
        const imageX = cover_id % SPRITE_COLS;
        const imageY = ((cover_id / SPRITE_COLS) | 0) % SPRITE_ROWS;

        const spriteRes = await fetch(`${BUCKET_URL}/bucket/${imageNumber}.webp`);
        if (!spriteRes.ok) return null;

        const spriteBuffer = Buffer.from(await spriteRes.arrayBuffer());
        const img = sharp(spriteBuffer);
        const { width, height } = await img.metadata();

        const coverWidth = Math.floor(width / SPRITE_COLS);
        const coverHeight = Math.floor(height / SPRITE_ROWS);

        const coverBuffer = await img
            .extract({
                left: imageX * coverWidth,
                top: imageY * coverHeight,
                width: coverWidth,
                height: coverHeight,
            })
            .png()
            .toBuffer();

        return `data:image/png;base64,${coverBuffer.toString('base64')}`;
    } catch {
        return null;
    }
}

router.get('/book/:libid/preview-image.:format(svg|png)', async (req, res) => {
    const { libid, format } = req.params;

    const { data: book, error } = await $schema
        .from('books')
        .select('libid, title, published, pagecount, cover_id, serie_name, serie_sequence, labels, authors(name)')
        .eq('libid', libid)
        .single();

    if (error || !book) {
        return res.status(404).json({ error: 'Book not found' });
    }

    const [fonts, coverUri] = await Promise.all([getFonts(), fetchCover(book.cover_id)]);

    const svg = await satori(
        React.createElement(BookPreview, {
            title: book.title ?? 'Untitled',
            authors: book.authors ?? [],
            published: book.published,
            pagecount: book.pagecount,
            serieName: book.serie_name,
            serieSequence: book.serie_sequence,
            labels: book.labels ?? [],
            coverUri,
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
