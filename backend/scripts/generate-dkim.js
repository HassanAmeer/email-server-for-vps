import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const dkimDir = path.join(process.cwd(), 'backend', 'dkim-key-for-send-mail');

if (!fs.existsSync(dkimDir)) {
  fs.mkdirSync(dkimDir, { recursive: true });
}

console.log('Generating 2048-bit RSA keys for DKIM...');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Save private key
const privateKeyPath = path.join(dkimDir, 'private.key');
fs.writeFileSync(privateKeyPath, privateKey);
console.log(`✅ Private key saved to: ${privateKeyPath}`);

// Format public key for DNS TXT record
// Remove PEM headers and newlines
const pubKeyBase64 = publicKey
  .replace('-----BEGIN PUBLIC KEY-----', '')
  .replace('-----END PUBLIC KEY-----', '')
  .replace(/\n/g, '')
  .replace(/\r/g, '');

const dnsRecord = `v=DKIM1; k=rsa; p=${pubKeyBase64}`;

const publicKeyPath = path.join(dkimDir, 'public.txt');
fs.writeFileSync(publicKeyPath, dnsRecord);
console.log(`✅ Public DNS Record saved to: ${publicKeyPath}\n`);

console.log('====================================================');
console.log('                 DKIM DNS RECORD                    ');
console.log('====================================================');
console.log('Type:  TXT');
console.log('Name:  default._domainkey');
console.log(`Value: ${dnsRecord}`);
console.log('====================================================\n');
