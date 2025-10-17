import { Router } from 'express';

const router = Router();

router.all('/', (req, res) => {
    return res.send('OK - health');
});

export default router;
