import { Router } from 'express';
import sharp from 'sharp';

const router = Router();

const SIZE_WHITELIST = [48, 200, 360, 600];
const RATIO_WHITELIST = [1, 2, 3];
const R2_PUBLIC_URL = process.env.STUFFBOX__R2_PUBLIC_URL;

router.get('/photo/:sizeId/:ratio/*', async (req, res) => {
    const { sizeId, ratio } = req.params;
    const key = req.params[0];

    const isOriginal = sizeId === 'o';
    const baseSize = SIZE_WHITELIST[Number(sizeId) - 1];
    const ratioMultiplier = RATIO_WHITELIST.includes(Number(ratio)) ? Number(ratio) : null;

    if (!ratioMultiplier || (!isOriginal && !baseSize)) {
        return res.status(404).end();
    }

    const originResponse = await fetch(`${R2_PUBLIC_URL}/${key}`);

    if (!originResponse.ok) {
        return res.status(404).end();
    }

    const buffer = Buffer.from(await originResponse.arrayBuffer());

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');

    if (isOriginal) {
        return res.send(buffer);
    }

    const size = baseSize * ratioMultiplier;

    const output = await sharp(buffer)
        .resize(size, size, { fit: 'outside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();

    return res.send(output);
});

export default router;
