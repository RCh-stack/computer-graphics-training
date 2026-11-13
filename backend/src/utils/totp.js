const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function generateSecret(byteLength = 20) {
    const bytes = crypto.randomBytes(byteLength);
    let bits = 0;
    let value = 0;
    let output = '';

    for (const byte of bytes) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
}

function decodeBase32(secret) {
    const cleaned = String(secret).toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const bytes = [];

    for (const char of cleaned) {
        const idx = BASE32_ALPHABET.indexOf(char);
        if (idx === -1) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }

    return Buffer.from(bytes);
}

function generateTOTPCode(secret, counter) {
    const key = decodeBase32(secret);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;

    const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);

    return String(binary % 1_000_000).padStart(6, '0');
}

function verifyTOTP({ token, secret, window = 1 }) {
    const cleanToken = String(token || '').trim();
    if (!/^\d{6}$/.test(cleanToken) || !secret) return false;

    const currentCounter = Math.floor(Date.now() / 1000 / 30);

    for (let step = -window; step <= window; step++) {
        const expected = generateTOTPCode(secret, currentCounter + step);
        if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(cleanToken))) {
            return true;
        }
    }

    return false;
}

function buildKeyUri(email, issuer, secret) {
    const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(email)}`;
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

module.exports = {
    generateSecret,
    verifyTOTP,
    buildKeyUri
};