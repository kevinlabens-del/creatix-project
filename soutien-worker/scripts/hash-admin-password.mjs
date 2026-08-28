import { createHmac } from 'node:crypto';

const password = process.env.CR3ATIX_ADMIN_PASSWORD || '';
const pepper = process.env.ADMIN_PASSWORD_PEPPER || '';

if (password.length < 14 || password.length > 512) {
  console.error('Définis CR3ATIX_ADMIN_PASSWORD avec 14 à 512 caractères, sans l’écrire dans le dépôt.');
  process.exit(1);
}

if (!/^[0-9a-f]{64}$/i.test(pepper)) {
  console.error('Définis ADMIN_PASSWORD_PEPPER avec 32 octets aléatoires encodés en hexadécimal.');
  process.exit(1);
}

const digest = createHmac('sha256', pepper).update(password, 'utf8').digest('base64url');
console.log(`hmac_sha256$${digest}`);
