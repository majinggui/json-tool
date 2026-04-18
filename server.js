import express from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import SaxonJS from 'saxon-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname)); // 托管静态文件

const execFileAsync = promisify(execFile);

// ─── 内存缓存 ───
const sefCache = new Map();
const MAX_CACHE_SIZE = 50;

function hashXsl(xsl) {
  return createHash('sha256').update(xsl).digest('hex').slice(0, 16);
}

function cacheGet(key) {
  const hit = sefCache.get(key);
  if (hit) {
    sefCache.delete(key);
    sefCache.set(key, hit);
  }
  return hit;
}

function cacheSet(key, value) {
  if (sefCache.size >= MAX_CACHE_SIZE) {
    const firstKey = sefCache.keys().next().value;
    sefCache.delete(firstKey);
  }
  sefCache.set(key, value);
}

// ─── 预先解析 xslt3 bin 路径 ───
const XSLT3_BIN = join(__dirname, 'node_modules', '.bin', 'xslt3');
const SHARED_WORK_DIR = join(tmpdir(), 'xslt-shared');

async function ensureWorkDir() {
  await mkdir(SHARED_WORK_DIR, { recursive: true });
}

// API 路由
app.post('/api/compile', async (req, res) => {
  const { xsl, source } = req.body;
  if (!xsl || !source) return res.status(400).json({ error: '缺少参数' });

  const t0 = Date.now();
  try {
    const xslHash = hashXsl(xsl);
    let sefText = cacheGet(xslHash);
    let cached = !!sefText;

    if (!sefText) {
      await ensureWorkDir();
      const xslPath = join(SHARED_WORK_DIR, `${xslHash}.xsl`);
      const sefPath = join(SHARED_WORK_DIR, `${xslHash}.sef.json`);

      await writeFile(xslPath, xsl, 'utf8');
      await execFileAsync(XSLT3_BIN, [
        `-xsl:${xslPath}`,
        `-export:${sefPath}`,
        '-nogo'
      ], { timeout: 20000 });

      sefText = await readFile(sefPath, 'utf8');
      cacheSet(xslHash, sefText);

      try { await rm(xslPath, { force: true }); } catch {}
      try { await rm(sefPath, { force: true }); } catch {}
    }

    const output = await SaxonJS.transform({
      stylesheetText: sefText,
      sourceText: source,
      sourceType: 'xml',
      destination: 'serialized',
    }, 'async');

    return res.status(200).json({
      result: output.principalResult,
      _meta: { cached, totalMs: Date.now() - t0 }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 所有其他请求返回 index.html
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
