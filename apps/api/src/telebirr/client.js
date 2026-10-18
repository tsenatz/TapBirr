'use strict';

const crypto = require('crypto');

const { requestJson } = require('./http');
const signature = require('./signature');

const TOKEN_PATH = '/payment/v1/token';
const PREORDER_PATH = '/payment/v1/merchant/preOrder';
const QUERY_ORDER_PATH = '/payment/v1/merchant/queryOrder';

const FIXED_VERSION = '1.0';

/** Gateway error envelope, returned with HTTP 200 on rejected requests. */
class TelebirrError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'TelebirrError';
    this.errorCode = details.errorCode;
    this.errorMsg = details.errorMsg;
    this.statusCode = details.statusCode;
    this.payload = details.payload;
  }
}

let tokenCache = null;

function createNonceStr() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

function createTimestamp() {
  return String(Math.floor(Date.now() / 1000));
}

/** `yyyyMMddHHmmss`, interpreted as UTC, minus a safety margin. */
function parseExpiry(expirationDate, marginMs = 60000) {
  if (!/^\d{14}$/.test(expirationDate || '')) return 0;

  const iso = `${expirationDate.slice(0, 4)}-${expirationDate.slice(4, 6)}-${expirationDate.slice(
    6,
    8
  )}T${expirationDate.slice(8, 10)}:${expirationDate.slice(10, 12)}:${expirationDate.slice(
    12,
    14
  )}Z`;

  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed - marginMs;
}

function unwrap(result, context) {
  if (result.json === undefined) {
    throw new TelebirrError(
      `${context} returned a non-JSON response (HTTP ${result.statusCode}).`,
      { statusCode: result.statusCode, payload: result.text }
    );
  }

  const body = result.json;

  // Fabric-layer rejections (bad app key/secret) use a different envelope.
  if (body.errorCode) {
    throw new TelebirrError(`${context} rejected: ${body.errorMsg || body.errorCode}`, {
      errorCode: body.errorCode,
      errorMsg: body.errorMsg,
      statusCode: result.statusCode,
      payload: body
    });
  }

  // Application-layer rejections carry result: "FAIL" with a business code.
  if (body.result && String(body.result).toUpperCase() !== 'SUCCESS') {
    throw new TelebirrError(`${context} failed (code ${body.code}): ${body.msg || 'no message'}`, {
      errorCode: body.code,
      errorMsg: body.msg,
      statusCode: result.statusCode,
      payload: body
    });
  }

  if (typeof body.code !== 'undefined' && String(body.code) !== '0') {
    throw new TelebirrError(`${context} failed (code ${body.code}): ${body.msg || 'no message'}`, {
      errorCode: body.code,
      errorMsg: body.msg,
      statusCode: result.statusCode,
      payload: body
    });
  }

  return body;
}

function signOptions(config) {
  return { padding: config.signPadding };
}

/**
 * Exchange appSecret for a short-lived fabric token. Cached until shortly
 * before `expirationDate`.
 */
async function applyFabricToken(config, { force = false } = {}) {
  if (!force && tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.value;

  const result = await requestJson(`${config.baseUrl}${TOKEN_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-APP-Key': config.fabricAppId
    },
    body: JSON.stringify({ appSecret: config.appSecret }),
    timeoutMs: config.timeoutMs,
    tlsInsecure: config.tlsInsecure
  });

  const body = unwrap(result, 'applyFabricToken');

  if (!body.token) {
    throw new TelebirrError('applyFabricToken succeeded but returned no token.', {
      statusCode: result.statusCode,
      payload: body
    });
  }

  tokenCache = {
    value: body,
    expiresAt: parseExpiry(body.expirationDate)
  };

  return body;
}

function resetTokenCache() {
  tokenCache = null;
}

function buildCreateOrderPayload(config, order = {}) {
  const {
    merchOrderId = crypto.randomBytes(8).toString('hex'),
    title = 'TapBirr test order',
    totalAmount,
    notifyUrl = config.notifyUrl,
    redirectUrl = config.redirectUrl,
    tradeType = config.tradeType,
    transCurrency = config.currency,
    timeoutExpress = config.timeoutExpress,
    businessType = config.businessType,
    callbackInfo
  } = order;

  if (totalAmount === undefined || totalAmount === null || totalAmount === '') {
    throw new Error('totalAmount is required to create an order.');
  }

  const bizContent = {
    appid: config.merchantAppId,
    merch_code: config.merchantCode,
    merch_order_id: String(merchOrderId),
    title: String(title),
    total_amount: String(totalAmount),
    trans_currency: transCurrency,
    timeout_express: timeoutExpress,
    business_type: businessType,
    trade_type: tradeType,
    notify_url: notifyUrl
  };

  if (redirectUrl) bizContent.redirect_url = redirectUrl;
  if (callbackInfo) bizContent.callback_info = callbackInfo;

  return signature.withSignature(
    {
      method: 'payment.preorder',
      version: FIXED_VERSION,
      timestamp: createTimestamp(),
      nonce_str: createNonceStr(),
      biz_content: bizContent
    },
    config.privateKey,
    signOptions(config)
  );
}

/**
 * Create a prepaid order. Resolves to `{ merchOrderId, prepayId, raw }`.
 */
async function createOrder(config, order = {}) {
  const payload = buildCreateOrderPayload(config, order);

  const token = await applyFabricToken(config);

  const result = await requestJson(`${config.baseUrl}${PREORDER_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-APP-Key': config.fabricAppId,
      Authorization: token.token
    },
    body: JSON.stringify(payload),
    timeoutMs: config.timeoutMs,
    tlsInsecure: config.tlsInsecure
  });

  const body = unwrap(result, 'requestCreateOrder');
  const biz = body.biz_content || {};

  if (!biz.prepay_id) {
    throw new TelebirrError('requestCreateOrder succeeded but returned no prepay_id.', {
      statusCode: result.statusCode,
      payload: body
    });
  }

  return {
    merchOrderId: biz.merch_order_id || (payload.biz_content && payload.biz_content.merch_order_id),
    prepayId: biz.prepay_id,
    request: payload,
    response: body
  };
}

/** Reconcile an order whose callback never arrived. */
async function queryOrder(config, merchOrderId) {
  const token = await applyFabricToken(config);

  const payload = signature.withSignature(
    {
      method: 'payment.queryorder',
      version: FIXED_VERSION,
      timestamp: createTimestamp(),
      nonce_str: createNonceStr(),
      biz_content: {
        appid: config.merchantAppId,
        merch_code: config.merchantCode,
        merch_order_id: String(merchOrderId)
      }
    },
    config.privateKey,
    signOptions(config)
  );

  const result = await requestJson(`${config.baseUrl}${QUERY_ORDER_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-APP-Key': config.fabricAppId,
      Authorization: token.token
    },
    body: JSON.stringify(payload),
    timeoutMs: config.timeoutMs,
    tlsInsecure: config.tlsInsecure
  });

  return unwrap(result, 'queryOrder');
}

/**
 * Build the browser redirect URL the payer is sent to. The `rawRequest` query
 * string is signed independently of the create-order body.
 */
function createCheckoutUrl(config, prepayId) {
  const params = signature.withSignature(
    {
      appid: config.merchantAppId,
      merch_code: config.merchantCode,
      nonce_str: createNonceStr(),
      prepay_id: prepayId,
      timestamp: createTimestamp()
    },
    config.privateKey,
    signOptions(config)
  );

  const rawRequest = [
    `appid=${params.appid}`,
    `merch_code=${params.merch_code}`,
    `nonce_str=${params.nonce_str}`,
    `prepay_id=${params.prepay_id}`,
    `timestamp=${params.timestamp}`,
    `sign=${encodeURIComponent(params.sign)}`,
    `sign_type=${params.sign_type}`
  ].join('&');

  return `${config.webBaseUrl}${rawRequest}&version=${FIXED_VERSION}&trade_type=${config.tradeType}`;
}

/** Verify the gateway's signature on an async notification callback. */
function verifyCallback(callbackBody, config) {
  return signature.verifyPayload(callbackBody, config.publicKey, signOptions(config));
}

module.exports = {
  TelebirrError,
  TOKEN_PATH,
  PREORDER_PATH,
  QUERY_ORDER_PATH,
  createNonceStr,
  createTimestamp,
  parseExpiry,
  applyFabricToken,
  resetTokenCache,
  buildCreateOrderPayload,
  createOrder,
  queryOrder,
  createCheckoutUrl,
  verifyCallback
};
