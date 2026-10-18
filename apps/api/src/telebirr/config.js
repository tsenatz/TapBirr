'use strict';

const { requireEnv, optionalEnv, boolEnv, intEnv, pemEnv } = require('../config/env');
const signature = require('./signature');

const BASE_URLS = {
  sandbox: 'https://developerportal.ethiotelebirr.et:38443/apiaccess/payment/gateway',
  production: 'https://superapp.ethiomobilemoney.et:38443/apiaccess/payment/gateway'
};

const WEB_CHECKOUT_URLS = {
  sandbox: 'https://developerportal.ethiotelebirr.et:38443/payment/web/h5/paygate?',
  production: 'https://superapp.ethiomobilemoney.et:38443/payment/web/h5/paygate?'
};

function resolve(environment, lookup, key) {
  return optionalEnv(key, lookup[environment] || lookup.sandbox);
}

function build() {
  const environment = optionalEnv('TELEBIRR_ENV', 'sandbox');

  if (!Object.hasOwn(BASE_URLS, environment)) {
    throw new Error(
      `TELEBIRR_ENV must be one of ${Object.keys(BASE_URLS).join(', ')} (got "${environment}").`
    );
  }

  return Object.freeze({
    environment,
    baseUrl: resolve(environment, BASE_URLS, 'TELEBIRR_BASE_URL'),
    webBaseUrl: resolve(environment, WEB_CHECKOUT_URLS, 'TELEBIRR_WEB_BASE_URL'),

    // Fabric portal (Ethio Telecom) application identity.
    fabricAppId: requireEnv('TELEBIRR_X_APP_KEY'),
    appSecret: requireEnv('TELEBIRR_APP_SECRET'),

    // Merchant identity, registered against the fabric application.
    merchantAppId: requireEnv('TELEBIRR_APP_ID'),
    merchantCode: requireEnv('TELEBIRR_MERCH_CODE'),

    // The public key matching this private key must be registered with the SP.
    privateKey: pemEnv('TELEBIRR_PRIVATE_KEY', { base64EnvName: 'TELEBIRR_PRIVATE_KEY_BASE64' }),
    publicKey: pemEnv('TELEBIRR_PUBLIC_KEY', { base64EnvName: 'TELEBIRR_PUBLIC_KEY_BASE64' }),

    // Defaults for order creation; overridable per call.
    notifyUrl: optionalEnv('TELEBIRR_NOTIFY_URL', 'https://example.com/api/payments/callback'),
    redirectUrl: optionalEnv('TELEBIRR_REDIRECT_URL', 'https://example.com/payments/return'),
    tradeType: optionalEnv('TELEBIRR_TRADE_TYPE', 'WebCheckout'),
    currency: optionalEnv('TELEBIRR_CURRENCY', 'ETB'),
    timeoutExpress: optionalEnv('TELEBIRR_TIMEOUT_EXPRESS', '120m'),
    businessType: optionalEnv('TELEBIRR_BUSINESS_TYPE', 'TransferToOtherOrg'),

    // "pkcs1" (RSASSA-PKCS1-v1_5) or "pss". See docs/telebirr.md#signature-padding.
    signPadding: optionalEnv('TELEBIRR_SIGN_PADDING', signature.DEFAULT_PADDING),

    // The sandbox chain is missing its intermediate, so verification fails locally.
    tlsInsecure: boolEnv('TELEBIRR_TLS_INSECURE', true),
    timeoutMs: intEnv('TELEBIRR_TIMEOUT_MS', 30000)
  });
}

module.exports = {
  config: build,
  BASE_URLS,
  WEB_CHECKOUT_URLS
};
