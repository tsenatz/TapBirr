'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { describe, it } = require('node:test');

const signature = require('../src/telebirr/signature');
const telebirr = require('../src/telebirr/client');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' }
});

/** The exact payload published in the docs' RequestSignatureProcess sample. */
const DOCS_PAYLOAD = {
  timestamp: '1755866911',
  nonce_str: 'H5QN4M6EAB2TXXVFK8SVV0RW6UFASICS',
  method: 'payment.preorder',
  version: '1.0',
  biz_content: {
    notify_url: 'https://www.google.com',
    appid: '1227484825753601',
    merch_code: '101011',
    merch_order_id: '1755866910890',
    trade_type: 'Checkout',
    title: 'diamond_1.5',
    total_amount: '1.5',
    trans_currency: 'ETB',
    timeout_express: '120m'
  }
};

const DOCS_CANONICAL =
  'appid=1227484825753601&merch_code=101011&merch_order_id=1755866910890&method=payment.preorder' +
  '&nonce_str=H5QN4M6EAB2TXXVFK8SVV0RW6UFASICS&notify_url=https://www.google.com' +
  '&timeout_express=120m&timestamp=1755866911&title=diamond_1.5&total_amount=1.5' +
  '&trade_type=Checkout&trans_currency=ETB&version=1.0';

/** rawRequest example published on the Development preparation page. */
const DOCS_RAW_REQUEST =
  'appid=1072905731584000&business_type=BuyGoods&merch_code=200001' +
  '&merch_order_id=201907161732001&method=payment.preorder' +
  '&nonce_str=fcab0d2949e64a69a212aa83eab6ee1d' +
  '&notify_url=http://test.payment.com/notify&redirect_url=http://test.payment.com/redirect' +
  '&timeout_express=120m&timestamp=1535166225&title=iphone1&total_amount=12' +
  '&trade_type=Checkout&trans_currency=ETB&version=1.0';

describe('canonicalize', () => {
  it('reproduces the canonical string from the docs sample', () => {
    assert.equal(signature.canonicalize(DOCS_PAYLOAD), DOCS_CANONICAL);
  });

  it('flattens biz_content into the top level', () => {
    assert.equal(
      signature.canonicalize({ method: 'payment.preorder', biz_content: { appid: '7' } }),
      'appid=7&method=payment.preorder'
    );
  });

  it('excludes signature and metadata fields', () => {
    const canonical = signature.canonicalize({
      appid: '7',
      sign: 'should-not-appear',
      sign_type: 'SHA256WithRSA',
      header: 'nope',
      refund_info: 'nope',
      openType: 'nope',
      raw_request: 'nope',
      wallet_reference_data: 'nope'
    });

    assert.equal(canonical, 'appid=7');
  });

  it('stringifies non-string scalars', () => {
    assert.equal(signature.canonicalize({ n: 42, flag: true }), 'flag=true&n=42');
  });

  it('skips nested objects so serialisation cannot drift', () => {
    assert.equal(signature.canonicalize({ a: '1', nested: { b: '2' } }), 'a=1');
  });

  it('orders keys by ASCII, uppercase before lowercase', () => {
    assert.equal(signature.canonicalize({ b: '1', A: '2', a: '3' }), 'A=2&a=3&b=1');
  });

  it('escapes nothing, matching the gateway verbatim', () => {
    assert.equal(
      signature.canonicalize({ notify_url: 'https://www.google.com' }),
      'notify_url=https://www.google.com'
    );
  });

  it('omits parameters whose value is empty', () => {
    assert.equal(
      signature.canonicalize({ appid: '7', redirect_url: '', merch_code: null }),
      'appid=7'
    );
  });

  it('reproduces the rawRequest example from Development preparation', () => {
    assert.equal(
      signature.canonicalize({
        method: 'payment.preorder',
        version: '1.0',
        timestamp: '1535166225',
        nonce_str: 'fcab0d2949e64a69a212aa83eab6ee1d',
        biz_content: {
          notify_url: 'http://test.payment.com/notify',
          redirect_url: 'http://test.payment.com/redirect',
          appid: '1072905731584000',
          business_type: 'BuyGoods',
          merch_code: '200001',
          merch_order_id: '201907161732001',
          timeout_express: '120m',
          title: 'iphone1',
          total_amount: '12',
          trade_type: 'Checkout',
          trans_currency: 'ETB'
        }
      }),
      DOCS_RAW_REQUEST
    );
  });

  it('treats parameter names as case-sensitive', () => {
    assert.equal(signature.canonicalize({ appid: '7', AppID: '9' }), 'AppID=9&appid=7');
  });
});

describe('sign / verify', () => {
  for (const padding of ['pkcs1', 'pss']) {
    it(`round-trips a signature with ${padding} padding`, () => {
      const signed = signature.withSignature(DOCS_PAYLOAD, privateKey, { padding });

      assert.equal(signed.sign_type, 'SHA256WithRSA');
      assert.equal(signed.biz_content, DOCS_PAYLOAD.biz_content);
      assert.equal(signature.verifyPayload(signed, publicKey, { padding }), true);
    });

    it(`rejects a tampered amount with ${padding} padding`, () => {
      const signed = signature.withSignature(DOCS_PAYLOAD, privateKey, { padding });
      const tampered = {
        ...signed,
        biz_content: { ...signed.biz_content, total_amount: '9999' }
      };

      assert.equal(signature.verifyPayload(tampered, publicKey, { padding }), false);
    });

    it(`rejects a tampered top-level field with ${padding} padding`, () => {
      const signed = signature.withSignature(DOCS_PAYLOAD, privateKey, { padding });

      assert.equal(
        signature.verifyPayload({ ...signed, timestamp: '1' }, publicKey, { padding }),
        false
      );
    });
  }

  it('produces base64 output within the documented 512-char limit', () => {
    const signed = signature.withSignature(DOCS_PAYLOAD, privateKey, { padding: 'pkcs1' });

    assert.ok(signed.sign.length <= 512, `sign was ${signed.sign.length} chars`);
    assert.equal(Buffer.from(signed.sign, 'base64').toString('base64'), signed.sign);
  });

  it('defaults to PSS padding, per the portal Interface Signing rules', () => {
    assert.equal(signature.DEFAULT_PADDING, 'pss');

    const signed = signature.withSignature(DOCS_PAYLOAD, privateKey);

    assert.equal(signature.verifyPayload(signed, publicKey), true);
    assert.equal(signature.verifyPayload(signed, publicKey, { padding: 'pkcs1' }), false);
  });

  it('does not sign the sign fields themselves', () => {
    const signed = signature.withSignature(DOCS_PAYLOAD, privateKey, { padding: 'pkcs1' });

    assert.ok(!signed.sign.includes('sign_type='));
  });
});

describe('callback verification', () => {
  it('accepts a signature produced over a flat notification body', () => {
    const notification = {
      appid: '853694808089634',
      merch_code: '245445',
      merch_order_id: '1670575560882',
      notify_time: '1670575472482',
      total_amount: '10.00',
      trans_currency: 'ETB',
      trans_id: '49485948475845',
      trade_status: 'Completed',
      trans_end_time: '1670575472000'
    };
    const signed = signature.withSignature(notification, privateKey, { padding: 'pkcs1' });

    assert.equal(signature.verifyPayload(signed, publicKey, { padding: 'pkcs1' }), true);
    assert.equal(
      signature.verifyPayload(
        { ...signed, trade_status: 'Failure' },
        publicKey,
        { padding: 'pkcs1' }
      ),
      false
    );
  });
});

describe('helpers', () => {
  it('generates a 32-character nonce', () => {
    assert.match(telebirr.createNonceStr(), /^[0-9A-F]{32}$/);
  });

  it('generates a 10-digit UTC timestamp in seconds', () => {
    const timestamp = telebirr.createTimestamp();

    assert.match(timestamp, /^\d{10}$/);
    assert.ok(Math.abs(Date.now() / 1000 - Number(timestamp)) < 5);
  });

  it('parses the yyyyMMddHHmmss token expiry as UTC', () => {
    assert.equal(telebirr.parseExpiry('20221101142422', 0), Date.UTC(2022, 10, 1, 14, 24, 22));
  });

  it('discards the sign when re-signing an already signed payload', () => {
    const signed = signature.withSignature(DOCS_PAYLOAD, privateKey, { padding: 'pkcs1' });
    const resigned = signature.withSignature(signed, privateKey, { padding: 'pkcs1' });

    assert.equal(signature.canonicalize(resigned), signature.canonicalize(DOCS_PAYLOAD));
  });
});

describe('buildCreateOrderPayload', () => {
  const config = {
    merchantAppId: '1227484825753601',
    merchantCode: '101011',
    privateKey,
    signPadding: 'pss',
    notifyUrl: 'https://example.com/api/payments/callback',
    redirectUrl: 'https://example.com/return',
    tradeType: 'WebCheckout',
    currency: 'ETB',
    timeoutExpress: '120m',
    businessType: 'TransferToOtherOrg'
  };

  it('builds a payload matching the documented schema', () => {
    const payload = telebirr.buildCreateOrderPayload(config, { totalAmount: '1.5' });

    assert.equal(payload.method, 'payment.preorder');
    assert.equal(payload.version, '1.0');
    assert.equal(payload.sign_type, 'SHA256WithRSA');
    assert.equal(payload.biz_content.total_amount, '1.5');
    assert.equal(payload.biz_content.appid, config.merchantAppId);
    assert.equal(payload.biz_content.merch_code, config.merchantCode);
    assert.equal(payload.biz_content.trade_type, 'WebCheckout');
    assert.equal(payload.biz_content.notify_url, config.notifyUrl);
    assert.match(payload.timestamp, /^\d{10}$/);
  });

  it('is verifiable with the matching public key', () => {
    const payload = telebirr.buildCreateOrderPayload(config, { totalAmount: '1.5' });

    assert.equal(signature.verifyPayload(payload, publicKey, { padding: 'pss' }), true);
  });

  it('preserves a caller-supplied merch_order_id', () => {
    const payload = telebirr.buildCreateOrderPayload(config, {
      totalAmount: '1',
      merchOrderId: 'order-123'
    });

    assert.equal(payload.biz_content.merch_order_id, 'order-123');
  });

  it('requires totalAmount', () => {
    assert.throws(() => telebirr.buildCreateOrderPayload(config, {}), /totalAmount is required/);
  });
});
