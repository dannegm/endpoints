import { Router } from 'express';
import * as OTPAuth from 'otpauth';

const router = Router();

const APP_KEY = process.env.STARFISH__APP_KEY;
const WINDOW_SIZE = 60;

const totp = new OTPAuth.TOTP({
    issuer: 'DNN',
    label: 'Lock Screen',
    algorithm: 'SHA1',
    digits: 6,
    period: WINDOW_SIZE,
    secret: APP_KEY,
});

router.all('/', (req, res) => {
    return res.send('OK - starfish');
});

router.get('/otp', (req, res) => {
    return res.status(200).json({
        secret: APP_KEY,
        otp: totp.generate(),
        uri: totp.toString(),
    });
});

export default router;
