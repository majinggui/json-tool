import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import SaxonJS from 'saxon-js';

const execFileAsync = promisify(execFile);

// ─── 内存缓存（按 xsl 内容 hash） ───
// 函数实例在 Vercel 上是"warm"的，多次请求共享同一个进程，缓存有效
const sefCache = new Map();
const MAX_CACHE_SIZE = 50;

function hashXsl(xsl) {
  return createHash('sha256').update(xsl).digest('hex').slice(0, 16);
}

function cacheGet(key) {
  const hit = sefCache.get(key);
  if (hit) {
    // LRU：命中后重新放到末尾
    sefCache.delete(key);
    sefCache.set(key, hit);
  }
  return hit;
}

function cacheSet(key, value) {
  if (sefCache.size >= MAX_CACHE_SIZE) {
    // 删除最老的
    const firstKey = sefCache.keys().next().value;
    sefCache.delete(firstKey);
  }
  sefCache.set(key, value);
}

// ─── 预先解析 xslt3 bin 路径（模块加载时执行一次） ───
const XSLT3_BIN = join(process.cwd(), 'node_modules', '.bin', 'xslt3');
// 公共临时工作目录（复用，避免每次创建/删除）
const SHARED_WORK_DIR = join(tmpdir(), 'xslt-shared');
let workDirReady = null;
async function ensureWorkDir() {
  if (!workDirReady) {
    workDirReady = mkdir(SHARED_WORK_DIR, { recursive: true });
  }
  return workDirReady;
}

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '只支持 POST 请求' });

  const { xsl, source } = req.body;
  if (!xsl)    return res.status(400).json({ error: '缺少 xsl 参数' });
  if (!source) return res.status(400).json({ error: '缺少 source 参数' });

  const t0 = Date.now();

  try {
    const xslHash = hashXsl(xsl);
    let sefText = cacheGet(xslHash);
    let cached = !!sefText;

    if (!sefText) {
      // 未命中缓存，编译
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

      // 清理单次文件（SEF 已经在缓存里，不需要保留）
      try { await rm(xslPath, { force: true }); } catch {}
      try { await rm(sefPath, { force: true }); } catch {}
    }

    const compileTime = Date.now() - t0;

    // 执行转换
    const output = await SaxonJS.transform({
      stylesheetText: sefText,
      sourceText: source,
      sourceType: 'xml',
      destination: 'serialized',
    }, 'async');

    const totalTime = Date.now() - t0;

    return res.status(200).json({
      result: output.principalResult,
      _meta: {
        cached,
        compileMs: compileTime,
        totalMs: totalTime,
      }
    });

  } catch (err) {
    console.error('XSLT 错误:', err);
    let msg = err.message || '转换失败';
    if (err.stderr) msg = err.stderr.toString().slice(0, 500);
    else if (err.stdout) msg = err.stdout.toString().slice(0, 500);
    return res.status(500).json({ error: msg });
  }
}


