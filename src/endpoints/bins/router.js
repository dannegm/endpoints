import { Router } from 'express';

const router = Router();

router.all('/', (req, res) => {
    return res.send('OK - bins');
});

export default router;
