'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const API_ROOT = path.resolve(__dirname, '..', '..');
const REPO_ROOT = path.resolve(API_ROOT, '..', '..');

loadEnvFiles();

function loadEnvFiles() {
  const files = [path.join(REPO_ROOT, '.env'), path.join(API_ROOT, '.env')].filter((file) =>
    fs.existsSync(file)
  );

  if (files.length === 0) return;

  // dotenv lives in apps/api, so a script at the repo root cannot resolve it by name.
  const dotenv = require(require.resolve('dotenv', { paths: [API_ROOT, REPO_ROOT] }));

  // dotenv never overwrites, so the repo-root file wins over apps/api/.env.
  for (const file of files) dotenv.config({ path: file });
}

function requireEnv(name) {
  const value = process.env[name];

  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        'Copy .env.example to .env and fill in the Telebirr sandbox credentials ' +
        '(see docs/telebirr.md).'
    );
  }

  return value.trim();
}

function optionalEnv(name, fallback) {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

function boolEnv(name, fallback) {
  const value = optionalEnv(name, undefined);

  if (value === undefined) return fallback;

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function intEnv(name, fallback) {
  const value = optionalEnv(name, undefined);
  if (value === undefined) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * .env files cannot hold real newlines, so PEM keys are usually pasted with
 * literal backslash-n sequences. Restore them, and accept base64 as a fallback.
 */
function pemEnv(name, { base64EnvName } = {}) {
  const inline = optionalEnv(name, undefined);
  if (inline !== undefined) return normalizePem(inline);

  if (base64EnvName) {
    const encoded = optionalEnv(base64EnvName, undefined);
    if (encoded !== undefined) return Buffer.from(encoded, 'base64').toString('utf8');
  }

  return undefined;
}

function normalizePem(value) {
  const withNewlines = value.replace(/\\n/g, '\n').trim();

  if (withNewlines.includes('-----BEGIN')) return withNewlines;

  const decoded = Buffer.from(withNewlines, 'base64');
  const asText = decoded.toString('utf8');
  if (asText.includes('-----BEGIN')) return asText.trim();

  // Raw base64 DER, which is what `openssl genpkey -outform DER` and most
  // consoles give you. Re-wrap it so crypto can read it.
  return derToPem(decoded) || withNewlines;
}

function derToPem(der) {
  if (der.length === 0 || der[0] !== 0x30) return null;

  const privateKeyTypes = ['pkcs8', 'pkcs1'];
  const publicKeyTypes = ['spki', 'pkcs1'];

  for (const type of privateKeyTypes) {
    try {
      return crypto.createPrivateKey({ key: der, format: 'der', type })
        .export({ type: 'pkcs8', format: 'pem' })
        .toString()
        .trim();
    } catch {
      // Not this encoding; try the next.
    }
  }

  for (const type of publicKeyTypes) {
    try {
      return crypto.createPublicKey({ key: der, format: 'der', type })
        .export({ type: 'spki', format: 'pem' })
        .toString()
        .trim();
    } catch {
      // Not this encoding; try the next.
    }
  }

  return null;
}

module.exports = {
  API_ROOT,
  REPO_ROOT,
  requireEnv,
  optionalEnv,
  boolEnv,
  intEnv,
  pemEnv
};
