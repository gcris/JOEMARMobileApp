/**
 * Pure TypeScript implementation of TOTP (RFC 6238) and Base32 decoding
 * for Google Authenticator compatibility, running locally on Expo.
 */

// Decodes a Base32 string to Uint8Array
export function base32ToBytes(base32: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = base32.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const value = alphabet.indexOf(cleaned[i]);
    if (value === -1) {
      throw new Error('Invalid base32 character: ' + cleaned[i]);
    }
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

// Pure JS/TS SHA-1 implementation
function sha1(data: Uint8Array): Uint8Array {
  const l = data.length;
  const bitLen = l * 8;
  const paddingLen = ((l + 8) % 64 < 56) ? (56 - (l + 8) % 64) : (120 - (l + 8) % 64);
  const totalLen = l + 1 + paddingLen + 8;
  const words = new Uint32Array(totalLen / 4);

  // Copy data to words
  for (let i = 0; i < l; i++) {
    words[i >> 2] |= data[i] << (24 - (i % 4) * 8);
  }
  // Add 0x80 byte
  words[l >> 2] |= 0x80 << (24 - (l % 4) * 8);

  // Add bit length at the end
  words[words.length - 1] = bitLen & 0xffffffff;
  words[words.length - 2] = (bitLen / 0x100000000) & 0xffffffff;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Uint32Array(80);

  for (let i = 0; i < words.length; i += 16) {
    for (let t = 0; t < 16; t++) {
      w[t] = words[i + t];
    }
    for (let t = 16; t < 80; t++) {
      const val = w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16];
      w[t] = (val << 1) | (val >>> 31);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let t = 0; t < 80; t++) {
      let f = 0;
      let k = 0;
      if (t < 20) {
        f = (b & c) | ((~b) & d);
        k = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[t]) & 0xffffffff;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) & 0xffffffff;
    h1 = (h1 + b) & 0xffffffff;
    h2 = (h2 + c) & 0xffffffff;
    h3 = (h3 + d) & 0xffffffff;
    h4 = (h4 + e) & 0xffffffff;
  }

  const result = new Uint8Array(20);
  const hashVal = [h0, h1, h2, h3, h4];
  for (let i = 0; i < 5; i++) {
    const h = hashVal[i];
    result[i * 4] = (h >>> 24) & 255;
    result[i * 4 + 1] = (h >>> 16) & 255;
    result[i * 4 + 2] = (h >>> 8) & 255;
    result[i * 4 + 3] = h & 255;
  }
  return result;
}

// Pure JS/TS HMAC-SHA1
export function hmacSha1(key: Uint8Array, message: Uint8Array): Uint8Array {
  const keyBlock = new Uint8Array(64);
  if (key.length > 64) {
    const hashedKey = sha1(key);
    keyBlock.set(hashedKey);
  } else {
    keyBlock.set(key);
  }

  const oPad = new Uint8Array(64);
  const iPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    oPad[i] = keyBlock[i] ^ 0x5c;
    iPad[i] = keyBlock[i] ^ 0x36;
  }

  // Inner chunk: iPad + message
  const innerMsg = new Uint8Array(64 + message.length);
  innerMsg.set(iPad, 0);
  innerMsg.set(message, 64);
  const innerHash = sha1(innerMsg);

  // Outer chunk: oPad + innerHash
  const outerMsg = new Uint8Array(64 + 20);
  outerMsg.set(oPad, 0);
  outerMsg.set(innerHash, 64);
  return sha1(outerMsg);
}

// Generates 6-digit TOTP code for a secret and current timestamp
export function generateTOTP(base32Secret: string, timeSec: number = Math.floor(Date.now() / 1000)): string {
  try {
    const secretBytes = base32ToBytes(base32Secret);
    const counter = Math.floor(timeSec / 30);
    
    // Convert counter to 8-byte big-endian byte array
    const counterBytes = new Uint8Array(8);
    let temp = counter;
    for (let i = 7; i >= 0; i--) {
      counterBytes[i] = temp & 0xff;
      temp = Math.floor(temp / 256);
    }

    const hmac = hmacSha1(secretBytes, counterBytes);
    
    // Dynamic Truncation (DT)
    const offset = hmac[19] & 0x0f;
    const codeBin = ((hmac[offset] & 0x7f) << 24) |
                    ((hmac[offset + 1] & 0xff) << 16) |
                    ((hmac[offset + 2] & 0xff) << 8) |
                    (hmac[offset + 3] & 0xff);

    const otp = codeBin % 1000000;
    return otp.toString().padStart(6, '0');
  } catch (error) {
    console.error('TOTP Generation Error', error);
    return '000000';
  }
}

// Generate a random Base32 string to serve as Google-auth secret
export function generateRandomSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  // 16 characters base32 = 80 bits entropy, perfect standard length
  for (let i = 0; i < 16; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

// Generates the standard google authenticator otpauth scheme Uri
// (allows users who want to print or construct their own uri QR generator)
export function getOTPAuthUri(badge: string, secret: string): string {
  const label = encodeURIComponent(`PNP Patroller (${badge})`);
  const issuer = encodeURIComponent('Philippine National Police');
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}
