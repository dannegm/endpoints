import Crypto from 'crypto';
export const sha1 = data => Crypto.createHash('sha1').update(data, 'utf8').digest('hex');
