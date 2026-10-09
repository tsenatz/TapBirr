#!/usr/bin/env node
'use strict';

/**
 * Standalone Telebirr sandbox order check.
 *
 *   node scripts/create-order.js --amount 1.00 --title "Test order"
 *   node scripts/create-order.js --merch-order-id 1705460512562
 *
 * Walks the whole WebCheckout flow: fetch a fabric token, create a prepaid
 * order, print the signed request/response, and print the checkout URL. With
 * --merch-order-id it instead reconciles an existing order via queryOrder.
 */

const path = require('path');

const { config } = require(path.join(__dirname, '..', 'apps', 'api', 'src', 'telebirr', 'config'));
const telebirr = require(path.join(__dirname, '..', 'apps', 'api', 'src', 'telebirr', 'client'));
const { canonicalize } = require(path.join(
  __dirname,
  '..',
  'apps',
  'api',
  'src',
  'telebirr',
  'signature'
));

function parseArgs(argv) {
  const args = { amount: '1.00', title: 'TapBirr sandbox order', merchOrderId: undefined };

  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inlineValue] = argv[i].split('=');
    const value = inlineValue !== undefined ? inlineValue : argv[i + 1];
    const needsValue = () => {
      i += 1;
    };

    switch (flag) {
      case '--amount':
        args.amount = value;
        needsValue();
        break;
      case '--title':
        args.title = value;
        needsValue();
        break;
      case '--merch-order-id':
        args.merchOrderId = value;
        needsValue();
        break;
      default:
        break;
    }
  }

  return args;
}

function section(title) {
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let cfg;
  try {
    cfg = config();
  } catch (error) {
    console.error(`Configuration error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (!cfg.privateKey) {
    console.error('Configuration error: TELEBIRR_PRIVATE_KEY is not set (see .env.example).');
    process.exitCode = 1;
    return;
  }

  console.log(`Environment : ${cfg.environment}`);
  console.log(`Base URL    : ${cfg.baseUrl}`);
  console.log(`appid       : ${cfg.merchantAppId}`);
  console.log(`merch_code  : ${cfg.merchantCode}`);

  if (args.merchOrderId) {
    section('queryOrder (reconciliation)');
    const result = await telebirr.queryOrder(cfg, args.merchOrderId);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  section('1. applyFabricToken');
  const token = await telebirr.applyFabricToken(cfg, { force: true });
  console.log(`token        : ${token.token}`);
  console.log(`effectiveDate: ${token.effectiveDate}`);
  console.log(`expirationDate: ${token.expirationDate}`);

  section('2. requestCreateOrder');
  const order = await telebirr.createOrder(cfg, {
    title: args.title,
    totalAmount: args.amount
  });

  console.log('Signed request:');
  console.log(JSON.stringify(order.request, null, 2));
  console.log('\nString that was signed:');
  console.log(canonicalize(order.request));

  console.log('\nResponse:');
  console.log(JSON.stringify(order.response, null, 2));

  section('3. checkout URL');
  const checkoutUrl = telebirr.createCheckoutUrl(cfg, order.prepayId);
  console.log(`merch_order_id: ${order.merchOrderId}`);
  console.log(`prepay_id     : ${order.prepayId}`);
  console.log(`\nOpen this in a browser to pay:\n${checkoutUrl}`);

  console.log(
    `\nNext: the gateway will POST a callback to ${cfg.notifyUrl} ` +
      `with trade_status "Completed" once the payer confirms.`
  );
  console.log(`Reconcile later with: node scripts/create-order.js --merch-order-id ${order.merchOrderId}`);
}

main().catch((error) => {
  console.error(`\n${error.name}: ${error.message}`);
  if (error.errorCode) console.error(`  code: ${error.errorCode}`);
  if (error.payload) console.error(`  payload: ${JSON.stringify(error.payload, null, 2)}`);
  process.exitCode = 1;
});
