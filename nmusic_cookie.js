/**************************************
 * 网易云音乐人 —— 获取 Cookie（修复版）
 * 原脚本作者：@leiyiyan
 * 修复目标：QuantumultX（圈X）上抓不到 CK
 *
 * ============ 原版为什么在圈X抓不到 ============
 * 1) 重写类型用的是 `script-request-body`。
 *    该类型在「请求没有 body / body 不是可解析文本」时不会触发，
 *    而脚本实际只需要 header。改用 `script-request-header` 才稳定触发。
 *
 * 2) `$done()` 只写在 if 分支里。
 *    一旦 `Netease_Musician_Cookie` 已有值，脚本什么都不做且**永不调用 $done**，
 *    圈X 会把这条请求一直挂起到超时。
 *
 * 3) 死锁逻辑：`if (!$.getdata(...))` 表示「存过一次就永不再更新」。
 *    更糟的是原版不校验 cookie 是否为空——如果第一次抓取时
 *    `$request.headers["cookie"]` 是 undefined，会把字符串 "undefined"
 *    写进存储。此后该值恒为真值，脚本**永远不会再抓**，
 *    表现就是「怎么刷都没有反应、没有通知」。
 *
 * 4) header 取值只试了 "cookie" / "Cookie" 两种大小写。
 *
 * 5) 不校验登录态：未登录时的 cookie 也会被存进去，
 *    task.js 拿到后全部任务失败。
 *
 * ============ 本版改动 ============
 * - 任何分支都 `$done({})`，请求绝不挂起
 * - header 取值大小写不敏感
 * - 必须含 MUSIC_U 才写入（确认已登录）
 * - 允许覆盖更新，支持换账号；内容没变则静默跳过
 * - 60 秒通知节流，避免刷屏
 * - 清洗历史脏值（"undefined" / "null" / 空串）
 * - 兼容 QuantumultX / Loon / Surge / Stash / Shadowrocket
 *
 * ============ 圈X 配置（重点：script-request-header）============
 * [rewrite_local]
 * ^https?:\/\/music\.163\.com\/weapi\/(cloudbean\/records\/incomes|nmusician\/workbench\/mission\/cycle\/list) url script-request-header cookie.js
 *
 * [mitm]
 * hostname = music.163.com
 *
 * ============ Loon 配置 ============
 * [Script]
 * http-request ^https?:\/\/music\.163\.com\/weapi\/(cloudbean\/records\/incomes|nmusician\/workbench\/mission\/cycle\/list) script-path=cookie.js, requires-body=false, tag=网易云音乐人获取Cookie
 *
 * [MitM]
 * hostname = music.163.com
 *
 * ============ 抓取方法 ============
 * 网易云音乐 APP → 左上角菜单 → 创作者中心 → 音乐人中心
 * → 点「xxx云豆待使用」→ 顶部「收支记录」→ 等待通知提示获取成功
 ******************************************/

const NAME = "网易云音乐人";
const CK_KEY = "Netease_Musician_Cookie";
const UA_KEY = "Netease_Musician_UserAgent";
const TS_KEY = "Netease_Musician_Cookie_Ts";
const NOTIFY_THROTTLE_MS = 60 * 1000;

/* ---------- 运行环境 ---------- */
const isQX = typeof $task !== "undefined";
const hasStore = typeof $persistentStore !== "undefined";

function finish() {
  // 重写脚本必须放行请求，否则圈X会挂起直到超时
  if (typeof $done !== "undefined") $done({});
}

function readVal(key) {
  try {
    if (isQX) return $prefs.valueForKey(key);
    if (hasStore) return $persistentStore.read(key);
  } catch (e) {
    console.log(`[${NAME}] 读取 ${key} 失败: ${e}`);
  }
  return null;
}

function writeVal(val, key) {
  try {
    if (isQX) return $prefs.setValueForKey(val, key);
    if (hasStore) return $persistentStore.write(val, key);
  } catch (e) {
    console.log(`[${NAME}] 写入 ${key} 失败: ${e}`);
  }
  return false;
}

function notify(title, subtitle, body) {
  try {
    if (isQX) $notify(title, subtitle, body);
    else if (typeof $notification !== "undefined") $notification.post(title, subtitle, body);
  } catch (e) {
    console.log(`[${NAME}] 通知失败: ${e}`);
  }
  console.log(`${title}\n${subtitle}\n${body}`);
}

/* ---------- 工具 ---------- */

// 大小写不敏感读取请求头
function header(name) {
  const h = ($request && $request.headers) || {};
  const want = String(name).toLowerCase();
  for (const k in h) {
    if (String(k).toLowerCase() === want) return h[k] == null ? "" : String(h[k]);
  }
  return "";
}

// 清洗历史脏值：原版可能写入过字符串 "undefined"
function storedClean(key) {
  const v = readVal(key);
  if (v == null) return "";
  const s = String(v).trim();
  if (!s || s === "undefined" || s === "null") return "";
  return s;
}

// 从 cookie 串里取某个字段
function pick(ck, name) {
  const m = String(ck).match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return m ? m[1].trim() : "";
}

function mask(s) {
  const v = String(s);
  return v.length <= 16 ? v : `${v.slice(0, 8)}…${v.slice(-6)}`;
}

/* ---------- 主流程 ---------- */
!(() => {
  if (typeof $request === "undefined") {
    console.log(`[${NAME}] 未检测到 $request，本脚本只能作为「重写 / http-request」运行，不能当定时任务跑`);
    return finish();
  }

  const cookie = header("cookie").trim();
  const ua = header("user-agent").trim();

  if (!cookie) {
    console.log(`[${NAME}] 该请求没有 Cookie 头，跳过。URL: ${$request.url || ""}`);
    return finish();
  }

  const musicU = pick(cookie, "MUSIC_U");
  if (!musicU) {
    console.log(`[${NAME}] Cookie 中没有 MUSIC_U，判定为未登录，已跳过写入`);
    notify(NAME, "Cookie 获取失败 ❌", "抓到的 Cookie 里没有 MUSIC_U，请确认 APP 已登录后重新进入「收支记录」页面");
    return finish();
  }

  const oldCk = storedClean(CK_KEY);
  const oldMusicU = pick(oldCk, "MUSIC_U");

  if (cookie === oldCk) {
    console.log(`[${NAME}] Cookie 未变化，跳过写入`);
    return finish();
  }

  const okCk = writeVal(cookie, CK_KEY);
  if (ua) writeVal(ua, UA_KEY);

  if (!okCk) {
    notify(NAME, "Cookie 写入失败 ❌", "持久化存储写入失败，请检查代理软件的存储权限");
    return finish();
  }

  const isNewAccount = musicU !== oldMusicU;
  const lastTs = parseInt(storedClean(TS_KEY) || "0", 10) || 0;
  const now = Date.now();
  const shouldNotify = isNewAccount || now - lastTs > NOTIFY_THROTTLE_MS;

  if (shouldNotify) {
    writeVal(String(now), TS_KEY);
    notify(
      NAME,
      "Cookie 获取成功 ✅",
      `${isNewAccount ? (oldMusicU ? "已切换账号" : "首次获取") : "已刷新"}\n` +
        `MUSIC_U: ${mask(musicU)}\n` +
        `字段数: ${cookie.split(";").filter(Boolean).length}`
    );
  } else {
    console.log(`[${NAME}] Cookie 已刷新（通知节流中）`);
  }

  return finish();
})();
