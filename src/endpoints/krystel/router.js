import { Router } from 'express';

const router = Router();

router.all('/', (req, res) => {
    return res.send('OK - krystel');
});

export default router;
