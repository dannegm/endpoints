import CryptoJS from 'crypto-js';

export const sha1 = data => CryptoJS.SHA1(data).toString();

export const nanoid = (length = 21) => {
    const randomValue = CryptoJS.lib.WordArray.random(16).toString();
    const hash = CryptoJS.SHA1(randomValue).toString();
    return hash.substring(0, length);
};

export const encode64 = raw => CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(raw));

export const decode64 = encoded => CryptoJS.enc.Base64.parse(encoded).toString(CryptoJS.enc.Utf8);

export const tokenEncode = (payload = {}) => {
    const SEPARATOR_SIZE = 12;

    const content = encode64(JSON.stringify(payload));
    const separator = nanoid(SEPARATOR_SIZE);
    const secret = nanoid(SEPARATOR_SIZE);
    const head = `${nanoid(SEPARATOR_SIZE)}.${separator},${nanoid(SEPARATOR_SIZE)}`;

    const key = CryptoJS.enc.Utf8.parse(secret);
    const iv = CryptoJS.lib.WordArray.create(key.words.slice(0, 4));
    const iv1 = CryptoJS.enc.Base64.stringify(iv);

    const cipher = CryptoJS.AES.encrypt(content, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    }).toString();

    const vector = `${secret}${separator}${iv1}${separator}${cipher}`;

    return `${head}.${vector}.${nanoid(SEPARATOR_SIZE)}`;
};

export const tokenDecode = encoded => {
    const splitter = encoded.split('.');
    const [separator] = splitter[1].split(',');
    const cipher = splitter[2];

    const [secret, iv, ciphertext] = cipher.split(separator);

    const iv1 = CryptoJS.enc.Base64.parse(iv);
    const key = CryptoJS.enc.Utf8.parse(secret);
    const cipherBytes = CryptoJS.enc.Base64.parse(ciphertext);

    const decrypted = CryptoJS.AES.decrypt({ ciphertext: cipherBytes }, key, {
        iv: iv1,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    }).toString(CryptoJS.enc.Utf8);

    const decoded = decode64(decrypted);

    try {
        return JSON.parse(decoded);
    } catch (err) {
        return decoded;
    }
};
