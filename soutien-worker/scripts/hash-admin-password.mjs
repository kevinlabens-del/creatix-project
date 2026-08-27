import { pbkdf2Sync, randomBytes } from 'node:crypto';

const password = process.env.CR3ATIX_ADMIN_PASSWORD || '';
if (password.length < 14) {
  console.error('Définis CR3ATIX_ADMIN_PASSWORD avec au moins 14 caractères, sans l’écrire dans le dépôt.');
  process.exit(1);
}
const iterations = 310000;
const salt = randomBytes(24);
const digest = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
console.log(`pbkdf2_sha256$${iterations}$${salt.toString('base64url')}$${digest.toString('base64url')}`);
