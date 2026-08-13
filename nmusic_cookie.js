/**************************************
 * 网易云音乐人 —— 获取 Cookie（字段合并版）
 * 原脚本作者：@leiyiyan
 *
 * ============ 这版按 Docker 项目的取 CK 方式重写 ============
 * 参照能跑通的 Docker 项目 backend/app/netease_core/ 的实现。
 *
 * Docker 项目是这么拿 Cookie 的：
 *   login.py:855-856   cookies = context.cookies("https://music.163.com")
 *                      cookie_str = cookies_to_cookie_str(cookies)
 *   login.py:81-90     只拼 name=value，用 "; " 连接
 *
 * 关键点：context.cookies() 返回的是浏览器**整个域的 Cookie 罐**，
 * 也就是所有响应 Set-Cookie 累积下来的并集，不是某一次请求带的那一份。
 *
 * 而 MITM 只能看到**单次请求**的 Cookie 头，它只是那个罐的子集。
 *
 * 【2026-08-13 实测修正】拿真机 HAR 核对过（384 条记录，其中 164 条打
 * music.163.com），我原先「APP 原生请求不带 __csrf」的推测是**错的**：
 *   · 161 条带 MUSIC_U 的请求，**161 条同时带 __csrf**，一条不少
 *   · APP 的 Cookie 是完整 27 个字段：MUSIC_U / __csrf / deviceId /
 *     sDeviceId / os / osver / appver / channel / NMTID / WNMCID / ...
 *   · host 主要是 interface3.music.163.com（占 140 条），路径前缀是
 *     /xeapi/ 与 /eapi/，全部 HTTP/1.1（不是 QUIC，圈X 能改写）
 * 也就是说随便抓到一条登录态请求，Cookie 就是齐的，不需要跨请求凑。
 *
 * 那还要不要合并？要，但它的作用降级为「保险」而非「必需」：
 *   · 万一某条请求的 Cookie 被 APP 截短，不会把已存的好 Cookie 覆盖坏
 *   · 退出登录时 APP 发 MUSIC_U=（空值），不会把罐洗空
 * 单请求整串覆盖在正常情况下同样能work，合并只是更耐操。
 *
 * 所以重写规则的 host 部分必须写成 [\w.-]*music\.163\.com —— 子域可有可无。
 * 写成 [\w-]+\.music\.163\.com（强制要有子域）会把裸 music.163.com 排除掉，
 * 而那正是唯一能拿到 __csrf 的来源，原作者的窄规则针对的也是这个 host。
 *
 * 这里刻意不用 (?:[\w-]+\.)? 这种非捕获分组：圈X 的重写规则用的正则引擎没有
 * 公开文档说明支持哪些语法，万一不支持，规则会**静默不命中**（不报错、没日志），
 * 排查起来和「证书没装好」一模一样。[\w.-]* 只用基础字符类，风险最低。
 *
 * 旧版还有个真问题：写入是**一次性**的
 *   if (!$.getdata("Netease_Musician_Cookie") || ... == "") { ...写入... }
 * 已经有值就再也不更新。所以 Cookie 一旦过期就永远过期，这是原版在圈X 上
 * 「跑一阵就不动了」的根因。本版允许覆盖更新，APP 自己刷新 Cookie 时会跟着更新。
 *
 * 本版改成和 Docker 一样维护一个**字段罐**：把每次看到的 Cookie 头拆成字段，
 * 按字段名合并进已存的罐，同名取新值，再序列化回 "k=v; k=v"。
 * 这样 MUSIC_U 从 eapi 请求拿、__csrf 从 H5 请求拿，凑齐即成完整一份，
 * 不用指望某一次请求刚好什么都带。
 *
 * 换账号：MUSIC_U 变了就整罐重置，不会把两个账号的字段混在一起
 * （Docker 侧换账号是新开浏览器 context，天然隔离）。
 *
 * 落盘门槛：罐里必须有 MUSIC_U。
 * Docker 侧 login.py:858-860 用的是 has_music_u or has_csrf，那是判断
 * 「登录有没有产出东西」；对 task.js 来说 MUSIC_U 才是身份凭据，光有 __csrf
 * 没用，所以这里只认 MUSIC_U。__csrf 缺失不再阻塞 —— task.js 已按
 * core.py:255-260 的做法在缺失时自造一个随机 csrf_token。
 *
 * ============ 圈X 配置 ============
 * 注意 script-request-header 后面只写**文件名**，不写路径 —— 脚本要放进
 * 圈X 的 Scripts 文件夹（「我的 iPhone」或 iCloud Drive 里的那个）。
 * 若你是用 URL 远程引用，那就把整个 https:// 地址写在那个位置。
 *
 * [rewrite_local]
 * ^https?:\/\/[\w.-]*music\.163\.com\/ url script-request-header cookie.js
 *
 * [mitm]
 * hostname = *.music.163.com, music.163.com
 *
 * ============ Loon 配置 ============
 * [Script]
 * http-request ^https?:\/\/[\w.-]*music\.163\.com\/ script-path=cookie.js, requires-body=false, tag=网易云音乐人获取Cookie
 *
 * [MitM]
 * hostname = *.music.163.com, music.163.com
 *
 * ============ 抓取步骤 ============
 * 1. 确认圈X 已开 MITM，证书已安装并在「设置-通用-关于本机-证书信任设置」里信任
 * 2. 打开网易云音乐 APP（确保已登录）
 * 3. 左上角菜单 → 创作者中心 → 音乐人中心（这一步会走 H5，通常能补上 __csrf）
 * 4. 应先收到「重写规则已生效」心跳，随后收到「Cookie 获取成功」
 * 5. 通知里会列出 MUSIC_U / __csrf / deviceId 三个字段各自到手没有。
 *    只要 MUSIC_U 有了就能跑；__csrf 后续抓到会自动补进去并再通知一次。
 *
 * ============ 重新抓取 / 换账号 ============
 * BoxJS 里清空 Netease_Musician_Cookie 即可；本版允许覆盖更新，
 * 换账号会自动识别、整罐重置并通知，不需要手动清 Hit 标记。
 ******************************************/

const NAME = "网易云音乐人";
const CK_KEY = "Netease_Musician_Cookie";
const UA_KEY = "Netease_Musician_UserAgent";
const TS_KEY = "Netease_Musician_Cookie_Ts";
const HIT_KEY = "Netease_Musician_Rule_Hit";
const WARN_KEY = "Netease_Musician_Warn_Ts";

const OK_THROTTLE_MS = 60 * 1000; // 成功通知节流
const WARN_THROTTLE_MS = 10 * 60 * 1000; // 「抓到的请求没有 MUSIC_U」提醒节流

/* ---------- 运行环境探测 ----------
 * 按「存储 API 是否存在」判断，比判断 $task 更可靠：
 * 某些 QX 版本在重写上下文里不注入 $task，但 $prefs 一定有。 */
const hasPrefs = typeof $prefs !== "undefined"; // QuantumultX
const hasStore = typeof $persistentStore !== "undefined"; // Surge / Loon / Stash / Shadowrocket

function finish() {
  // 重写脚本必须放行请求，否则圈X会把这条请求挂起到超时
  if (typeof $done !== "undefined") $done({});
}

function readVal(key) {
  try {
    if (hasPrefs) return $prefs.valueForKey(key);
    if (hasStore) return $persistentStore.read(key);
  } catch (e) {
    console.log(`[${NAME}] 读取 ${key} 失败: ${e}`);
  }
  return null;
}

function writeVal(val, key) {
  try {
    if (hasPrefs) return $prefs.setValueForKey(val, key);
    if (hasStore) return $persistentStore.write(val, key);
  } catch (e) {
    console.log(`[${NAME}] 写入 ${key} 失败: ${e}`);
  }
  return false;
}

function notify(title, subtitle, body) {
  try {
    if (typeof $notify !== "undefined") $notify(title, subtitle, body);
    else if (typeof $notification !== "undefined") $notification.post(title, subtitle, body);
  } catch (e) {
    console.log(`[${NAME}] 通知失败: ${e}`);
  }
  console.log(`${title}\n${subtitle}\n${body}`);
}

/* ---------- 工具 ---------- */

// 大小写不敏感读取请求头
function header(name) {
  const h = (typeof $request !== "undefined" && $request && $request.headers) || {};
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

function mask(s) {
  const v = String(s);
  return v.length <= 16 ? v : `${v.slice(0, 8)}…${v.slice(-6)}`;
}

// 只留 host + path，通知里放全 URL 会被截断
function shortUrl(u) {
  const s = String(u || "");
  const m = s.match(/^https?:\/\/([^/?#]+)([^?#]*)/);
  if (!m) return s.slice(0, 80);
  const p = m[2].length > 48 ? m[2].slice(0, 48) + "…" : m[2];
  return m[1] + p;
}

function throttled(key, ms) {
  const last = parseInt(storedClean(key) || "0", 10) || 0;
  const now = Date.now();
  if (now - last < ms) return true;
  writeVal(String(now), key);
  return false;
}

/* ---------- Cookie 字段罐 ----------
 * 对应 Docker 项目里 context.cookies() + cookies_to_cookie_str() 的角色：
 * 那边由浏览器维护这个罐，这边 MITM 只能看到单次请求，只好自己维护。 */

// "a=1; b=2" → [["a","1"],["b","2"]]，保持出现顺序
function parseJar(ck) {
  const out = [];
  String(ck || "")
    .split(";")
    .forEach((seg) => {
      const s = seg.trim();
      if (!s) return;
      const i = s.indexOf("=");
      if (i <= 0) return; // 没有字段名的碎片直接丢
      const name = s.slice(0, i).trim();
      if (!name) return;
      out.push([name, s.slice(i + 1).trim()]);
    });
  return out;
}

function jarGet(jar, name) {
  for (let i = jar.length - 1; i >= 0; i--) {
    if (jar[i][0] === name) return jar[i][1];
  }
  return "";
}

/* 用 next 的字段更新 base：同名覆盖，新名追加，保持 base 原有顺序。
 * 空值不覆盖已有值 —— 退出登录时 APP 可能发 MUSIC_U=，
 * 那时宁可留着上一份能用的，也不要把罐洗空。 */
function mergeJar(base, next) {
  const out = base.map((kv) => [kv[0], kv[1]]);
  next.forEach((kv) => {
    const name = kv[0],
      value = kv[1];
    if (!value) return;
    let at = -1;
    for (let i = 0; i < out.length; i++) {
      if (out[i][0] === name) {
        at = i;
        break;
      }
    }
    if (at >= 0) out[at][1] = value;
    else out.push([name, value]);
  });
  return out;
}

// 与 login.py:81-90 一致：只拼 name=value，用 "; " 连接
function serializeJar(jar) {
  return jar.map((kv) => kv[0] + "=" + kv[1]).join("; ");
}

// 通知里的字段清单，用户一眼能看出还缺什么
function fieldReport(jar) {
  const musicU = jarGet(jar, "MUSIC_U");
  const csrf = jarGet(jar, "__csrf");
  const device = jarGet(jar, "deviceId");
  return (
    `MUSIC_U: ${musicU ? "✅ " + mask(musicU) : "❌ 未获取"}\n` +
    `__csrf: ${csrf ? "✅ " + mask(csrf) : "⏳ 未获取（可选，task.js 会自造）"}\n` +
    `deviceId: ${device ? "✅ " + mask(device) : "⏳ 未获取（可选）"}\n` +
    `字段数: ${jar.length}`
  );
}

/* ---------- 主流程 ---------- */
!(() => {
  /* 场景 A：脚本被当成定时任务跑了，没有 $request。
   * 原版在这里静默返回，本版明确告警 —— 这是最常见的配置错放。 */
  if (typeof $request === "undefined") {
    notify(
      NAME,
      "配置错误 ❌",
      "本脚本必须放在 [rewrite_local]（圈X）或 [Script] http-request（Loon）下，" +
        "不能放进 [task_local] 定时任务。定时任务要跑的是 task.js。"
    );
    return finish();
  }

  const url = $request.url || "";
  const cookie = header("cookie").trim();
  const ua = header("user-agent").trim();
  const oldCk = storedClean(CK_KEY);
  const oldJar = parseJar(oldCk);
  const oldMusicU = jarGet(oldJar, "MUSIC_U");

  /* 首次命中心跳：这是把「没反应」拆开的关键诊断信号。
   * 只在规则第一次生效时发一次，之后不再打扰。 */
  if (!storedClean(HIT_KEY)) {
    writeVal(String(Date.now()), HIT_KEY);
    notify(
      NAME,
      "重写规则已生效 ✅",
      `脚本已被调用，说明 MITM 与证书都正常。\n` +
        `命中: ${shortUrl(url)}\n` +
        `该请求${cookie ? (jarGet(parseJar(cookie), "MUSIC_U") ? "含 MUSIC_U，马上会有获取成功通知" : "有 Cookie 但无 MUSIC_U") : "无 Cookie 头"}\n` +
        `若迟迟收不到「获取成功」，请在 APP 里刷新需要登录的页面。`
    );
  }

  /* 场景 B：这条请求没有 Cookie 头。广匹配下这很常见（图片、配置、CDN 等），
   * 属正常现象，只在「一次都还没抓到过」时才限流提醒。 */
  if (!cookie) {
    console.log(`[${NAME}] 无 Cookie 头，跳过。URL: ${shortUrl(url)}`);
    if (!oldCk && !throttled(WARN_KEY, WARN_THROTTLE_MS)) {
      notify(NAME, "仍未抓到 Cookie ⏳", `规则在正常命中，但请求不带 Cookie。\n最近命中: ${shortUrl(url)}\n请确认 APP 已登录，并打开需要登录的页面。`);
    }
    return finish();
  }

  const reqJar = parseJar(cookie);
  const reqMusicU = jarGet(reqJar, "MUSIC_U");

  /* 场景 C：这条请求没有 MUSIC_U，且历史上也从没抓到过 —— 全程未登录态。
   * 注意这里不再因为「本次请求没有 MUSIC_U」就丢弃它：只要罐里已经有
   * MUSIC_U，本次请求的其它字段（比如 __csrf）照样值得合并进去。 */
  if (!reqMusicU && !oldMusicU) {
    console.log(`[${NAME}] Cookie 中无 MUSIC_U 且无历史记录，判定未登录，跳过写入。URL: ${shortUrl(url)}`);
    if (!throttled(WARN_KEY, WARN_THROTTLE_MS)) {
      notify(NAME, "Cookie 无效 ❌", `抓到的 Cookie 里没有 MUSIC_U（未登录态）。\n命中: ${shortUrl(url)}\n请确认 APP 已登录后重新进入音乐人中心。`);
    }
    return finish();
  }

  /* 场景 D：合并。换账号则整罐重置，避免两个账号的字段混在一起。 */
  const isNewAccount = !!reqMusicU && !!oldMusicU && reqMusicU !== oldMusicU;
  const isFirstTime = !!reqMusicU && !oldMusicU;
  const newJar = isNewAccount ? reqJar : mergeJar(oldJar, reqJar);
  const newCk = serializeJar(newJar);

  /* 场景 E：合并后没有任何变化，静默跳过。
   * 广匹配下绝大多数请求都会走到这里，绝不能发通知。 */
  if (newCk === oldCk) {
    console.log(`[${NAME}] 字段无变化，跳过写入`);
    return finish();
  }

  const okCk = writeVal(newCk, CK_KEY);
  if (ua) writeVal(ua, UA_KEY);

  if (!okCk) {
    notify(NAME, "Cookie 写入失败 ❌", "持久化存储写入失败，请检查代理软件的存储权限。");
    return finish();
  }

  /* 关键字段刚补齐时必须通知（不受节流限制）—— 这正是本版的价值所在：
   * 用户能看到 __csrf 是在哪一步补上的。 */
  const gainedCsrf = !!jarGet(newJar, "__csrf") && !jarGet(oldJar, "__csrf");
  const gainedDevice = !!jarGet(newJar, "deviceId") && !jarGet(oldJar, "deviceId");

  if (isNewAccount || isFirstTime || gainedCsrf || gainedDevice || !throttled(TS_KEY, OK_THROTTLE_MS)) {
    const what = isNewAccount ? "已切换账号" : isFirstTime ? "首次获取" : gainedCsrf ? "已补齐 __csrf 字段" : gainedDevice ? "已补齐 deviceId 字段" : "已刷新";
    notify(NAME, "Cookie 获取成功 ✅", `${what}\n` + fieldReport(newJar) + `\n来源: ${shortUrl(url)}`);
  } else {
    console.log(`[${NAME}] Cookie 已刷新（通知节流中）`);
  }

  return finish();
})();
