import { Router } from 'express';
import { Resend } from 'resend';

import ntfy from '@/services/ntfy';
import { totp } from '@/services/security';
import { supabase } from '@/services/supabase';

const router = Router();
const $schema = supabase.schema('bookworms');
const $storage = supabase.storage.from('bookworms');
const resend = new Resend(process.env.RESEND_API_KEY || '');

router.get('/request', async (req, res) => {
    const filename = req.query?.filename;
    const format = req.query?.format || 'epub';

    if (!filename) {
        return res.status(400).json({ error: 'Missing filename.' });
    }

    const otp = totp.generate();
    const finalFilename = filename.replace(/\.epub$/i, `.${format}`);

    const bookData = JSON.stringify({
        filename,
        format,
    });

    await ntfy.pushSimple({
        message: `[${otp}]requestBook(${bookData})`,
    });

    return res.json({
        data: {
            message: 'Reach the validate url to see if your book is available',
            validateUrl: `/bookworms/validate?filename=${finalFilename}`,
            filename: finalFilename,
        },
    });
});

router.get('/validate', async (req, res) => {
    const filename = req.query?.filename;

    if (!filename) {
        return res.status(400).json({ error: 'Missing filename.' });
    }

    const { error } = await $storage.download(filename);

    if (error) {
        return res.status(404).json({
            error: 'Book not found, please request first and try again later',
            requestUrl: `/bookworms/request?filename=${filename}`,
            filename,
        });
    }

    return res.json({
        data: {
            message: 'Book available and ready for download',
            downloadUrl: `/bookworms/download?filename=${filename}`,
            filename,
        },
    });
});

router.get('/download', async (req, res) => {
    const filename = req.query?.filename;

    if (!filename) {
        return res.status(404).send();
    }

    const { data, error } = await $storage.download(filename);

    if (!data || error) {
        return res.status(404).send();
    }

    await $storage.remove([filename]);

    const { data: bookData } = await $schema
        .from('books')
        .select('id')
        .eq('filename', filename)
        .single();

    await $schema.rpc('increment_field', {
        target_table: 'books',
        target_column: 'downloads',
        target_id: bookData.id,
    });

    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/epub+zip');
    return res.send(buffer);
});

router.get('/file', async (req, res) => {
    const filename = req.query?.filename;

    if (!filename) {
        return res.status(400).json({ error: 'Missing filename.' });
    }

    const { data } = $storage.getPublicUrl(filename);

    if (!data) {
        return res.status(404).json({ error: 'Book file not found.' });
    }

    const { data: bookData } = await $schema
        .from('books')
        .select('id')
        .eq('filename', filename)
        .single();

    await $schema.rpc('increment_field', {
        target_table: 'books',
        target_column: 'downloads',
        target_id: bookData.id,
    });

    return res.json({ data });
});

router.post('/sendto-kindle', async (req, res) => {
    const { email, filename } = req.body;

    if (!filename || !email) {
        return res.status(400).json({ error: 'Invalid payload.' });
    }

    const { data: fileData, error: fileError } = await $storage.download(filename);

    if (!fileData || fileError) {
        console.error('Read book error:', fileError);
        return res.status(404).json({ error: 'Book not found in storage.' });
    }

    await $storage.remove([filename]);

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const bookFilename = filename.split('/').pop();

    const { error: emailError } = await resend.emails.send({
        from: 'Bookworms <no-reply@mail.hckr.mx>',
        to: email,
        subject: 'Bookworms - ¡Tu libro está en camino a tu Kindle!',
        html: `
            <p>Has recibido un nuevo libro para tu Kindle.</p>
            <p>¡Disfruta tu lectura!, <br/>El equipo de Bookworms</p>
        `,
        attachments: [
            {
                content: buffer.toString('base64'),
                filename: bookFilename,
            },
        ],
    });

    if (emailError) {
        console.error('Error sending email:', emailError);
        return res.status(500).json({ error: 'Error sending email.' });
    }

    const { data: bookData } = await $schema
        .from('books')
        .select('id')
        .eq('filename', filename.replace(/\.mobi/i, '.epub'))
        .single();

    await $schema.rpc('increment_field', {
        target_table: 'books',
        target_column: 'downloads',
        target_id: bookData.id,
    });

    return res.status(200).json({ data: { message: 'Email sent successfully.', filename, email } });
});

router.get('/clear-bucket', async (req, res) => {
    await supabase.storage.emptyBucket('bookworms');
    return res.status(204).send();
});

export default router;
