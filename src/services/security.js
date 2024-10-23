import * as OTPAuth from 'otpauth';

const APP_KEY = process.env.APP_KEY;
const WINDOW_SIZE = 60;

export const totp = new OTPAuth.TOTP({
    issuer: 'DNN',
    label: 'Endpoints',
    algorithm: 'SHA1',
    digits: 6,
    period: WINDOW_SIZE,
    secret: APP_KEY,
});
