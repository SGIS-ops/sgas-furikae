// Code.gs を Node 上で動かすための Google Apps Script の簡易モック（テスト専用）
// SpreadsheetApp / LockService / CacheService / PropertiesService / Utilities / ContentService / Logger を再現する
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

function createSheet(name) {
  let data = [];
  const sheet = {
    name,
    hidden: false,
    getName: () => name,
    getLastRow: () => data.length,
    clearContents: () => {
      data = [];
    },
    hideSheet: () => {
      sheet.hidden = true;
    },
    setFrozenRows: () => {},
    getRange: (row, col, numRows = 1, numCols = 1) => ({
      getValues: () =>
        Array.from({ length: numRows }, (_, i) =>
          Array.from({ length: numCols }, (_, j) => (data[row - 1 + i] || [])[col - 1 + j] ?? '')
        ),
      setValues: (values) => {
        values.forEach((r, i) => {
          data[row - 1 + i] = data[row - 1 + i] || [];
          r.forEach((v, j) => {
            if (typeof v === 'string' && v.length > 50000) throw new Error('セルの上限（5万文字）を超えています');
            data[row - 1 + i][col - 1 + j] = v;
          });
        });
      }
    }),
    getDataRange: () => ({ getValues: () => data.map((r) => [...r]) }),
    // テスト用
    _data: () => data,
    _set: (rows) => {
      data = rows.map((r) => [...r]);
    }
  };
  return sheet;
}

function createRuntime(codePath = path.join(__dirname, '..', 'dist', 'Code.gs')) {
  const sheets = new Map();
  const cache = new Map();
  const props = new Map();
  const spreadsheet = {
    getSheetByName: (n) => sheets.get(n) || null,
    insertSheet: (n) => {
      const s = createSheet(n);
      sheets.set(n, s);
      return s;
    },
    getUrl: () => 'https://docs.google.com/spreadsheets/d/TEST/edit'
  };
  const context = {
    console,
    Date,
    JSON,
    Math,
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    CacheService: {
      getScriptCache: () => ({
        put: (k, v) => cache.set(k, v),
        get: (k) => (cache.has(k) ? cache.get(k) : null)
      })
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props.has(k) ? props.get(k) : null),
        setProperty: (k, v) => props.set(k, v)
      })
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      getUuid: () => crypto.randomUUID(),
      computeDigest: (alg, text) => Array.from(crypto.createHash(alg).update(text, 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b))
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ setMimeType: () => ({ getContent: () => text }) })
    },
    Logger: { log: () => {} }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(codePath, 'utf8'), context, { filename: 'Code.gs' });

  return {
    context,
    sheets,
    props,
    cache,
    /** ブラウザからの POST と同じ形で呼ぶ */
    post: (body) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(body) } }).getContent()),
    run: (fnName) => context[fnName]()
  };
}

module.exports = { createRuntime };
