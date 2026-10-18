'use strict';

const https = require('https');
const { URL } = require('url');

/**
 * Minimal JSON client over node:https. The gateway's sandbox certificate is
 * issued by a GlobalSign CA whose intermediate is missing from most trust
 * stores, so `rejectUnauthorized` has to be relaxable per config.
 */
function requestJson(url, options = {}) {
  const {
    method = 'POST',
    headers = {},
    body,
    timeoutMs = 30000,
    tlsInsecure = false
  } = options;

  const target = new URL(url);
  const payload = body === undefined ? undefined : Buffer.from(body, 'utf8');

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method,
        rejectUnauthorized: !tlsInsecure,
        headers: {
          Accept: 'application/json',
          // Keeps response parsing simple: no transparent gzip.
          'Accept-Encoding': 'identity',
          ...(payload ? { 'Content-Length': String(payload.length) } : {}),
          ...headers
        }
      },
      (res) => {
        const chunks = [];

        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json;

          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = undefined;
          }

          resolve({ statusCode: res.statusCode, headers: res.headers, text, json });
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Telebirr request to ${url} timed out after ${timeoutMs}ms.`));
    });

    req.on('error', reject);

    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = { requestJson };
