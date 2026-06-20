import { Router } from 'express';
import { jwtVerify } from 'jose';
import { supabase } from '@/services/supabase.js';

const router = Router();

const JWT_SECRET = new TextEncoder().encode(process.env.BINS_JWT_SECRET);
const ADMIN_KEY = process.env.BINS_ADMIN_KEY;

router.post('/admin/claim', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing token' });
    }

    const token = authHeader.slice(7);

    let payload;
    try {
        ({ payload } = await jwtVerify(token, JWT_SECRET));
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const { uuid, password } = payload;

    if (!uuid || !password) {
        return res.status(400).json({ error: 'Missing uuid or password' });
    }

    let match;
    console.log(ADMIN_KEY);
    console.log(password);

    try {
        match = await Bun.password.verify(password, ADMIN_KEY);
    } catch {
        return res.status(500).json({ error: 'Invalid server key configuration' });
    }

    if (!match) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { error } = await supabase
        .schema('bins')
        .from('profiles')
        .update({ is_admin: true })
        .eq('uuid', uuid);

    if (error) {
        return res.status(500).json({ error: 'DB error' });
    }

    return res.json({ ok: true });
});

export default router;
