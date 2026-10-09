'use strict';

const crypto = require('crypto');

const SIGN_TYPE = 'SHA256WithRSA';

// The portal's "Interface Signing" rules state "Fill mode: PSS". Some language
// demos (Python, PHP) use PKCS#1 v1_5 instead, so it stays configurable.
const DEFAULT_PADDING = 'pss';

/**
 * Fields that never take part in the signature. `biz_content` is listed because
 * its members are flattened into the top level rather than signed as a nested
 * object. Mirrors the official demos' `tools.js` exclude list.
 */
const EXCLUDE_FIELDS = Object.freeze([
  'sign',
  'sign_type',
  'header',
  'refund_info',
  'openType',
  'raw_request',
  'wallet_reference_data',
  'biz_content'
]);

const HASHES = {
  SHA256WithRSA: 'sha256',
  SHA512WithRSA: 'sha512'
};

const PADDINGS = {
  pkcs1: crypto.constants.RSA_PKCS1_PADDING,
  pss: crypto.constants.RSA_PKCS1_PSS_PADDING
};

function hashFor(signType) {
  const hash = HASHES[signType];

  if (!hash) {
    throw new Error(`Unsupported sign_type "${signType}". Expected one of ${Object.keys(HASHES).join(', ')}.`);
  }

  return hash;
}

function paddingFor(padding) {
  const value = PADDINGS[padding];

  if (!value) {
    throw new Error(`Unsupported sign padding "${padding}". Expected one of ${Object.keys(PADDINGS).join(', ')}.`);
  }

  return value;
}

/**
 * Build the exact string the gateway signs: every non-excluded top-level field
 * plus every non-excluded `biz_content` member, flattened, sorted by key in
 * ASCII order, and joined as `key=value` pairs with `&`.
 *
 * Nested objects/arrays are skipped, because the gateway flattens to a string
 * too and any mismatch in serialisation breaks verification.
 */
function canonicalize(payload, options = {}) {
  const exclude = new Set(options.exclude || EXCLUDE_FIELDS);
  const pairs = new Map();

  const collect = (source) => {
    for (const [key, value] of Object.entries(source || {})) {
      if (exclude.has(key)) continue;
      if (value === undefined || value === null) continue;
      if (typeof value === 'object') continue;

      const text = String(value);
      // "If the value of a parameter is empty, the parameter is not involved
      // in the signature."
      if (text === '') continue;

      pairs.set(key, text);
    }
  };

  collect(payload);
  collect(payload && payload.biz_content);

  return [...pairs.keys()]
    .sort()
    .map((key) => `${key}=${pairs.get(key)}`)
    .join('&');
}

function signText(text, privateKey, options = {}) {
  const { padding = DEFAULT_PADDING, signType = SIGN_TYPE } = options;

  return crypto
    .sign(hashFor(signType), Buffer.from(text, 'utf8'), {
      key: privateKey,
      padding: paddingFor(padding)
    })
    .toString('base64');
}

function signPayload(payload, privateKey, options = {}) {
  if (!privateKey) throw new Error('A private key is required to sign a request.');
  return signText(canonicalize(payload), privateKey, options);
}

function verifyPayload(payload, publicKey, options = {}) {
  const { padding = DEFAULT_PADDING, signType = SIGN_TYPE } = options;
  const signature = payload && payload.sign;

  if (!signature) return false;
  if (!publicKey) throw new Error('A public key is required to verify a signature.');

  return crypto.verify(
    hashFor(signType),
    Buffer.from(canonicalize(payload), 'utf8'),
    { key: publicKey, padding: paddingFor(padding) },
    Buffer.from(signature, 'base64')
  );
}

/** Return a copy of `payload` with `sign` and `sign_type` attached. */
function withSignature(payload, privateKey, options = {}) {
  const signType = options.signType || SIGN_TYPE;

  return {
    ...payload,
    sign: signPayload(payload, privateKey, options),
    sign_type: signType
  };
}

module.exports = {
  SIGN_TYPE,
  DEFAULT_PADDING,
  EXCLUDE_FIELDS,
  canonicalize,
  signText,
  signPayload,
  verifyPayload,
  withSignature
};
