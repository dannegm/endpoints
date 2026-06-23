import { Router } from 'express';
import { jwtVerify, SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';
import { sha1 } from '@/helpers/crypto.js';
import { withApiKey } from '@/helpers/middlewares.js';

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
);

const supabaseAuth = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
);

const JWT_SECRET = new TextEncoder().encode(process.env.BINS_JWT_SECRET);

const deriveEmail = uuid => `${uuid}@mail.hckr.mx`;
const derivePassword = uuid => sha1(`${uuid}:${process.env.BINS_CLAIM_SECRET}`);

const attachCredentials = async uuid => {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(uuid, {
        email: deriveEmail(uuid),
        password: derivePassword(uuid),
        email_confirm: true,
    });
    return error;
};

const router = Router();

router.post('/auth/claim', async (req, res) => {
    let uuid = null;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        try {
            const token = authHeader.slice(7);
            const { payload } = await jwtVerify(token, JWT_SECRET);
            uuid = payload.uuid ?? null;
        } catch {
            return res.status(401).json({ error: 'Invalid token' });
        }
    }

    if (uuid) {
        const error = await attachCredentials(uuid);
        if (error) uuid = null; // user not found in auth.users, fall through to create
    }

    if (!uuid) {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: `setup-${crypto.randomUUID()}@mail.hckr.mx`,
            email_confirm: true,
        });
        if (error) return res.status(500).json({ error: 'Failed to create user' });

        uuid = data.user.id;
        await attachCredentials(uuid);
    }

    const { data, error } = await supabaseAuth.auth.signInWithPassword({
        email: deriveEmail(uuid),
        password: derivePassword(uuid),
    });
    if (error) return res.status(500).json({ error: 'Sign-in failed' });

    return res.json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
    });
});

router.post(
    '/auth/recover',
    withApiKey(process.env.BINS_CLAIM_SECRET),
    async (req, res) => {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'Missing username' });

        const { data: profile, error } = await supabaseAdmin
            .schema('bins')
            .from('profiles')
            .select('uuid, name, color_light, color_dark')
            .eq('name', username)
            .maybeSingle();

        if (error) return res.status(500).json({ error: 'DB error' });
        if (!profile) return res.status(404).json({ error: 'User not found' });

        const user = {
            uuid: profile.uuid,
            name: profile.name,
            colorLight: profile.color_light,
            colorDark: profile.color_dark,
        };

        const token = await new SignJWT({ uuid: profile.uuid, user })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('15m')
            .sign(JWT_SECRET);

        return res.json({ link: `https://bins.hckr.mx/login?token=${token}` });
    },
);

export default router;
