#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_STOCK_BASE_URL = 'https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService';
const DEFAULT_SECURITIES_PRODUCT_BASE_URL = 'https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService';
const DEFAULT_OPERATIONS = ['getETFPriceInfo', 'getSecuritiesPriceInfo', 'getStockPriceInfo'];

function parseDevVars(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function normalizeServiceKey(serviceKey) {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function getBeginBaseDate(daysBack = 120) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysBack);
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function redactServiceKeyInUrl(urlString) {
  const url = new URL(urlString);
  if (url.searchParams.has('serviceKey')) {
    url.searchParams.set('serviceKey', '***REDACTED***');
  }
  return url.toString();
}

function summarizeItems(rawItems) {
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  const sample = items.slice(0, 3).map((item) => ({
    basDt: item.basDt ?? null,
    srtnCd: item.srtnCd ?? null,
    itmsNm: item.itmsNm ?? null,
    mrktCtg: item.mrktCtg ?? null,
    clpr: item.clpr ?? null,
    vs: item.vs ?? null,
    fltRt: item.fltRt ?? null,
  }));
  return { count: items.length, sample };
}

async function callOperation({
  stockBaseUrl,
  securitiesProductBaseUrl,
  stockServiceKey,
  symbol,
  operation,
  beginBasDt,
}) {
  const baseUrl = operation === 'getETFPriceInfo'
    ? securitiesProductBaseUrl
    : stockBaseUrl;
  const serviceKey = stockServiceKey;
  if (!serviceKey) {
    return {
      operation,
      requestUrl: null,
      status: null,
      ok: false,
      header: { resultCode: 'NO_KEY', resultMsg: `${operation} service key is missing` },
      numOfRows: null,
      pageNo: null,
      totalCount: null,
      items: { count: 0, sample: [] },
    };
  }
  const url = new URL(`${baseUrl}/${operation}`);
  url.searchParams.set('serviceKey', normalizeServiceKey(serviceKey));
  url.searchParams.set('numOfRows', '100');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('resultType', 'json');
  url.searchParams.set('likeSrtnCd', symbol);
  url.searchParams.set('beginBasDt', beginBasDt);

  const response = await fetch(url.toString());
  const payload = await response.json().catch(() => null);

  const header = payload?.response?.header ?? null;
  const body = payload?.response?.body ?? null;
  const itemsSummary = summarizeItems(body?.items?.item);

  return {
    operation,
    requestUrl: redactServiceKeyInUrl(url.toString()),
    status: response.status,
    ok: response.ok,
    header,
    numOfRows: body?.numOfRows ?? null,
    pageNo: body?.pageNo ?? null,
    totalCount: body?.totalCount ?? null,
    items: itemsSummary,
  };
}

async function main() {
  const symbol = process.argv[2];
  const beginBasDtArg = process.argv[3];
  if (!symbol) {
    console.error('Usage: node ./scripts/fsc-quote-probe.mjs <symbol>');
    process.exit(1);
  }

  const apiDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const envFile = path.join(apiDir, '.dev.vars');
  const devEnv = parseDevVars(envFile);
  const stockServiceKey = process.env.FSC_STOCK_API_SERVICE_KEY || devEnv.FSC_STOCK_API_SERVICE_KEY;
  const stockBaseUrl =
    process.env.FSC_STOCK_API_BASE_URL ||
    devEnv.FSC_STOCK_API_BASE_URL ||
    DEFAULT_STOCK_BASE_URL;
  const securitiesProductBaseUrl =
    process.env.FSC_SECURITIES_PRODUCT_API_BASE_URL ||
    devEnv.FSC_SECURITIES_PRODUCT_API_BASE_URL ||
    DEFAULT_SECURITIES_PRODUCT_BASE_URL;

  if (!stockServiceKey) {
    console.error('FSC_STOCK_API_SERVICE_KEY is missing. Set it in apps/api/.dev.vars or env.');
    process.exit(1);
  }

  const beginBasDt = beginBasDtArg && /^\d{8}$/.test(beginBasDtArg)
    ? beginBasDtArg
    : getBeginBaseDate();

  const results = [];
  for (const operation of DEFAULT_OPERATIONS) {
    results.push(await callOperation({
      stockBaseUrl,
      securitiesProductBaseUrl,
      stockServiceKey,
      symbol,
      operation,
      beginBasDt,
    }));
  }

  console.log(JSON.stringify({
    symbol,
    checkedAt: new Date().toISOString(),
    beginBasDt,
    stockBaseUrl,
    securitiesProductBaseUrl,
    stockKeyConfigured: Boolean(stockServiceKey),
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error('Probe failed:', error);
  process.exit(1);
});
