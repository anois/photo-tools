(function (global) {
  'use strict';

  const VENDOR_SRC = 'vendor/aws4fetch.js';
  let loadingPromise = null;

  function ensureLoaded() {
    if (global.aws4fetch && global.aws4fetch.AwsClient) return Promise.resolve();
    if (loadingPromise) return loadingPromise;
    loadingPromise = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = VENDOR_SRC;
      s.async = true;
      s.onload = function () {
        if (global.aws4fetch && global.aws4fetch.AwsClient) resolve();
        else reject(new Error('aws4fetch loaded but AwsClient missing'));
      };
      s.onerror = function () { reject(new Error('failed to load ' + VENDOR_SRC)); };
      document.head.appendChild(s);
    });
    return loadingPromise;
  }

  // Compute the bucket-scope base URL from provider hints. The user can override
  // by editing the endpoint field directly; this helper just produces a sane
  // default whenever provider/region/bucket are present.
  function resolveEndpoint(provider, region, bucket, accountId) {
    const b = (bucket || '').trim();
    const r = (region || '').trim();
    const a = (accountId || '').trim();
    if (provider === 'aws') {
      if (!b || !r) return '';
      return 'https://' + b + '.s3.' + r + '.amazonaws.com/';
    }
    if (provider === 'r2') {
      if (!a || !b) return '';
      return 'https://' + a + '.r2.cloudflarestorage.com/' + b + '/';
    }
    if (provider === 'aliyun') {
      if (!b || !r) return '';
      // OSS S3-compatible host; bucket in virtual-host style works in S3-compat mode.
      return 'https://' + b + '.oss-' + r + '.aliyuncs.com/';
    }
    return '';
  }

  function signingRegion(provider, region) {
    if (provider === 'r2') return 'auto';
    if (provider === 'aliyun') {
      // Aliyun OSS expects the bare region token (e.g. 'cn-hangzhou'); strip the
      // 'oss-' prefix users sometimes paste in from their console.
      return (region || '').replace(/^oss-/, '') || 'cn-hangzhou';
    }
    return region || 'us-east-1';
  }

  function joinUrl(endpoint, key) {
    let base = (endpoint || '').trim();
    if (!base) throw new Error('CloudS3: endpoint is empty');
    if (!base.endsWith('/')) base += '/';
    const encoded = String(key).split('/').map(encodeURIComponent).join('/');
    return base + encoded;
  }

  function listUrl(endpoint, prefix, maxKeys, continuationToken) {
    let base = (endpoint || '').trim();
    if (!base) throw new Error('CloudS3: endpoint is empty');
    if (!base.endsWith('/')) base += '/';
    const params = new URLSearchParams();
    params.set('list-type', '2');
    if (prefix) params.set('prefix', prefix);
    if (maxKeys != null) params.set('max-keys', String(maxKeys));
    if (continuationToken) params.set('continuation-token', continuationToken);
    return base + '?' + params.toString();
  }

  function buildClient(config) {
    if (!global.aws4fetch || !global.aws4fetch.AwsClient) {
      throw new Error('CloudS3: aws4fetch not loaded — call ensureLoaded() first');
    }
    return new global.aws4fetch.AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: 's3',
      region: signingRegion(config.provider, config.region)
    });
  }

  async function putObject(client, endpoint, key, blob, opts) {
    const url = joinUrl(endpoint, key);
    const headers = { 'Content-Type': (blob && blob.type) || 'application/octet-stream' };
    if (opts && opts.cacheControl) headers['Cache-Control'] = opts.cacheControl;
    const res = await client.fetch(url, { method: 'PUT', body: blob, headers });
    if (!res.ok) throw new Error('PUT ' + key + ' failed: ' + res.status + ' ' + res.statusText);
    return { etag: res.headers.get('etag') || '' };
  }

  async function getObject(client, endpoint, key) {
    const url = joinUrl(endpoint, key);
    const res = await client.fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error('GET ' + key + ' failed: ' + res.status + ' ' + res.statusText);
    const blob = await res.blob();
    const lastModified = res.headers.get('last-modified');
    return {
      blob,
      lastModified: lastModified ? Date.parse(lastModified) || Date.now() : Date.now(),
      contentType: res.headers.get('content-type') || blob.type || 'application/octet-stream'
    };
  }

  async function deleteObject(client, endpoint, key) {
    const url = joinUrl(endpoint, key);
    const res = await client.fetch(url, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      throw new Error('DELETE ' + key + ' failed: ' + res.status + ' ' + res.statusText);
    }
  }

  function parseListXml(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error('CloudS3: list response is not valid XML');
    const items = [];
    const contents = doc.getElementsByTagName('Contents');
    for (let i = 0; i < contents.length; i++) {
      const el = contents[i];
      const key = el.getElementsByTagName('Key')[0]?.textContent || '';
      const size = parseInt(el.getElementsByTagName('Size')[0]?.textContent || '0', 10);
      const lastModifiedText = el.getElementsByTagName('LastModified')[0]?.textContent || '';
      const etag = (el.getElementsByTagName('ETag')[0]?.textContent || '').replace(/^"|"$/g, '');
      items.push({
        key,
        size,
        lastModified: lastModifiedText ? Date.parse(lastModifiedText) || 0 : 0,
        etag
      });
    }
    const truncated = doc.getElementsByTagName('IsTruncated')[0]?.textContent === 'true';
    const nextToken = doc.getElementsByTagName('NextContinuationToken')[0]?.textContent || '';
    return { items, truncated, nextToken };
  }

  async function listObjects(client, endpoint, prefix, opts) {
    const maxKeys = (opts && opts.maxKeys) || 1000;
    const all = [];
    let token = '';
    let pages = 0;
    const pageLimit = (opts && opts.pageLimit) || 10;
    while (pages < pageLimit) {
      const url = listUrl(endpoint, prefix, maxKeys, token);
      const res = await client.fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error('LIST failed: ' + res.status + ' ' + res.statusText);
      const xml = await res.text();
      const page = parseListXml(xml);
      all.push.apply(all, page.items);
      if (!page.truncated || !page.nextToken) break;
      token = page.nextToken;
      pages++;
    }
    return all;
  }

  // Normalize a config object: trim every string, prune empty extras. Used both
  // for save-to-localStorage and for building share codes.
  function normalizeConfig(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {
      v: 1,
      provider: raw.provider || 'aws',
      endpoint: (raw.endpoint || '').trim(),
      region: (raw.region || '').trim(),
      bucket: (raw.bucket || '').trim(),
      prefix: (raw.prefix || '').trim().replace(/^\/+|\/+$/g, ''),
      accountId: (raw.accountId || '').trim(),
      accessKeyId: (raw.accessKeyId || '').trim(),
      secretAccessKey: (raw.secretAccessKey || '').trim()
    };
    return out;
  }

  function isUsable(cfg) {
    if (!cfg) return false;
    return !!(cfg.endpoint && cfg.accessKeyId && cfg.secretAccessKey);
  }

  // Generate a 480px-long-edge JPEG thumbnail Blob for gallery preview tiles.
  async function makeThumb(fileOrBlob, maxEdge) {
    const edge = maxEdge || 480;
    const bm = await createImageBitmap(fileOrBlob);
    try {
      const longEdge = Math.max(bm.width, bm.height);
      const scale = Math.min(1, edge / Math.max(1, longEdge));
      const w = Math.max(1, Math.round(bm.width * scale));
      const h = Math.max(1, Math.round(bm.height * scale));
      const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement('canvas'), { width: w, height: h });
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bm, 0, 0, w, h);
      if (canvas.convertToBlob) {
        return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
      }
      return await new Promise(function (resolve, reject) {
        canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('toBlob null')); }, 'image/jpeg', 0.7);
      });
    } finally {
      if (bm.close) bm.close();
    }
  }

  // Translate a CORS or DNS failure into a hint the user can act on. fetch() in
  // the browser doesn't distinguish CORS misses from network failures — both
  // surface as a generic TypeError — so we annotate by context.
  function describeError(err) {
    const msg = (err && err.message) || String(err);
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
      return 'network/CORS — likely the bucket CORS rules do not allow this origin, or the endpoint is wrong';
    }
    return msg;
  }

  function encodeShareCode(cfg) {
    const payload = normalizeConfig(cfg);
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeShareCode(code) {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (parsed.v !== 1) throw new Error('CloudS3: unsupported share-code version');
    return normalizeConfig(parsed);
  }

  global.CloudS3 = {
    ensureLoaded,
    resolveEndpoint,
    signingRegion,
    buildClient,
    putObject,
    getObject,
    deleteObject,
    listObjects,
    normalizeConfig,
    isUsable,
    makeThumb,
    describeError,
    encodeShareCode,
    decodeShareCode
  };
})(typeof window !== 'undefined' ? window : globalThis);
