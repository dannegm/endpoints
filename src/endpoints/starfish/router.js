import { Router } from 'express';
import { totp } from '@/services/security';

const router = Router();

router.all('/', (req, res) => {
    return res.send('OK - starfish');
});

router.get('/otp', (req, res) => {
    return res.status(200).json({
        otp: totp.generate(),
        uri: totp.toString(),
    });
});

export default router;
