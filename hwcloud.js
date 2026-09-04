/**
 * 华为云成长中心 每日签到 —— Quantumult X
 *
 * 一份脚本两用：
 *   1) 重写(MITM) —— 从你自己访问成长中心的请求里抓 Cookie 存起来，不用手动复制
 *   2) 定时任务    —— 用抓到的 Cookie 签到，并汇报连签天数 / 积分 / 每日任务状态
 *
 * 配置：
 *   [rewrite_local]
 *   ^https?:\/\/devdata\.huaweicloud\.com\/(index\/islogin|api\/get-ainfo|rest\/developer\/fwdu\/) url script-request-header hwcloud.js
 *
 *   [task_local]
 *   10 8 * * * hwcloud.js, tag=华为云成长中心, enabled=true
 *
 *   [mitm]
 *   hostname = devdata.huaweicloud.com
 *
 * 首次使用：开启 MITM 和重写后，用 Safari 打开 https://developer.huaweicloud.com/bonus
 * 并确认处于登录态，脚本会弹一次「已抓到 Cookie」，之后每天自动签到。
 *
 * 任务（浏览/分享等）由服务端按真实行为判定，脚本只能签到 + 汇报任务完成情况，
 * 不能代刷。
 */

const NAME = "华为云成长中心";

/* ---------- 存储键 ---------- */
const K_COOKIE = "hwg_cookie";
const K_NAMES = "hwg_cookie_names";
const K_TS = "hwg_cookie_ts";
const K_CSRF = "hwg_csrf";
const K_UA = "hwg_ua";

/* ---------- 接口（均取自真实抓包） ---------- */
const BASE = "https://devdata.huaweicloud.com";
const REFERER = "https://developer.huaweicloud.com/";
const ORIGIN = "https://developer.huaweicloud.com";
const CSRF_URL = `${BASE}/api/get-ainfo`;
const ISLOGIN_URL = `${BASE}/index/islogin?callback=checklogin`;

// fwdu = 需登录；fwdo = 免登录只读
const _U = "/rest/developer/fwdu/rest/developer/user";
const P_SIGN = `${_U}/hdcommunitysoservice/v1/growth/sign`;
const P_BEANS = `${_U}/hdcommunitysoservice/v1/growth/bonus-beans`;
const P_INFO = `${_U}/hdcommunityservice/v1/member/get-personal-info`;
const P_MISSION = `${_U}/hdcommunitysoservice/v1/growth/mission/query-mission-list-by-condition`;

/* 前端 jn = ["HD.00000000","HD.67500000"]：不在此列的 error_code 视为失败 */
const OK_CODES = ["", "HD.00000000", "HD.67500000"];
const CODE_ALREADY = "HD.67520093";
const CODE_RETRY = ["HD.67520109", "HD.67510023", "HD.67520110"];

/* 取自前端 In() 的错误码表 */
const ERR_MAP = {
  "HD.67520093": "今日已签到，无需重复签到",
  "HD.67520010": "签到任务权益规则不存在，请刷新后重试",
  "HD.67520095": "签到行为与多个任务绑定",
  "HD.67520096": "签到任务不存在，请刷新后重试",
  "HD.67520109": "当前签到人数较多，请稍后再试",
  "HD.67520110": "当前兑换人数较多，请稍后再试",
  "HD.67510023": "操作频繁，请稍后重试",
  "HD.67510028": "此账号为内部或测试账号，暂不支持此操作",
  "HD.67510029": "积分不足",
  "HD.67510037": "等级未达到兑换限制",
  "HD.35011005": "账号异常，暂不支持此操作",
  "HD.67520011": "账号异常，暂不支持此操作",
  "HD.67510017": "账号异常，暂不支持此操作",
  "HD.67520105": "账号异常，暂不支持此操作",
  "HD.35020021": "账号未完成开发者认证或状态异常",
  "HD.67510032": "账号状态异常，请到成长中心页面确认（可能需完成开发者认证）",
  "HD.92010003": "token not found —— Cookie 无效或已过期",
  "HD.90112024": "账号状态异常（前端提示 imaError）",
};

/* WAF 自己的会话项，不含任何登录信息 */
const WAF_ONLY = ["hwwafsesid", "hwwafsestime"];

const UA_FALLBACK =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

/* ---------- 小工具 ---------- */
const log = (m) => console.log(`[${NAME}] ${m}`);
const read = (k) => ($prefs.valueForKey(k) || "");
const write = (k, v) => $prefs.setValueForKey(String(v), k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function notify(title, sub, body) {
  $notify(title, sub || "", body || "");
}

/** "a=1; b=2" -> Map。同名取后出现的（较新的）那个。 */
function parseCookie(str) {
  const map = new Map();
  for (const part of String(str || "").split(";")) {
    const s = part.trim();
    if (!s) continue;
    const i = s.indexOf("=");
    if (i <= 0) continue;
    map.set(s.slice(0, i).trim(), s.slice(i + 1).trim());
  }
  return map;
}

const buildCookie = (map) =>
  [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

/** 只返回名字，不碰值 —— 日志里绝不出现登录凭证。 */
const cookieNames = (str) => [...parseCookie(str).keys()];

/** 除 WAF 项外还剩多少项：判断这串 Cookie 有没有登录信息。 */
const usefulCount = (str) =>
  cookieNames(str).filter((n) => !WAF_ONLY.includes(n.toLowerCase())).length;

const explain = (code, fallback) => ERR_MAP[code] || fallback;

/** 响应头大小写不定，统一按小写找。 */
function pickHeader(headers, name) {
  if (!headers) return "";
  const want = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === want) return headers[k];
  }
  return "";
}

/* ---------- HTTP ---------- */
/**
 * asScript=true 用于 JSONP（<script> 加载）：Accept / Sec-Fetch-* 与 XHR 不同，
 * 且不带 Origin。这套头部照真实浏览器请求配的。
 */
async function http(url, { method = "GET", body, csrf, asScript } = {}) {
  const cookie = read(K_COOKIE);
  const headers = {
    "User-Agent": read(K_UA) || UA_FALLBACK,
    Accept: asScript ? "*/*" : "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    Referer: REFERER,
    "Sec-Fetch-Dest": asScript ? "script" : "empty",
    "Sec-Fetch-Mode": asScript ? "no-cors" : "cors",
    "Sec-Fetch-Site": "same-site",
    Cookie: cookie,
  };
  if (!asScript) headers.Origin = ORIGIN;
  if (csrf) headers.csrf = csrf;

  const req = { url, method, headers, opts: { redirection: false } };
  if (body !== undefined) {
    req.body = JSON.stringify(body);
    headers["Content-Type"] = "application/json"; // 实测浏览器不带 charset
  }

  const resp = await $task.fetch(req);
  const status = resp.statusCode || resp.status || 0;
  let json = {};
  try {
    const d = JSON.parse(resp.body);
    if (d && typeof d === "object" && !Array.isArray(d)) json = d;
  } catch (e) {
    /* 非 JSON（JSONP / 重定向页），交给调用方看 body */
  }
  return { status, headers: resp.headers || {}, text: resp.body || "", json };
}

const errCode = (r) => String((r.json && r.json.error_code) || "");

/* ---------- 接口封装 ---------- */
const api = {
  csrf: "",

  /** fwdu 路径必须带 csrf；它来自 get-ainfo 的响应头（不是 body）。 */
  async fetchCsrf() {
    const r = await http(CSRF_URL);
    const v = pickHeader(r.headers, "csrf");
    if (v && v.length >= 8) {
      this.csrf = v;
      write(K_CSRF, v);
      return v;
    }
    // 兜底用重写时抓到的那个（同会话内有效）
    const cached = read(K_CSRF);
    if (cached) {
      this.csrf = cached;
      log("get-ainfo 未返回 csrf，改用重写时抓到的");
    }
    return this.csrf;
  },

  /** 登录预检：JSONP，未登录会 302 到登录页。 */
  async checkLogin() {
    const r = await http(ISLOGIN_URL, { asScript: true });
    if (r.status >= 300 && r.status < 400) {
      const loc = pickHeader(r.headers, "location");
      if (/authui\/login|auth\./.test(loc)) {
        return { ok: false, hint: "Cookie 未携带有效登录态（islogin 被重定向到登录页）" };
      }
      return { ok: false, hint: `islogin 异常重定向：${String(loc).slice(0, 120)}` };
    }
    const body = String(r.text || "").trim();
    const a = body.indexOf("(");
    const b = body.lastIndexOf(")");
    if (a < 0 || b <= a) {
      return { ok: false, hint: `islogin 返回异常：HTTP ${r.status}` };
    }
    let d = {};
    try {
      d = JSON.parse(body.slice(a + 1, b));
    } catch (e) {
      return { ok: false, hint: "islogin 返回的不是合法 JSONP" };
    }
    // 前端逻辑：!bbs_userID 视为 token 过期，1===flag 才算登录
    if (!d.bbs_userID) {
      return { ok: false, hint: "登录态已过期（islogin 未返回 bbs_userID）" };
    }
    if (d.flag !== 1) {
      return { ok: false, hint: `islogin flag=${d.flag}，未登录` };
    }
    return { ok: true, hint: String(d.username || d.bbs_userID || "") };
  },

  /** 带重试：人多/频繁这类错误码值得再打一次。 */
  async call(path, method = "GET", body) {
    let r;
    for (let i = 0; i < 3; i++) {
      r = await http(BASE + path, { method, body, csrf: this.csrf });
      if (!CODE_RETRY.includes(errCode(r))) return r;
      log(`${errCode(r)}，${i + 1}s 后重试`);
      await sleep(1000 * (i + 1));
    }
    return r;
  },

  personalInfo() {
    return this.call(P_INFO);
  },
  signState() {
    return this.call(P_SIGN);
  },
  doSign(accountName) {
    return this.call(P_SIGN, "POST", { account_name: accountName });
  },

  async beans() {
    const v = (await this.call(P_BEANS)).json.beans;
    return Number.isInteger(v) ? v : null;
  },

  /** 每日任务清单（只读，任务无法代刷）。 */
  async dailyMissions(pageSize = 50) {
    const out = [];
    for (let page = 1; page <= 5; page++) {
      const d = (
        await this.call(P_MISSION, "POST", {
          page_no: page,
          page_size: pageSize,
          category_key: "DAILY_MISSIONS",
        })
      ).json;
      const items = d.QueryMissionDtoList || [];
      out.push(...items);
      if (!items.length || out.length >= (d.total || 0)) break;
    }
    return out;
  },
};

/** 从 7 天日历里取当前连签天数对应的积分。 */
function todayBonus(state, days) {
  if (!days) return null;
  for (const it of state.sign_invo_list || []) {
    if (it.count === days) return it.bonus || 10; // 实测 7 天每天都是 10
  }
  return null;
}

/* ---------- 模式一：重写，抓 Cookie ---------- */
/**
 * 抓的是 MITM 看到的真实请求头，所以 HttpOnly 的项也在里面 —— 这正是
 * 手动从控制台 document.cookie 复制会漏掉的部分。
 */
function capture() {
  const h = $request.headers || {};
  const incoming = pickHeader(h, "cookie");
  if (!incoming) return $done({});

  const useful = usefulCount(incoming);
  if (!useful) {
    // 只有 WAF 项，不含登录信息，存了也没用
    return $done({});
  }

  const before = read(K_NAMES);
  let cookie;
  if (useful >= 15) {
    // 一整罐完整的会话：整体替换，这样换账号 / 重新登录能干净切过来
    cookie = parseCookie(incoming);
  } else {
    // 局部请求：按名字合并，新值覆盖旧值
    cookie = parseCookie(read(K_COOKIE));
    for (const [k, v] of parseCookie(incoming)) cookie.set(k, v);
  }

  const names = [...cookie.keys()].sort().join(",");
  write(K_COOKIE, buildCookie(cookie));
  write(K_NAMES, names);
  write(K_TS, Date.now());

  const ua = pickHeader(h, "user-agent");
  if (ua) write(K_UA, ua);
  const csrf = pickHeader(h, "csrf");
  if (csrf) write(K_CSRF, csrf);

  // 只在项目集合变化时提醒，值刷新不打扰
  if (names !== before) {
    const n = cookie.size;
    log(`已更新 Cookie，共 ${n} 项`);
    notify(NAME, "已抓到 Cookie", `共 ${n} 项，可以开始定时签到了`);
  }
  $done({});
}

/* ---------- 模式二：定时签到 ---------- */
async function task() {
  const cookie = read(K_COOKIE);
  if (!cookie) {
    notify(
      NAME,
      "还没有 Cookie",
      "请先开启 MITM 和重写，用 Safari 打开 developer.huaweicloud.com/bonus 并保持登录"
    );
    return;
  }
  const names = cookieNames(cookie);
  const ts = Number(read(K_TS) || 0);
  const age = ts ? Math.floor((Date.now() - ts) / 86400000) : -1;
  log(`Cookie 共 ${names.length} 项${age >= 0 ? `，${age} 天前抓到` : ""}`);

  const login = await api.checkLogin();
  if (!login.ok) {
    log(`Cookie 实际包含 ${names.length} 项：${names.join(", ")}`);
    notify(
      NAME,
      "签到失败",
      `${login.hint}\n重新打开 developer.huaweicloud.com/bonus 登录一次即可刷新`
    );
    return;
  }
  log(`登录态正常：${login.hint}`);

  if (!(await api.fetchCsrf())) {
    notify(NAME, "签到失败", "已登录但取不到 csrf，接口可能有变动");
    return;
  }

  // 昵称 —— 签到 body 里的 account_name 用的是 memAlias
  const info = (await api.personalInfo()).json;
  const infoCode = String(info.error_code || "");
  if (infoCode === "HD.92010003" || info.error_msg === "token not found") {
    notify(NAME, "签到失败", explain(infoCode, "Cookie 无效或已过期"));
    return;
  }
  const alias = info.memAlias || "";
  if (info.parentMemID) log("! 该账号是子账号，成长中心可能不支持");

  let state = (await api.signState()).json;
  const stateCode = String(state.error_code || "");
  if (stateCode && !OK_CODES.includes(stateCode)) {
    notify(NAME, "签到失败", explain(stateCode, `查询签到状态失败 ${stateCode}`));
    return;
  }

  let days = state.sign_continuity_count;
  let message;
  let already = false;

  if (state.sign_flag === 1) {
    already = true;
    message = "今日已签到";
  } else {
    const r = await api.doSign(alias);
    const code = errCode(r);
    if (code === CODE_ALREADY) {
      already = true;
      message = "今日已签到";
    } else if (OK_CODES.includes(code) && r.status === 200) {
      message = "签到成功";
      const fresh = (await api.signState()).json;
      if (fresh.sign_continuity_count != null) {
        days = fresh.sign_continuity_count;
        state = fresh;
      }
    } else {
      let hint = r.json.error_msg || String(r.text).slice(0, 120) || `HTTP ${r.status}`;
      if (r.status === 403 && /not login/i.test(r.text)) {
        hint = "Cookie 无效或已过期，请重新打开成长中心页面刷新";
      }
      notify(NAME, "签到失败", explain(code, hint));
      return;
    }
  }

  /* 汇报 */
  const bonus = todayBonus(state, days);
  const beans = await api.beans();

  const line = [message];
  if (days) line.push(`连签 ${days} 天`);
  if (bonus && !already) line.push(`+${bonus} 积分`);
  if (beans != null) line.push(`余额 ${beans}`);

  const body = [];
  if (alias) body.push(`账号：${alias}`);

  try {
    const missions = await api.dailyMissions();
    if (missions.length) {
      const done = missions.filter((m) => m.is_finish === 1).length;
      body.push(`每日任务：${done}/${missions.length} 已完成`);
      const todo = missions
        .filter((m) => m.is_finish !== 1)
        .map((m) => {
          const gain = [];
          if (m.bonus) gain.push(`+${m.bonus}积分`);
          if (m.growth) gain.push(`+${m.growth}成长值`);
          return `· ${m.title || ""}${gain.length ? `（${gain.join(" ")}）` : ""}`;
        });
      // 任务由服务端按真实行为判定，脚本只能列出来提醒，代刷不了
      if (todo.length) body.push("未完成：", ...todo);
    }
  } catch (e) {
    log(`! 任务列表获取失败：${e}`);
  }

  log(line.join(" · "));
  notify(NAME, line.join(" · "), body.join("\n"));
}

/* ---------- 入口 ---------- */
if (typeof $request !== "undefined" && $request) {
  capture();
} else {
  task()
    .catch((e) => {
      log(`异常：${e}`);
      notify(NAME, "签到异常", String(e));
    })
    .finally(() => $done());
}

