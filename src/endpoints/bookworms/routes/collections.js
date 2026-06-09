import { Router } from 'express';

import { matchBooks } from '../utils/matcher';

const router = Router();

// POST /collections/test-matcher
// Body: { books: [{ title, authors?, published? }] }
router.post('/collections/test-matcher', (req, res) => {
    const { books } = req.body;

    if (!Array.isArray(books) || books.length === 0) {
        return res.status(400).json({ message: 'Provide a books array' });
    }

    const matches = matchBooks(books);
    const results = books.map((book, i) => ({ input: book, match: matches[i] }));

    return res.json(results);
});

export default router;
