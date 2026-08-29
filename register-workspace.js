#!/usr/bin/env node
// 普通模式（非 admin）下的 DSH 工作区自动登记脚本：
// 设置 DSH_WORKSPACE 后，DSH 就绪时由 entrypoint.sh 调用本脚本，把该目录登记为工作区，
// 使其直接出现在 DSH 网页的工作区列表里（新建会话/文件默认都在该目录下，不再落在 /root）。
// 幂等：已登记过则复用，不影响既有会话/文件；任何失败只打印警告，不影响 DSH 运行。
const fs = require('fs');

const DSH_PORT = Number(process.env.DSH_PORT) || 3079;
const DSH_WORKSPACE = process.env.DSH_WORKSPACE || '';
const DSH_LOG = process.env.DSH_LOG_FILE || '/tmp/dsh-startup.log';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// dsh web 启动时会打印 `dsh web: http://127.0.0.1:<port>/?token=<launchToken>`，
// 从启动日志里提取该启动令牌（登录鉴权用，进程内随机生成、不持久化）。
async function waitForToken(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const log = fs.readFileSync(DSH_LOG, 'utf8');
      const m = /\?token=([A-Za-z0-9_-]+)/.exec(log) || /\btoken=([A-Za-z0-9_-]+)/.exec(log);
      if (m) return m[1];
    } catch {}
    await sleep(250);
  }
  return null;
}

async function main() {
  if (!DSH_WORKSPACE) {
    console.log('[workspace] DSH_WORKSPACE 未设置，跳过工作区自动登记');
    return;
  }
  const base = `http://127.0.0.1:${DSH_PORT}`;
  try {
    // 1. 先无凭据直接调用 workspace.create：部分 DSH 版本回环访问 /api 无需浏览器会话 Cookie
    let result = await callCreate(base, undefined);
    if (result === 'need-auth') {
      // 2. 401 → 该版本需要浏览器会话 Cookie：从启动日志抓 ?token= 换取后再试
      const token = await waitForToken();
      if (!token) {
        console.warn('[workspace] 未捕获 DSH 启动令牌（启动日志里没有 ?token=），跳过工作区自动登记');
        return;
      }
      const authRes = await fetch(`${base}/?token=${token}`, { redirect: 'manual' });
      const setCookie = authRes.headers.get('set-cookie');
      if (!setCookie) {
        console.warn('[workspace] DSH 会话 Cookie 获取失败，跳过工作区自动登记');
        return;
      }
      result = await callCreate(base, setCookie.split(';')[0]);
    }
    if (result.ok === true) {
      const created = result.value && result.value.created === true;
      console.log(`[workspace] 工作区已登记: ${DSH_WORKSPACE}${created ? '（新建）' : '（复用）'}`);
    } else {
      console.warn(`[workspace] 工作区登记失败: ${result.error}`);
    }
  } catch (e) {
    console.warn(`[workspace] 工作区自动登记异常: ${e.message}`);
  }
}

// 调用 /api/workspace.create，返回 { ok, value?, error? }；401 时返回 'need-auth'
async function callCreate(base, cookie) {
  const headers = { 'content-type': 'application/json' };
  if (cookie !== undefined) headers.cookie = cookie;
  const res = await fetch(`${base}/api/workspace.create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `workspace-${Date.now()}`,
      method: 'workspace.create',
      payload: { path: DSH_WORKSPACE },
    }),
  });
  if (res.status === 401) return 'need-auth';
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch {}
  const result = body && body.result;
  if (res.ok && result && result.ok === true) return result;
  return {
    ok: false,
    error: (result && result.error && result.error.message) || text || `HTTP ${res.status}`,
  };
}

main();
