/**
 * 饿了么幸运星 —— Quantumult X
 * 一份脚本两用：重写(抓 CK/令牌) + 定时任务(跑任务领星)。配置和排错见 README_QX.md
 *
 *   [rewrite_local]  ← receiveprize 那条必须在通用那条前面，且是 request-body
 *   ^https?:\/\/ynuf\.aliapp\.org\/service\/um\.json url script-response-body https://raw.githubusercontent.com/viyfe/Script/refs/heads/main/eleme.js
 *   ^https?:\/\/rsc-api\.ele\.me\/h5\/.*receiveprize url script-request-body https://raw.githubusercontent.com/viyfe/Script/refs/heads/main/eleme.js
 *   ^https?:\/\/(sp|rsc-api|alsc-config|metis-er|r|tb|air\.tb)\.ele\.me\/ url script-request-header https://raw.githubusercontent.com/viyfe/Script/refs/heads/main/eleme.js
 *
 *   [task_local]
 *   10 9,13,21 * * * https://raw.githubusercontent.com/viyfe/Script/refs/heads/main/eleme.js, tag=饿了么幸运星, enabled=true
 *
 *   [mitm]  ← hostname 精确匹配不含子域，air.tb.ele.me 要单独写
 *   hostname = ynuf.aliapp.org, sp.ele.me, rsc-api.ele.me, alsc-config.ele.me, metis-er.ele.me, r.ele.me, tb.ele.me, air.tb.ele.me
 *
 * 可选参数(task_local 那行的 argument=)：
 *   elmStarOnly=true   不抽奖，只影响抽奖动作不影响做任务
 *   elmSignIn=true     是否签到，默认 true
 *   elmViewWait=true   浏览任务是否真实等待时长
 *   elmDoChance=false  是否跑任务集 2602(发抽免单机会不发幸运星，且打点推不动阶段)
 *   elmDebug=false     打印接口原始返回
 *   elmProbe           只探测：三种画像 × 每个任务集，打任务数矩阵
 *   elmClient=app      画像 app|h5|bare|mini
 *   elmDelay=5         多账号间隔秒数
 *   elmLng/elmLat      经纬度，默认北京
 *   elmUa/elmTtid/elmUtdid/elmAppVer/elmIosVer/elmDevice/elmIcVersion/elmUmid
 *                      同青龙版，一般不用填(umid 由重写自动抓)
 *
 * 多账号：MITM 只抓得到本机登录的号，其余 CK 手填进 $prefs 的 elm_ck_2 / elm_ck_3。
 * 邀请助力、店内点击需真人操作，脚本只统计不执行。
 * 业务逻辑与青龙版 eleme_miandan.js 同源，只换了传输层和凭证来源。
 */

/* ==================== 圈X 适配层 ==================== */

const QX_NAME = '饿了么幸运星';

/* 存储键 */
const K_CK = 'elm_ck'; // 主账号 cookie 罐
const K_CK_NAMES = 'elm_ck_names'; // 罐里有哪些项(只存名字，不存值)
const K_CK_TS = 'elm_ck_ts';
const K_UMID = 'elm_umid'; // bx-umidtoken
const K_UMID_TS = 'elm_umid_ts';
const K_H5TK = 'elm_h5tk'; // _m_h5_tk 兜底
const K_QX_UA = 'elm_qx_ua'; // 真实 App 的 UA
const K_EXTRA_CK = ['elm_ck_2', 'elm_ck_3', 'elm_ck_4']; // 多账号手填位
const K_HITS = 'elm_rw_hits'; // 重写被调起的次数，用来判断"到底有没有触发"
const K_LAST = 'elm_rw_last'; // 最后一次调起命中的 URL(只留 host+path)
const K_REAL_CLAIM = 'elm_real_claim'; // App 自己点"领取奖励"发的那一发，用来对账
const K_UMID_HOSTS = 'elm_umid_hosts'; // 哪些 host 的请求带了 bx-umidtoken(找拦截点用)
const K_CLAIM_SEEN = 'elm_claim_seen'; // 见过的领奖类 URL(host + api)，找 App 走哪条路用

// 脚本最后一发领奖的 data / 头，领奖失败时拿它跟 App 真实那发逐字比
let lastClaimData = null;
let lastClaimHeaders = null;

const readK = (k) => {
  try {
    return $prefs.valueForKey(k) || '';
  } catch (e) {
    return '';
  }
};
const writeK = (k, v) => {
  try {
    return $prefs.setValueForKey(String(v), k);
  } catch (e) {
    return false;
  }
};

/** task_local 那行的 argument= 解析成对象；重写场景下 $argument 不存在 */
function parseArgument() {
  const out = {};
  let raw = '';
  try {
    raw = typeof $argument !== 'undefined' && $argument ? String($argument) : '';
  } catch (e) {
    raw = '';
  }
  if (!raw) return out;
  // 支持 a=1&b=2，也容忍 JSON
  if (raw.trim().startsWith('{')) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      /* 当成 kv 串继续 */
    }
  }
  for (const kv of raw.split('&')) {
    const i = kv.indexOf('=');
    if (i <= 0) continue;
    out[kv.slice(0, i).trim()] = decodeURIComponent(kv.slice(i + 1).trim());
  }
  return out;
}

/**
 * process.env 的替身。原脚本 18 个 elmXxx 全从这里读，所以业务逻辑一行不用改。
 * 取值优先级：argument > $prefs 同名键 > 不设置(让业务逻辑用它自己的默认值)。
 * elmCookie / elmUmid / elmUa 另有来源，见下。
 */
function buildEnv() {
  const arg = parseArgument();
  const env = {};
  const KEYS = [
    'elmClient', 'elmProbe', 'elmStarOnly', 'elmSignIn', 'elmUtdid', 'elmUa',
    'elmAppVer', 'elmIosVer', 'elmDevice', 'elmIcVersion', 'elmDelay',
    'elmViewWait', 'elmLng', 'elmLat', 'elmTtid', 'elmUmid', 'elmDebug',
    'elmDoChance',
  ];
  for (const k of KEYS) {
    const v = arg[k] !== undefined && arg[k] !== '' ? arg[k] : readK(k);
    if (v !== '' && v !== undefined) env[k] = String(v);
  }

  // CK：重写抓到的主罐 + 手填的多账号位，换行分隔(splitAccounts 认换行)
  const cks = [readK(K_CK), ...K_EXTRA_CK.map(readK)].filter(Boolean);
  if (cks.length) env.elmCookie = cks.join('\n');

  // 风控令牌：argument/手填优先，否则用重写抓到的
  if (!env.elmUmid) {
    const t = readK(K_UMID);
    if (t) env.elmUmid = t;
  }
  // UA：没显式指定就用抓到的真实 App UA，比画像里的硬编码更贴合本机
  if (!env.elmUa) {
    const ua = readK(K_QX_UA);
    if (ua) env.elmUa = ua;
  }
  return env;
}

const process = { env: buildEnv(), exit: () => {}, platform: 'quantumultx' };

/**
 * 纯 JS MD5（圈X 的 JSContext 没有 crypto）。
 * 取自本人 aliyun_web 脚本里那份，已逐例对齐 Node crypto 的结果（含中文、空串、
 * 1000 字符长串）。UTF-8 走 unescape(encodeURIComponent(x)) 转字节 —— mtop 签名的
 * dataJson 带中文时必须按字节算，按 UTF-16 码位算会签错。
 */
function md5HexUtf8(input) {
  const bytes = Array.from(unescape(encodeURIComponent(input)), (c) => c.charCodeAt(0));
  const bitLength = bytes.length * 8;
  bytes.push(128);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const lowBits = bitLength >>> 0;
  const highBits = Math.floor(bitLength / 4294967296) >>> 0;
  for (let i = 0; i < 4; i++) bytes.push((lowBits >>> (i * 8)) & 255);
  for (let i = 0; i < 4; i++) bytes.push((highBits >>> (i * 8)) & 255);

  const shifts = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const constants = Array.from({ length: 64 }, (_, i) =>
    Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0
  );
  const rol = (v, s) => (v << s) | (v >>> (32 - s));

  let stateA = 1732584193, stateB = 4023233417, stateC = 2562383102, stateD = 271733878;
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = Array.from({ length: 16 }, (_, i) => {
      const s = offset + i * 4;
      return (bytes[s] | (bytes[s + 1] << 8) | (bytes[s + 2] << 16) | (bytes[s + 3] << 24)) >>> 0;
    });
    let a = stateA, b = stateB, c = stateC, d = stateD;
    for (let r = 0; r < 64; r++) {
      let mixed, wi;
      if (r < 16) { mixed = (b & c) | (~b & d); wi = r; }
      else if (r < 32) { mixed = (d & b) | (~d & c); wi = (5 * r + 1) % 16; }
      else if (r < 48) { mixed = b ^ c ^ d; wi = (3 * r + 5) % 16; }
      else { mixed = c ^ (b | ~d); wi = (7 * r) % 16; }
      const prevD = d;
      d = c;
      c = b;
      const sum = (a + mixed + constants[r] + words[wi]) >>> 0;
      b = (b + rol(sum, shifts[r])) >>> 0;
      a = prevD;
    }
    stateA = (stateA + a) >>> 0;
    stateB = (stateB + b) >>> 0;
    stateC = (stateC + c) >>> 0;
    stateD = (stateD + d) >>> 0;
  }
  return [stateA, stateB, stateC, stateD]
    .flatMap((w) => [0, 8, 16, 24].map((s) => (w >>> s) & 255))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** crypto 的替身：只需支撑 createHash('md5').update(x).digest('hex') 这一种链式用法 */
const crypto = {
  createHash() {
    let acc = '';
    const h = {
      update(s) {
        acc += String(s);
        return h;
      },
      digest() {
        return md5HexUtf8(acc);
      },
    };
    return h;
  },
};

/**
 * URLSearchParams 的替身（JSC 裸环境没有）。业务逻辑只用「传对象构造 + 插值成串」。
 * 按 x-www-form-urlencoded 规则：空格转 +，其余走 encodeURIComponent 再补
 * !'()*~ 这几个它不编但标准要编的字符。ttid 里的 @ 两边都编成 %40，一致。
 */
class URLSearchParams {
  constructor(init) {
    this._pairs = Object.entries(init || {}).map(([k, v]) => [k, v == null ? '' : String(v)]);
  }
  static _enc(s) {
    return encodeURIComponent(s)
      .replace(/%20/g, '+')
      .replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  }
  append(k, v) {
    this._pairs.push([k, v == null ? '' : String(v)]);
  }
  toString() {
    return this._pairs
      .map(([k, v]) => `${URLSearchParams._enc(k)}=${URLSearchParams._enc(v)}`)
      .join('&');
  }
}

/** 响应头大小写不定，统一按小写找 */
function pickHeaderCI(headers, name) {
  if (!headers) return '';
  const want = String(name).toLowerCase();
  for (const k of Object.keys(headers)) {
    if (String(k).toLowerCase() === want) return headers[k];
  }
  return '';
}

/**
 * 圈X 把多条 Set-Cookie 合并成一个串下发。不能直接按逗号拆 ——
 * Expires=Wed, 21 Oct ... 里就有逗号。只在「逗号后紧跟 name=」处拆。
 */
function splitSetCookie(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return String(raw)
    .split(/,\s*(?=[^,=;]+=)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * httpPost —— 青龙版是 https.request，这里换成 $task.fetch。
 * 返回形状必须和青龙版一致（{ body, setCookie }），业务逻辑才能一行不改：
 * _m_h5_tk 那套「先挨一发 TOKEN_EMPTY、吃下 Set-Cookie、重签再发」靠的就是 setCookie。
 */
function httpPost(url, body, cookie, extraHeaders = {}) {
  const headers = {
    'User-Agent': UA,
    Referer: REFERER,
    Origin: 'https://tb.ele.me',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    'Content-Type': 'application/x-www-form-urlencoded',
    Cookie: cookie,
    ...extraHeaders,
  };
  // 调用方传 Origin: undefined 表示「这个头不要发」(mini 画像下微信不发 Origin)。
  // 光从 extraHeaders 删不掉基础头里那份，所以合并之后再统一清一遍。
  // Content-Length 交给圈X 自己算，手动设容易和实际字节数打架。
  for (const k of Object.keys(headers)) if (headers[k] === undefined) delete headers[k];

  const req = { url, method: 'POST', headers, body, opts: { redirection: false } };
  const fetching = $task.fetch(req).then((resp) => {
    let setCookie = splitSetCookie(pickHeaderCI(resp.headers, 'set-cookie'));
    // 业务逻辑第 396 行主动剔掉传入 CK 里的 _m_h5_tk，改由 absorb(setCookie) 自己管，
    // 所以签名用的 this.tk 完全依赖这里读得到 Set-Cookie。部分圈X 版本会把它吞掉，
    // 那样签名恒为空、请求会卡在 FAIL_SYS_TOKEN_EMPTY 死循环。
    // 兜底：读不到就把重写时抓的 _m_h5_tk 伪造成一条 Set-Cookie 喂给 absorb。
    // 圈X 真能读到时这段永不触发，无副作用。
    if (!setCookie.length) {
      const fb = readK(K_H5TK);
      if (fb) setCookie = fb.split(';').map((s) => s.trim()).filter(Boolean);
    }
    return {
      body: resp.body || '',
      setCookie,
      status: resp.statusCode || resp.status || 0,
    };
  });
  const timing = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('请求超时')), 20000)
  );
  return Promise.race([fetching, timing]);
}




/* ==================== 以下业务逻辑与青龙版 eleme_miandan.js 同源 ====================
 * 提取自 eleme_miandan.js 的 56-421 与 466-1367 行，逐行未改。
 * 改动只在传输层(httpPost)、凭证来源($prefs)、推送($notify)和入口。
 * 业务逻辑要改就两边一起改，别让它们漂移。
 */

const APP_KEY = '12574478';
const JSV = '2.7.0';
const HOST = 'rsc-api.ele.me';
const REFERER = 'https://tb.ele.me/';
const SCENE_MAIN = 'ETMD';
const SCENE_TASK = 'ETMD_CHANNEL';
const H5_VERSION = '1.10.20';
// 互动中心是另一个前端工程(engage-hub)，版本号和主会场不同一套
const IC_VERSION = process.env.elmIcVersion || '1.3.11';

/**
 * 每个任务集有自己的 asac 风控令牌，打点/领奖必须带上，否则返回「行为受限」。
 * 取值来自 App 内任务跳转链接的 taskpageviewasac 参数：
 *   tb.ele.me/wow/alsc/mod/xxx?missioncollectid=2602&missionid=xxx
 *     &bizscene=ETMD_CHANNEL&o2i_action=GY_TASK_xxx&taskpageviewasac=alscMXthUCTqlXHJyWj8CZ
 */
/**
 * 内置任务集兜底表。互动中心主态报上来的以它为准，这里只是没报到时的备选。
 *
 * 已知事实:
 *   3112  互动中心(bizScene=interact_center)，跳转链接里出现 58 次，是主力集子
 *   2602  天天免单主会场(bizScene=ETMD_CHANNEL)，实测 5 个任务都在这里
 *   2526  抓包里见过，两次实测任务列表都是空的
 *
 * 不再给集子标「发不发幸运星」——那个判断之前是靠 subTitle 文案猜的，站不住。
 * 任务数据里没有 prizeType 字段，只有领奖返回里有，所以奖励口径按领奖时
 * 打出来的原始 prizeType 记账。同名任务投到不同集子奖励也可能不同。
 */
const COLLECTIONS = [
  { id: '3112', scene: 'interact_center', asac: 'alscFS8BNTO6jivYS7XOAM', name: '互动中心' },
  { id: '2526', scene: 'interact_center', asac: 'alscFS8BNTO6jivYS7XOAM', name: '任务集2526' },
  { id: '2602', scene: 'ETMD_CHANNEL', asac: 'alscMXthUCTqlXHJyWj8CZ', name: '天天免单' },
];
// 领奖用的固定 asac(页面 bundle 里硬编码)
const ASAC_PRIZE = 'alsc576ky60DWZZL6cFDdd';
// 投放系统(Aladdin)校验必须的 ttid，缺了 querytask 会报 CLIENT_PARAM_ALADDIN_DEVICEINFO_ERROR
/**
 * 客户端画像。投放系统(Aladdin)按 ttid 筛客户端，画像不对任务就不下发。
 * 实测只有 app 画像下发过任务(H5 画像任务列表全空)，所以默认 app。
 * 早先以为画像也影响 405，后来证明 405 是机房出口 IP，与画像无关。
 * h5 / bare 两个画像保留给 elmProbe 排查用。
 */
const CLIENT = (process.env.elmClient || 'app').toLowerCase();

const APP_VER = process.env.elmAppVer || '12.8.7';
const IOS_VER = process.env.elmIosVer || '15.0.1';
const DEVICE_MODEL = process.env.elmDevice || 'iPhone10,3';

/** 各画像的 UA 与 ttid。elmTtid / elmUa 可单独覆盖，用于精细排查 */
const PROFILES = {
  app: {
    ttid: `201200@eleme_iphone_${APP_VER}`,
    ua: `MTOPSDK/1.9.3.48 (iOS;${IOS_VER};Apple;${DEVICE_MODEL})`,
  },
  h5: {
    ttid: `H5@Web_iphone_${H5_VERSION}`,
    ua:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) ' +
      'AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  },
  bare: {
    ttid: `201200@eleme_iphone_${APP_VER}`,
    ua:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) ' +
      'AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  },
  /**
   * 微信小程序画像。三个值全部照抄抓包实测:
   *   ttid    wxece3a9a4c82f58c9@wechat_ios_12.6.9
   *   UA      MicroMessenger/8.0.75，159 个带 token 的请求全是这一串
   *   Referer https://servicewechat.com/wxece3a9a4c82f58c9/835/page-frame.html
   * 存在的理由: 手上唯一的真 bx-umidtoken 是小程序生成的(196 字符 S2gA... 那个)，
   * 填 elmUmid 试它的时候身份必须跟着一起换成小程序，否则 token 来源和 ttid
   * 自相矛盾，服务端一交叉校验就白试。用法: elmClient=mini
   */
  mini: {
    ttid: 'wxece3a9a4c82f58c9@wechat_ios_12.6.9',
    ua:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0_1 like Mac OS X) ' +
      'AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ' +
      'MicroMessenger/8.0.75(0x18004b62) NetType/WIFI Language/zh_CN',
    referer: 'https://servicewechat.com/wxece3a9a4c82f58c9/835/page-frame.html',
  },
};

const PROFILE = PROFILES[CLIENT] || PROFILES.app;
const TTID = process.env.elmTtid || PROFILE.ttid;
const UA = process.env.elmUa || PROFILE.ua;

/**
 * 探测模式。开着时对第一个账号的每个任务集，用三种画像各查一次 querytask，
 * 把任务数打出来，用完即止(不做任务、不领奖)。用来定位任务下发的条件。
 */
const PROBE = process.env.elmProbe === 'true';
// 投放要用的经纬度；不填用默认值，只影响“附近门店”类任务的投放，不影响签到
const LNG = process.env.elmLng || '116.397428';
const LAT = process.env.elmLat || '39.90923';

/**
 * 不抽奖(默认 true)。只是不去抽、不领阶段奖励，任务照做。
 *
 * 原先这个开关还会把 2602 整个集子过滤掉，理由是「它发抽奖机会」——但那个判断
 * 站不住: 依据只有任务的 subTitle 文案「抽免单机会+1」，任务数据里根本没有
 * prizeType 字段。bundle 里三处 MD_CHANCE 判断全在签到代码里(判 recordsignin
 * 返回的 stageReward[0].prizeType)，任务路径没有这个判断。
 *
 * 而且实测: 过滤掉 2602 后两个账号一个任务都做不了，真正的 5 个任务全在里面。
 * 幸运星本身是累积货币(bundle: x - miandanDifference > 0 才算换到免单)，
 * 「抽免单机会+1」更像营销文案而不是奖励类型。
 *
 * 所以现在只跳过抽奖动作本身。领奖时会把接口返回的原始 prizeType 打到日志，
 * 一次真实领奖就能确定 2602 到底发什么。
 */
const NO_DRAW = process.env.elmStarOnly !== 'false';
// 是否跳过 2602(天天免单主会场，发抽免单机会)。默认跳，只做幸运星
const STAR_ONLY_COLS = process.env.elmDoChance !== 'true';

/**
 * 是否签到。默认 true（做所有任务），不想签就设 elmSignIn=false。
 * 部分账号签到 stageAward 全是 MD_CHANCE(抽奖机会)，那种号可以关掉省一次请求。
 */
const SIGN_IN =
  process.env.elmSignIn != null
    ? process.env.elmSignIn !== 'false'
    : true;

const DELAY_SEC = num(process.env.elmDelay, 5);
const VIEW_WAIT = process.env.elmViewWait !== 'false';
const DEBUG = process.env.elmDebug === 'true';
// AWSC 设备指纹令牌，见下方 umidToken() 说明
const UMID_ENV = (process.env.elmUmid || '').trim();

/**
 * DeviceId / x-utdid。
 *
 * App 内取的是原生 utdid，纯 H5 兜底走 bundle 里的 ir()，就是个随机 UUID v4
 * (js2/25.js: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(...))，所以这个值
 * 可以自造。但同一个账号最好长期固定，每次换会显得像新设备，所以给个环境变量；
 * 没填就按 CK 派生一个稳定值，不用随机数。
 */
const UTDID_ENV = (process.env.elmUtdid || '').trim();

// 任务状态机(取自页面 bundle)
const STAGE = { NO_REACH: 'NO_REACH', RUNNING: 'RUNNING', FINISH: 'FINISH' };
const REWARD = { TODO: 'TODO', SUCCESS: 'SUCCESS', FAIL: 'FAIL' };
const ITEM = {
  TAKE: 'take',
  TODO: 'todo',
  REWARD: 'reward',
  FINISH: 'finish',
  CYCLE_FINISH: 'cyclefinish',
  EXPIRED: 'expired',
};

function num(v, d) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? d : n;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** bundle 里的 createUuid: 16 进制大写，xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx */
function createUuid() {
  const hex = '0123456789ABCDEF';
  return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    hex.charAt(Math.floor(Math.random() * hex.length))
  );
}

/**
 * bx-umidtoken —— 决定 risk>0 接口能不能过的关键头。
 *
 * 由来: 页面用的 mtop 实例注册了风控中间件
 *   @ali/lib-mtop-middleware-risk-control/2.1.6
 * 它在 isCommonH5(即非饿了么/淘宝 App 的普通浏览器)时给每个请求挂 bx-umidtoken，
 * 值来自 AWSC 设备指纹 SDK(//g.alicdn.com/AWSC/AWSC/awsc.js, appName:"eleme")，
 * 缓存在 ele.me 域下名为 xqkp 的 cookie 里。设备指纹离线算不出来。
 *
 * 全包实测(2026-08-28 那份 332 条 HAR)：没有任何一发请求带 bx-umidtoken。
 * App 原生请求走的是 SecurityGuard 那套 —— x-sgext / x-sign / x-mini-wua
 * (rsc-api.ele.me 上三者齐全)，压根不发这个头。包里仅两发 um.json，且都紧挨着
 * H5 页面(log.mmstat.com/eg.js、render.alipay.com)，即只有活动页 WebView 会调它。
 * ⇒ 拿真令牌只有一条路：MITM 开着用 App 打开活动页，让页面自己调 um.json。
 *   顺带排除 cdn.ynuf.aliapp.org 那 12 发 —— 响应是 {ck,ec,dt}，没有 tn，不是令牌源，
 *   不用往 hostname 里加它。
 *
 * 手机 IP 下打点(riskControl:1)用兜底串也能过，所以它不是 405 的原因；
 * 领奖是 riskControl:2，实测报 RISK_USER，真令牌在那一档可能才是必需的。
 *
 * 取值优先级:
 *   1. elmUmid 环境变量(自己抓一次最靠谱)
 *   2. CK 里夹带的 xqkp cookie
 *   3. 中间件自带的兜底格式。AWSC 没加载成功时它就发这个，
 *      服务端对它有一定容忍度，但能不能过要实测。
 */
function umidToken(ck) {
  if (UMID_ENV) return { v: UMID_ENV, src: 'elmUmid' };
  const fromCk = pick(ck || '', 'xqkp');
  if (fromCk) return { v: fromCk, src: 'CK 里的 xqkp' };
  // 兜底用 default_empty —— 这是真实客户端在 um SDK 没加载出来时发的字面量，
  // 不是自造格式。小程序抓包里它拿到过 14 次 SUCCESS(可解析响应共 25 次)，
  // 说明服务端认这个值；之前那个 defaultToken1_xxx@@uuid@@ts 是我编的，
  // 真客户端从不发，落到风控白名单外必挂。
  return { v: 'default_empty', src: 'default_empty(真客户端兜底串)' };
}

/** 按 CK 派生一个稳定的 UUID v4 形状的 DeviceId，同账号每次跑都一样 */
function deriveUtdid(ck) {
  if (UTDID_ENV) return UTDID_ENV;
  const seed = pick(ck || '', 'unb') || pick(ck || '', 'cookie2') || 'anon';
  const h = crypto.createHash('md5').update(`elm-utdid:${seed}`).digest('hex');
  // 摆成 UUID v4 的样子: 8-4-4-4-12，版本位固定 4，variant 位固定 8..b
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return (
    `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-` +
    `${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`
  );
}

/**
 * x-ele-ua —— 真实页面每个 mtop 请求都带，我之前完全没发。
 *
 * 来源是 bundle 里的 alsc-h5-xua-middleware(js2/25.js)。它注册成 mtop 实例上的
 * 全局中间件，所以 pageview / 领奖 / querytask 全都会带，不是某个接口专属。
 *
 * 两个分支，我们发的是非 ELMC(纯 H5)那支，原文拼法:
 *   C = C + " Mobile/2.8.9 " + j + " DeviceId/" + z + " " + U
 *         + " From/miniapp.taobao H5Version/" + I + " H5Build/" + S + " " + W
 *   最后 appendNativeUA 不为 false 时再接 navigator.userAgent
 * 其中 U 是 channel 三段(UA 里认出 iPhone 就是 ios)，W 是经纬度，S=1。
 */
function xEleUa(ck, client = CLIENT) {
  const dev = deriveUtdid(ck);
  if (client === 'app') {
    // 抓包里原生请求的实测格式，逐字段对齐:
    // Rajax/1 Apple/iPhone10,3 iOS/15.0.1 Eleme/12.8.7 ID/<UUID大写>;
    //   IsJailbroken/0 userMode/standard
    return (
      `Rajax/1 Apple/${DEVICE_MODEL} iOS/${IOS_VER} Eleme/${APP_VER} ` +
      `ID/${dev.toUpperCase()}; IsJailbroken/0 userMode/standard`
    );
  }
  const chan = 'channel/ios subChannel/ios.default subSubChannel/ios.default.default';
  const loc = `Latitude/${LAT} Longitude/${LNG}`;
  return (
    `RenderWay/H5 AppName/h5 Mobile/2.8.9 DeviceId/${dev} ${chan} ` +
    `From/miniapp.taobao H5Version/${H5_VERSION} H5Build/1 ${loc} ${UA}`
  );
}

/**
 * 全局请求头。这些是 et-prefetch.json 的 headers 段和 xua 中间件共同声明的，
 * 每个业务请求都带；缺了会和 UA/ttid 对不上，属于风控的可疑特征。
 *   x-ele-ua     结构化 UA，见 xEleUa()
 *   tb_uid       淘宝 uid，CK 里的 unb
 *   x-utdid      设备号，和 x-ele-ua 里的 DeviceId 必须一致
 *   x-decode-ua  iOS 固定 'true'(bundle: isIOS && (f = "true"))
 */
function globalHeaders(ck, client = CLIENT) {
  // bare 画像不发任何附加头，用来复现最早那次能拿到任务的配置
  if (client === 'bare') return {};
  const uid = pick(ck || '', 'unb') || pick(ck || '', 'USERID') || '';
  const h = {
    'x-ele-ua': xEleUa(ck, client),
    'x-utdid': deriveUtdid(ck),
  };
  if (client === 'app') {
    // 原生请求带的是 x-uid，不是 H5 那套 tb_uid/x_uid
    if (uid) h['x-uid'] = uid;
    h['x-app-ver'] = APP_VER;
  } else {
    h['x-decode-ua'] = 'true';
    if (uid) {
      h.tb_uid = uid;
      h.x_uid = uid;
    }
  }
  return h;
}

function ts() {
  const d = new Date(Date.now() + 8 * 3600 * 1000); // 固定东八区，避免容器 TZ 未设
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

const LOG = [];
function log(msg) {
  const line = `[${ts()}] ${msg}`;
  console.log(line);
  LOG.push(line);
}
function dbg(msg) {
  if (DEBUG) log(`  [debug] ${msg}`);
}

/** 拆分多账号: 优先换行，其次 @ 或 & */
function splitAccounts(raw) {
  if (!raw) return [];
  let parts = raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 1) {
    const one = parts[0];
    // cookie 内部用 "; " 分隔，@ / & 才是账号分隔符
    if (one.includes('@')) parts = one.split('@');
    else if (/&\s*cookie2=/i.test(one)) parts = one.split(/&(?=\s*cookie2=)/i);
  }
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** 从 CK 串里取某个字段 */
function pick(ck, name) {
  const m = ck.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1].trim() : '';
}

/**
 * 只保留业务需要的登录态字段，并把 CK 洗成 Node 能塞进 header 的样子。
 *
 * Node 的 checkInvalidHeaderChar 会拒绝码点不在 [\t\x20-\x7e\x80-\xff] 的字符，
 * 而 yyb 推的 CK 里常夹带中文昵称(nick/_nk_/tracknick)、emoji、全角空格，
 * 直接塞就报 Invalid character in header content ["Cookie"]。
 * 处理办法和浏览器一致: 值里的非 ASCII 百分号编码，控制字符整段丢掉。
 */
function cleanCookie(ck) {
  const out = [];
  // CR/LF 当分隔符切开，不能直接删——删了会把相邻两对粘成一个废值，
  // 顺手也就挡掉了 header 注入
  for (const raw of String(ck).split(/[;\r\n]/)) {
    const seg = raw.replace(/　/g, ' ').trim(); // 全角空格归一化
    if (!seg) continue;
    const i = seg.indexOf('=');
    if (i <= 0) continue;
    const name = seg.slice(0, i).trim();
    let val = seg.slice(i + 1).trim();
    if (/^_m_h5_tk/i.test(name)) continue; // token 由脚本自己管
    // cookie 名必须是纯 ASCII token，含中文的整对丢掉
    if (!/^[\w!#$%&'*+\-.^`|~]+$/.test(name)) continue;
    if (/[^\t\x20-\x7e]/.test(val)) {
      // u 标志不能少：emoji 是代理对，逐码元编码会抛 URIError
      val = val.replace(/[^\t\x20-\x7e]/gu, (ch) => {
        try {
          return encodeURIComponent(ch);
        } catch (e) {
          return ''; // 孤立代理等无法编码的，直接丢
        }
      });
    }
    out.push(`${name}=${val}`);
  }
  return out.join('; ');
}

/**
 * mtop H5 网关请求。
 *
 * 这些业务接口在页面 bundle 里全部声明为 type:"POST"（querytask / pageview /
 * receiveprize / recordsignin / icondraw / stage.reward / homepage ...），
 * data 走 form-urlencoded 请求体，签名参数留在 query 上。
 * 用 GET 打会被判「行为受限」，这是打点一直失败的根因。
 */

class Mtop {
  constructor(cookie, client = CLIENT) {
    this.login = cleanCookie(cookie);
    this.tk = ''; // _m_h5_tk 前半段，用于签名
    this.tkCookie = ''; // _m_h5_tk / _m_h5_tk_enc 原样回传
    // 风控中间件是注册在 mtop 实例上的全局中间件，真实页面每个请求都带，
    // 所以这里也整个会话固定一个值，而不是按接口挑
    const u = umidToken(cookie);
    this.umid = u.v;
    this.umidSrc = u.src;
    // 画像相关的三样东西整会话固定: ttid、UA、xua 中间件那批头
    this.client = client;
    this.ttid = process.env.elmTtid || (PROFILES[client] || PROFILE).ttid;
    this.ua = process.env.elmUa || (PROFILES[client] || PROFILE).ua;
    // 小程序画像的 Referer 是 servicewechat.com，不是 tb.ele.me。画像没给就用默认
    this.referer = (PROFILES[client] || PROFILE).referer || REFERER;
    this.gh = globalHeaders(cookie, client);
  }

  absorb(setCookie) {
    const jar = {};
    this.tkCookie
      .split('; ')
      .filter(Boolean)
      .forEach((kv) => {
        const i = kv.indexOf('=');
        if (i > 0) jar[kv.slice(0, i)] = kv.slice(i + 1);
      });
    setCookie.forEach((sc) => {
      const kv = sc.split(';')[0];
      const i = kv.indexOf('=');
      if (i < 0) return;
      const k = kv.slice(0, i).trim();
      if (/^_m_h5_tk/i.test(k)) jar[k] = kv.slice(i + 1).trim();
    });
    this.tkCookie = Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    if (jar._m_h5_tk) this.tk = jar._m_h5_tk.split('_')[0];
  }

  async once(api, v, data, extraHeaders = {}) {
    const t = String(Date.now());
    const dj = JSON.stringify(data);
    const sign = crypto
      .createHash('md5')
      .update(`${this.tk}&${t}&${APP_KEY}&${dj}`)
      .digest('hex');
    // 签名参数走 query，data 走 POST body
    const qs = new URLSearchParams({
      jsv: JSV,
      appKey: APP_KEY,
      t,
      sign,
      api,
      v,
      ttid: this.ttid, // 必须在 query 上，不能放 data 里
      type: 'originaljson',
      dataType: 'json',
      timeout: '20000',
    });
    const url = `https://${HOST}/h5/${api}/${v}/?${qs}`;
    const body = `data=${encodeURIComponent(dj)}`;
    const cookie = [this.login, this.tkCookie].filter(Boolean).join('; ');
    const res = await httpPost(url, body, cookie, {
      'User-Agent': this.ua,
      Referer: this.referer,
      // Origin 跟着 Referer 走。小程序侧 Origin 应缺省(微信不发)，用 null 让下游删掉
      Origin: this.referer === REFERER ? 'https://tb.ele.me' : undefined,
      'bx-umidtoken': this.umid,
      ...this.gh,
      ...extraHeaders,
    });
    this.absorb(res.setCookie);
    let json;
    try {
      json = JSON.parse(res.body);
    } catch (e) {
      throw new Error(`返回非 JSON: ${res.body.slice(0, 120)}`);
    }
    return json;
  }

  /** 带 token 换取 / 风控退避的调用 */
  async call(api, v, data = {}, extraHeaders = {}, tries = 4) {
    let last;
    for (let i = 0; i < tries; i++) {
      last = await this.once(api, v, data, extraHeaders);
      const ret = (last.ret || []).join(';');
      if (/TOKEN_EMPTY|TOKEN_EXPIRED/.test(ret)) {
        // 首次拿 token，或 token 过期，立即重签
        await sleep(500);
        continue;
      }
      if (/RGV587|FAIL_SYS_USER_VALIDATE|被挤爆/.test(ret)) {
        const wait = 3000 * (i + 1);
        dbg(`${api} 触发风控，${wait / 1000}s 后重试: ${ret}`);
        await sleep(wait);
        continue;
      }
      if (/FAIL_SYS_TRAFFIC_LIMIT|限流/.test(ret)) {
        await sleep(2000 * (i + 1));
        continue;
      }
      return last;
    }
    return last;
  }
}

// ---------- 返回解析 ----------
const isOk = (r) => /^SUCCESS/.test(((r || {}).ret || [''])[0] || '');
const retMsg = (r) => {
  const s = (((r || {}).ret || [''])[0] || '未知错误').split('::');
  return s[1] || s[0];
};
/** 主态/签到类接口: mtop 外层 data 里还套一层业务 data */
const biz = (r) => ((r || {}).data || {}).data || {};
/** 任务类接口(querytask 等)直接挂在 data 上，没有第二层 */
const flat = (r) => (r || {}).data || {};
/** 任务列表兼容两种层级 */
const mlistOf = (r) => flat(r).mlist || biz(r).mlist || [];

/** 深度查找第一个非空的指定字段 */
function deepFind(obj, key) {
  let hit = null;
  const walk = (o) => {
    if (hit != null || !o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    for (const [k, v] of Object.entries(o)) {
      if (hit != null) return;
      if (k === key && v != null && v !== '') {
        hit = v;
        return;
      }
      walk(v);
    }
  };
  walk(obj);
  return hit;
}

/**
 * 同 deepFind，但收集所有命中而不是只取第一个。
 * 互动中心返回里任务集 ID 可能出现在多个组件下，全捞出来再去重。
 * 顺手也钻进 JSON 字符串，因为组件数据常以字符串形式嵌套。
 */
function deepFindAll(obj, key) {
  const out = [];
  const seen = new Set();
  const walk = (o) => {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    if (Array.isArray(o)) return o.forEach(walk);
    for (const [k, v] of Object.entries(o)) {
      if (k === key && v != null && v !== '') out.push(v);
      if (typeof v === 'string' && /^\s*[{[]/.test(v)) {
        try {
          walk(JSON.parse(v));
        } catch (e) {
          /* 不是 JSON，忽略 */
        }
      } else walk(v);
    }
  };
  walk(obj);
  return out;
}

/** 投放系统需要的位置参数 */
function locParams() {
  return {
    longitude: LNG,
    latitude: LAT,
    locationInfos: JSON.stringify([JSON.stringify({ lng: LNG, lat: LAT })]),
  };
}
/** 业务层错误(errorCode !== 0) */
function bizErr(r) {
  const d = (r || {}).data || {};
  const code = d.errorCode;
  if (code && String(code) !== '0') return d.errorMsg || `错误码 ${code}`;
  return '';
}

/**
 * 奖励名称。规则取自页面 bundle 原文的三元判断:
 *   "，获得".concat(x, "MD_CHANCE"===_ ? "次抽奖机会" : "幸运星")
 *   I = "连签".concat(g,"天得").concat(_,"幸运星");
 *   "MD_CHANCE"===C && (I = "连签".concat(g,"天得").concat(_,"次抽奖机会"))
 * 即 MD_CHANCE 是「抽奖机会」(2602 天天免单抽免单用的次数)，
 * 其余奖励类型才是「幸运星」(3112 互动中心那套)。
 * 接口下发 prizeTypeName 时优先用它，避免映射漏了新类型。
 */
const PRIZE_NAME = {
  MD_CHANCE: '抽奖机会',
  LUCKY_STAR: '幸运星',
  INTEGRAL_PROPERTY: '幸运星',
  COUPON: '优惠券',
  RED_PACKET: '红包',
};
// 未知类型按 bundle 的兜底分支当幸运星，但保留原始 type 便于排查
const prizeName = (t, name) =>
  name || PRIZE_NAME[t] || (t ? `幸运星(${t})` : '奖励');

/** 只把原始 prizeType 挖出来，不做任何翻译，用于核对集子的奖励口径 */
function rawPrizeTypes(obj) {
  const out = [];
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    const t = o.prizeType || o.uppPrizeType;
    if (t) out.push(t);
    Object.values(o).forEach((v) => {
      if (typeof v === 'string' && /^\s*[{[]/.test(v)) {
        try {
          walk(JSON.parse(v));
        } catch (e) {
          /* 非 JSON 字符串 */
        }
      } else walk(v);
    });
  };
  walk(obj);
  return out;
}

/** 从各种奖励结构里抽出 "幸运星x2" 这样的描述 */
function describeRewards(obj) {
  const out = [];
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    const type = o.prizeType || o.uppPrizeType;
    const val = o.prizeValue || o.equityValue || o.value;
    if (type && val) out.push(`${prizeName(type, o.prizeTypeName)}x${val}`);
    Object.values(o).forEach((v) => {
      if (typeof v === 'string' && /^\s*[{[]/.test(v)) {
        try {
          walk(JSON.parse(v));
        } catch (e) {
          /* 非 JSON 字符串，忽略 */
        }
      } else walk(v);
    });
  };
  walk(obj);
  return [...new Set(out)];
}

/** 任务项当前状态，逻辑与页面 resolveItemStatus 一致 */
function itemStatus(m) {
  const stages = m.missionStageDTOS || [];
  if (m.receiveType === 'RECEIVE' && m.receiveStatus === 'TORECEIVE') return ITEM.TAKE;
  let running = false;
  for (const s of stages) {
    if (s.status === STAGE.RUNNING) running = true;
    if (claimable(s)) return ITEM.REWARD;
  }
  if (running) {
    if ((m.extInfo || {}).todayDone) return ITEM.CYCLE_FINISH;
    if (m.endDate && Date.now() - new Date(m.endDate.replace(/-/g, '/')).getTime() > 0)
      return ITEM.EXPIRED;
    return ITEM.TODO;
  }
  return ITEM.FINISH;
}

/** 该阶段是否有待领奖励 */
function claimable(s) {
  const sa = s.sourceAction || {};
  return (
    s.status === STAGE.FINISH &&
    s.rewardStatus !== REWARD.SUCCESS &&
    sa.actionSubtype !== 'NO_REWARD' &&
    sa.actionSubSubType !== 'REWARD_SEND_AUTO' &&
    sa.actionSubSubType !== 'NOTIFY_REACH_STAGE'
  );
}

/** 待领奖阶段下标 */
function claimIndex(m) {
  const stages = m.missionStageDTOS || [];
  for (let i = 0; i < stages.length; i++) if (claimable(stages[i])) return i;
  return -1;
}

/**
 * 领奖失败时把定位信息打全。领奖是 riskControl:2(全链路最高一档)，
 * 失败可能是发奖被风控拦、阶段没落库、入参不对 —— 光看服务端那句
 * 「奖励全部失败」区分不出来，所以入参和原始返回一起落日志。
 */
function logClaimCtx(col, p, r) {
  log(
    `      → POST receiveprize v1.0 任务集=${col.id}(${col.scene}) asac=${ASAC_PRIZE}`
  );
  log(
    `      → 入参 count=${p.count == null ? '未带' : p.count} ` +
      `sum=${p.sum == null ? '未带' : p.sum} ` +
      `instanceId=${p.instanceId == null ? '未带' : '已带'}`
  );
  log(`      → ret=${((r || {}).ret || []).join(';') || '无'}`);
  const d = (r || {}).data;
  if (d != null) {
    let s = '';
    try {
      s = JSON.stringify(d);
    } catch (e) {
      s = String(d);
    }
    log(`      → data=${s.length > 400 ? s.slice(0, 400) + '…(截断)' : s}`);
  }
}

/**
 * 发奖侧点名账号被风控时(百川决策引擎返回 RISK_USER / NO_DECISION_ITEM)，
 * 重试和换头都不会变结果 —— 原样再打一遍只是多敲一次风控账号。
 * 判据取服务端自己的话，不做猜测。
 */
function riskRefused(r) {
  let s = '';
  try {
    s = JSON.stringify((r || {}).data || '') + ((r || {}).ret || []).join(';');
  } catch (e) {
    s = ((r || {}).ret || []).join(';');
  }
  return /RISK_USER|NO_DECISION_ITEM|风控用户/.test(s);
}

// ---------- 接口封装 ----------
const API = {
  // 全屏主态查询 v2：拿 missionCollectionId / 卡片状态
  homepage: (c) =>
    c.call(
      'mtop.alsc.interact.et.md.homepage',
      '1.0',
      { bizScene: SCENE_MAIN, version: H5_VERSION, ...locParams() },
      { asac: 'alsc6AD8Rni21gsqJ5rceg' }
    ),
  /**
   * 互动中心主态 —— 幸运星那一侧的数据源，之前完全没调过。
   *
   * 参数照 engage-hub 的 et-prefetch.json 原样发(preRequest 段声明的就是页面
   * 首屏请求)：bizScene=interact_center、cpnCodes 那串组件码、version=1.3.11。
   * 里面的 STAR_MSG_CONTENT_CPN / INTERACT_CENTER_LOTTERY 是幸运星和抽奖的组件。
   *
   * md.homepage 拿到的是天天免单主会场(2602，发抽奖机会)，这个才是互动中心，
   * 任务集 ID 应当从这里取，而不是拿 2602 去猜。
   */
  interactHome: (c) =>
    c.call(
      'mtop.alsc.interact.et.interact.center.homepage',
      '1.0',
      {
        bizScene: 'interact_center',
        version: IC_VERSION,
        cpnCodes: JSON.stringify([
          'PLAY_NOTICE_CPN',
          'INTERACT_RESOURCE_CPN',
          'MORE_MENU_CPN',
          'STAR_MSG_CONTENT_CPN',
          'PLAY_RESOURCE_CPN',
          'INTERACT_CENTER_SKIN_COMPONENT',
          'INTERACT_CENTER_BUBBLE',
          'INTERACT_CENTER_LOTTERY',
        ]),
        ...locParams(),
      },
      { asac: COLLECTIONS[0].asac }
    ),
  // 签到查询 / 记录签到
  signInfo: (c) =>
    c.call('mtop.koubei.interactioncenter.sign.component.querysigninfo', '1.0', {
      bizScene: SCENE_MAIN,
    }),
  signIn: (c, copyId) =>
    c.call(
      'mtop.koubei.interactioncenter.sign.component.recordsignin',
      '1.1',
      { bizScene: SCENE_MAIN, copyId },
      { asac: 'alscTE55RJS59KBpKaL4kk' } // 签到专用 asac，缺了报风控异常
    ),
  // 任务查询 / 领任务 / 浏览打点 / 领奖
  queryTask: (c, col) =>
    c.call('mtop.ele.biz.growth.task.core.querytask', '1.0', {
      missionCollectionId: col.id,
      bizScene: col.scene,
      accountPlan: 'HAVANA_COMMON',
      ...locParams(),
    }),
  takeTask: (c, col, missionId) =>
    c.call('mtop.ele.biz.growth.task.core.receivetask', '1.0', {
      missionCollectionId: col.id,
      missionId,
      bizScene: col.scene,
      accountPlan: 'HAVANA_COMMON',
      ...locParams(),
    }),
  // asac 必须走 header，放 data 里无效
  pageView: (c, col, p) =>
    c.call(
      'mtop.ele.biz.growth.task.event.pageview',
      '1.1',
      {
        sync: true,
        collectionId: col.id,
        missionId: p.missionId,
        pageFrom: p.pageFrom || '',
        actionCode: p.actionCode,
        viewTime: p.viewTime,
        bizScene: col.scene,
        accountPlan: 'HAVANA_COMMON',
        ...locParams(),
      },
      { asac: col.asac }
    ),
  receivePrize: (c, col, p) => {
    // 留最后一发的 data/头，供 diffRealClaim 和 App 真实请求逐字比
    const d = {
      missionCollectionId: col.id,
      missionId: p.missionId,
      bizScene: col.scene,
      accountPlan: 'HAVANA_COMMON',
      ...locParams(),
    };
    // 真实返回里 id / stageSum 常为 null，为 null 就不要带上
    if (p.instanceId != null) d.instanceId = p.instanceId;
    if (p.count != null) d.count = p.count;
    if (p.sum != null) d.sum = p.sum;
    // bundle 里 receiveprize 是 i.asac=... 写进 data 的，外层封装又把它抬进 header，
    // 所以两处都带；注意这个值是数字 0 开头，和 stage.reward 那个字母 O 的不是同一个
    d.asac = ASAC_PRIZE;
    const hdr = { asac: ASAC_PRIZE };
    lastClaimData = d;
    lastClaimHeaders = Object.assign({ 'bx-umidtoken': c.umid || '' }, hdr);
    return c.call('mtop.ele.biz.growth.task.core.receiveprize', '1.0', d, hdr);
  },
  // 主态抽奖(用抽奖机会抽免单) / 阶段性奖励
  iconDraw: (c) =>
    c.call(
      'mtop.ele.growth.fission.client.etmd.et.icondraw',
      '1.0',
      { bizScene: SCENE_MAIN, version: H5_VERSION, token: '', ...locParams() },
      { asac: 'alsc6AD8Rni21gsqJ5rceg' }
    ),
  // 注意 asac 是字母 O(alsc576ky6O...)，和 receiveprize 的数字 0 版本只差一个字符
  stageReward: (c) =>
    c.call(
      'mtop.ele.growth.fission.client.etmd.et.stage.reward',
      '1.0',
      { bizScene: SCENE_MAIN, version: H5_VERSION, token: '', ...locParams() },
      { asac: 'alsc576ky6ODWZZL6cFDdd' }
    ),
  // 免单卡列表
  cardList: (c) =>
    c.call('mtop.ele.growth.fission.client.etmd.et.instancelist', '1.0', {
      bizScene: SCENE_MAIN,
    }),
};

// ---------- 签到 ----------
async function doSignIn(c, sum) {
  const info = await API.signInfo(c);
  if (!isOk(info)) {
    log(`  签到查询失败: ${retMsg(info)}`);
    sum.fail.push('签到查询失败');
    return;
  }
  const d = biz(info);
  const ext = d.extInfo || {};
  const list = d.signInPrizeList || [];
  const done = list.filter((x) => x.signIn).length;
  log(`  活动: ${ext.signInName || '连续签到'}（周期 ${ext.signInCycleDays || list.length} 天）`);
  log(`  进度: 已签 ${done}/${list.length} 天，今日${d.signIn ? '已签' : '未签'}`);
  list.forEach((p) => {
    const aw = ((p.ext || {}).stageAward || [{}])[0];
    const mark = p.signIn ? '√' : p.today === 1 ? '←今天' : ' ';
    log(
      `    第${p.dayNo}天 ${p.dayName} ${prizeName(aw.prizeType, aw.prizeTypeName)}x${aw.value || '?'} ${mark}`
    );
  });

  if (d.signIn) {
    log('  今日已签到，跳过');
    sum.sign = `已签(${done}/${list.length}天)`;
    return;
  }
  if (!ext.copyId) {
    log('  未取到 copyId，无法签到');
    sum.fail.push('签到缺 copyId');
    return;
  }
  const r = await API.signIn(c, ext.copyId);
  const be = bizErr(r);
  if (!isOk(r) || be) {
    const msg = be || retMsg(r);
    log(`  签到失败: ${msg}`);
    // 「风控异常」是业务层文案，本身不说明原因。把 ret 原文和定位信息打全，
    // 才能区分是 asac / 会话 / copyId / IP 哪一类
    log(
      `    → POST recordsignin v1.1 copyId=${ext.copyId} ` +
        `asac=alscTE55RJS59KBpKaL4kk ret=${((r || {}).ret || []).join(';') || '无'}`
    );
    if (DEBUG) log(`    [debug] 完整返回 ${JSON.stringify(r).slice(0, 600)}`);
    sum.fail.push(`签到失败(${msg})`);
    return;
  }
  const got = describeRewards(biz(r));
  log(`  签到成功 ${got.length ? '获得 ' + got.join(' ') : ''}`);
  sum.sign = `成功${got.length ? ' ' + got.join(' ') : ''}`;
  got.forEach((g) => sum.gain.push(g));
}

// ---------- 任务 ----------
const TASK_KIND = {
  PAGEVIEW: '浏览任务',
  P2P: '邀请助力',
  THIRD: '店内点击',
  TIMESIGNIN: '定时签到',
  SIMPLESIGNIN: '每日签到',
};
const kindOf = (t) => TASK_KIND[t] || t || '未知类型';
/**
 * 做不了的类型:
 *   P2P   —— 邀请助力，要真人点分享链接
 *   THIRD —— scenceCode=commercial_click，要在信息流里真实点店铺，
 *            埋点链路是 mtop.o2o.ad.action.get(gmkey=CLK + shop_id + o2i_action)，
 *            pid/etype/epid 是每个广告位实时下发的，伪造无意义且属于广告计费链路。
 */
const MANUAL_ONLY = new Set(['P2P', 'THIRD']);

async function doTasks(c, col, sum) {
  const q = await API.queryTask(c, col);
  if (!isOk(q)) {
    log(`  [${col.name}] 任务查询失败: ${retMsg(q)}`);
    sum.fail.push(`${col.name}任务查询失败(${retMsg(q)})`);
    return;
  }
  const list = mlistOf(q);
  if (!list.length) {
    log(`  [${col.name}] 任务列表为空`);
    return;
  }
  log(`  [${col.name}] 共 ${list.length} 个任务:`);

  for (const m of list) {
    const ac = m.actionConfig || {};
    const av = ac.actionValue || {};
    const st = itemStatus(m);
    // 标题里可能有 {current}/{total} 占位符，用真实进度填掉
    const stagesArr = m.missionStageDTOS || [];
    const doneCnt = stagesArr.filter(
      (s) => s.status === STAGE.FINISH || s.rewardStatus === REWARD.SUCCESS
    ).length;
    const totalCnt = av.finalStageCount || stagesArr.length || 1;
    const title = String(m.showTitle || m.missionDefId)
      .replace('{current}', doneCnt)
      .replace('{total}', totalCnt);
    log(
      `    · ${title} [${kindOf(ac.actionType)}] 状态=${st} 进度=${doneCnt}/${totalCnt}`
    );
    if (m.subTitle) log(`      ${m.subTitle}`);

    // 已完成的不用再跑，但仍要走下面的领奖检查
    const finished = st === ITEM.FINISH || st === ITEM.CYCLE_FINISH;

    if (MANUAL_ONLY.has(ac.actionType) && !finished) {
      const why =
        ac.actionType === 'P2P'
          ? '需真人点分享链接'
          : `需真实点击店铺(${av.scenceCode || 'commercial_click'})`;
      log(`      ${kindOf(ac.actionType)}${why}，跳过`);
      sum.skip.push(title);
      continue;
    }

    try {
      if (st === ITEM.TAKE) {
        const r = await API.takeTask(c, col, m.missionDefId);
        log(`      领取任务: ${isOk(r) ? '成功' : '失败 ' + retMsg(r)}`);
        await sleep(800);
      }

      // 浏览类任务：按配置时长打点。pageStageTime 服务端下发的是字符串
      if (ac.actionType === 'PAGEVIEW' && (st === ITEM.TODO || st === ITEM.TAKE)) {
        const viewTime = num(av.pageStageTime, 15);
        const wait = Math.min(viewTime, 30);
        if (VIEW_WAIT) {
          log(`      浏览中，等待 ${wait}s ...`);
          await sleep(wait * 1000);
        }
        const r = await API.pageView(c, col, {
          missionId: m.missionDefId,
          // pageSpm 下发的是占位符 "page.spm"，占位符就不要往上传
          pageFrom: av.pageSpm === 'page.spm' ? '' : av.pageSpm,
          actionCode: ac.actionType,
          viewTime,
        });
        const be = bizErr(r);
        if (isOk(r) && !be) {
          log('      浏览打点: 成功');
          sum.taskDone.push(title);
        } else {
          const msg = be || retMsg(r);
          log(`      浏览打点: 失败 ${msg}`);
          // 把定位信息打全，方便区分是令牌/参数/IP 哪一类
          log(
            `      → POST pageview v1.1 任务集=${col.id}(${col.scene}) ` +
              `asac=${col.asac} umid=${c.umidSrc} ` +
              `ret=${((r || {}).ret || []).join(';') || '无'}`
          );
          if (/405|行为受限|受限/.test(msg)) {
            // 实测 405 主因是机房出口 IP(手机上兜底串 10/10 过)，不是这个头
            if (c.umidSrc === '兜底格式(未验证)')
              log(
                '      → 兜底令牌没过。请在手机上打开一次天天免单页面抓 bx-umidtoken，' +
                  '填进环境变量 elmUmid'
              );
            else log('      → 真令牌也被拒，可能已过期，重抓 elmUmid；仍不行再考虑换出口 IP');
          }
        }
        await sleep(1200);
      }

      // 领奖：重查一次拿最新阶段
      const fresh = await API.queryTask(c, col);
      const cur = mlistOf(fresh).find((x) => x.missionDefId === m.missionDefId);
      const target = cur || m;
      const idx = claimIndex(target);

      // 打点后服务端到底记没记 —— 这一行是判断"打点成功"是真是假的唯一依据。
      // claimable() 要求 status===FINISH，所以 idx>=0 本身就证明阶段已落库。
      const fStages = target.missionStageDTOS || [];
      const fDone = fStages.filter(
        (s) => s.status === STAGE.FINISH || s.rewardStatus === REWARD.SUCCESS
      ).length;
      log(
        `      重查: 状态=${itemStatus(target)} 进度=${fDone}/${fStages.length || 1} ` +
          `阶段=[${fStages
            .map((s) => `${s.status || '?'}/${s.rewardStatus || '-'}`)
            .join(' ')}]`
      );

      if (idx >= 0) {
        const stage = fStages[idx] || {};
        const p = {
          missionId: target.missionDefId,
          instanceId: target.id,
          count: stage.stageCount,
          sum: stage.stageSum,
        };
        let r = await API.receivePrize(c, col, p);
        let be = bizErr(r);
        // 阶段刚落库就领，可能抢在发奖服务前面。失败就等 3s 重试一次(只一次)
        if (!(isOk(r) && !be)) {
          logClaimCtx(col, p, r);
          // 有 App 真实请求快照就逐字对账，直接指出差在哪个字段/哪个头
          diffRealClaim(lastClaimData, lastClaimHeaders);
          if (riskRefused(r)) {
            // 发奖侧点名风控，重试无意义，直接落账
            log('      发奖侧点名账号风控(RISK_USER)，不重试');
            sum.riskHit = true;
          } else {
            log(`      领奖第 1 次失败: ${be || retMsg(r)}，等 3s 重试`);
            await sleep(3000);
            r = await API.receivePrize(c, col, p);
            be = bizErr(r);
          }
        }
        if (isOk(r) && !be) {
          const got = describeRewards(biz(r));
          log(`      领奖成功 ${got.join(' ')}`);
          // 同名任务在不同集子里奖励可能不同，把原始 prizeType 落到日志，
          // 便于核对某个集子到底发幸运星还是抽奖机会
          const types = [
            ...new Set(rawPrizeTypes(biz(r)).filter(Boolean)),
          ];
          if (types.length)
            log(`      奖励类型: ${types.join('/')} (任务集 ${col.id})`);
          got.forEach((g) => sum.gain.push(g));
          if (!sum.taskDone.includes(title)) sum.taskDone.push(title);
        } else {
          log(`      领奖失败(已重试): ${be || retMsg(r)}`);
          logClaimCtx(col, p, r);
          sum.claimFail.push(title);
        }
        await sleep(1000);
      } else if (st === ITEM.CYCLE_FINISH || st === ITEM.FINISH) {
        log('      已完成，无待领奖励');
        sum.preClaimed += 1;
      } else {
        // 之前这里是静默 continue —— 2602 那 3 个"打点成功但没领奖"就是掉这儿了
        const why = fStages.length
          ? fStages
              .map((s, i) => {
                const sa = s.sourceAction || {};
                if (s.status !== STAGE.FINISH) return `阶段${i}未完成(${s.status})`;
                if (s.rewardStatus === REWARD.SUCCESS) return `阶段${i}已领过`;
                if (sa.actionSubtype === 'NO_REWARD') return `阶段${i}本身无奖励`;
                if (sa.actionSubSubType === 'REWARD_SEND_AUTO')
                  return `阶段${i}奖励自动发放`;
                if (sa.actionSubSubType === 'NOTIFY_REACH_STAGE') return `阶段${i}仅通知`;
                return `阶段${i}不可领`;
              })
              .join('，')
          : '服务端没返回阶段信息';
        log(`      无可领阶段: ${why}`);
      }
    } catch (e) {
      log(`      任务异常: ${e.message}`);
      sum.fail.push(`${title}: ${e.message}`);
    }
    await sleep(600);
  }
}

// ---------- 抽奖 / 阶段奖励 ----------
async function doDraw(c, sum) {
  // 阶段性奖励(累计达标自动给)
  const sr = await API.stageReward(c);
  if (isOk(sr) && !bizErr(sr)) {
    const got = describeRewards(Object.keys(biz(sr)).length ? biz(sr) : flat(sr));
    if (got.length) {
      log(`  阶段奖励: 获得 ${got.join(' ')}`);
      got.forEach((g) => sum.gain.push(g));
    } else {
      log('  阶段奖励: 暂无可领');
    }
  } else {
    log(`  阶段奖励: ${bizErr(sr) || retMsg(sr)}`);
  }
  await sleep(1200);

  // 用抽奖机会抽免单，抽到没有机会为止
  for (let i = 1; i <= 12; i++) {
    const r = await API.iconDraw(c);
    const be = bizErr(r);
    if (!isOk(r) || be) {
      log(`  第${i}次抽奖: ${be || retMsg(r)}`);
      break;
    }
    const d = Object.keys(biz(r)).length ? biz(r) : flat(r);
    const got = describeRewards(d);
    const left = d.residueCnt != null ? d.residueCnt : d.remainCount;
    log(
      `  第${i}次抽奖: ${got.length ? '获得 ' + got.join(' ') : '无奖励'}${
        left != null ? `，剩余机会 ${left}` : ''
      }`
    );
    got.forEach((g) => sum.gain.push(g));
    if (left != null && Number(left) <= 0) break;
    if (!got.length && left == null) break; // 无法判断则不空转
    await sleep(1500);
  }
}

// ---------- 单账号 ----------
/**
 * 探测模式。对每个任务集用三种画像各查一次 querytask，只读，不做任务不领奖。
 *
 * 目的是把「任务下发」和「打点风控」这两件事分开定位:
 *   哪个画像能拿到任务 → 决定 elmClient 该设成什么
 */
async function runProbe(ck, sum) {
  log('  === 探测模式(elmProbe=true)，只读不做任务 ===');
  const names = ['app', 'h5', 'bare'];
  const grid = {};

  for (const client of names) {
    const c = new Mtop(ck, client);
    log(`\n  --- 画像 ${client}`);
    log(`      ttid     : ${c.ttid}`);
    log(`      UA       : ${c.ua.slice(0, 70)}`);
    log(`      附加头   : ${Object.keys(c.gh).join(', ') || '(无)'}`);
    if (c.gh['x-ele-ua']) log(`      x-ele-ua : ${c.gh['x-ele-ua'].slice(0, 90)}`);

    // 先打一次主页，把 _m_h5_tk 换回来
    try {
      const hp = await API.homepage(c);
      log(`      主页     : ${isOk(hp) ? '成功' : '失败 ' + retMsg(hp)}`);
    } catch (e) {
      log(`      主页     : 异常 ${e.message}`);
    }
    await sleep(800);

    for (const col of COLLECTIONS) {
      let line = `      任务集 ${col.id}(${col.scene}) : `;
      try {
        const r = await API.queryTask(c, col);
        if (!isOk(r)) {
          line += `查询失败 ${retMsg(r)}`;
        } else {
          const list = biz(r).mlist || flat(r).mlist || [];
          const n = Array.isArray(list) ? list.length : 0;
          const todo = Array.isArray(list)
            ? list.filter((x) => x.status === 'RUNNING' || x.status === 'NO_REACH').length
            : 0;
          line += `${n} 个任务`;
          if (n) line += `（其中未完成 ${todo}）`;
          grid[`${client}/${col.id}`] = n;
        }
      } catch (e) {
        line += `异常 ${e.message}`;
      }
      log(line);
      await sleep(1000);
    }
    await sleep(1500);
  }

  log('\n  === 探测结果矩阵（任务数）===');
  log(`      画像\\任务集   ${COLLECTIONS.map((c) => c.id.padStart(6)).join('')}`);
  for (const client of names) {
    const row = COLLECTIONS.map((col) => {
      const v = grid[`${client}/${col.id}`];
      return String(v == null ? '-' : v).padStart(6);
    }).join('');
    log(`      ${client.padEnd(12)}${row}`);
  }
  const best = Object.entries(grid).filter(([, v]) => v > 0);
  if (best.length) {
    log(`\n      有任务的组合: ${best.map(([k, v]) => `${k}=${v}个`).join('  ')}`);
    log(`      → 把 elmClient 设成上面能拿到任务的那个画像，关掉 elmProbe 再跑`);
  } else {
    log('\n      三种画像都拿不到任务。说明不是画像的事，');
    log('      更可能是活动到期/账号已做完/任务按时段投放。');
  }
  sum.sign = '探测模式';
  return sum;
}

async function runAccount(ck, idx, total) {
  const sum = {
    idx,
    name: '',
    sign: '未执行',
    taskDone: [],
    skip: [],
    gain: [],
    fail: [],
    claimFail: [], // 打点成功但领奖失败 —— 和 taskDone 分开，否则汇总会虚报战绩
    riskHit: false, // 发奖侧点名 RISK_USER，推送里要说明是账号被标记不是脚本没跑
    preClaimed: 0, // 跑之前就已 SUCCESS 的任务数(手点领过的)。区分"没得领"和"领不动"
  };
  const uid = pick(ck, 'unb') || pick(ck, 'USERID') || '';
  sum.name = uid ? `账号${idx}(${uid.slice(0, 4)}***${uid.slice(-3)})` : `账号${idx}`;

  log('');
  log(`===== ${sum.name} [${idx}/${total}] =====`);

  if (!pick(ck, 'cookie2')) {
    log('  CK 里缺少 cookie2，跳过（yyb 的 elmCookie 应形如 cookie2=xxx; SID=xxx）');
    sum.fail.push('缺少 cookie2');
    return sum;
  }

  if (PROBE) {
    await runProbe(ck, sum);
    return sum;
  }

  const c = new Mtop(ck, CLIENT);
  log(`  客户端画像: ${CLIENT}  ttid=${c.ttid}`);
  log(`  风控令牌 bx-umidtoken: ${c.umidSrc}`);
  try {
    const hp = await API.homepage(c);
    if (!isOk(hp)) {
      const msg = retMsg(hp);
      log(`  主页查询失败: ${msg}`);
      if (/SESSION|登录|令牌/.test(msg)) log('  → CK 已失效，请重新获取');
      sum.fail.push(`主页失败(${msg})`);
      return sum;
    }
    // 任务集 ID 藏在 mainPage.data.popupShareWinV2，结构偶有变动，兜底全量搜一遍
    const mp = ((biz(hp).mainPage || {}).data || {}).popupShareWinV2 || {};
    let collectionId = mp.missionCollectionId;
    if (!collectionId) collectionId = deepFind(hp, 'missionCollectionId');
    log(`  主页查询成功，天天免单任务集 ID=${collectionId || '未取到'}`);

    /**
     * 互动中心主态。幸运星的任务集 ID 该从这里取。
     * md.homepage 给的是 2602(天天免单主会场，发抽奖机会)，两者不是一回事。
     */
    let starCols = [];
    const ih = await API.interactHome(c);
    if (isOk(ih)) {
      const d = biz(ih);
      // 结构未实测，把所有能当任务集的 ID 都挖出来，去重后按幸运星集子跑
      const ids = new Set();
      for (const k of ['missionCollectionId', 'missionCollectId', 'collectionId']) {
        deepFindAll(d, k).forEach((v) => {
          if (v != null && /^\d+$/.test(String(v))) ids.add(String(v));
        });
      }
      const stars = deepFind(d, 'luckyStarCount') ?? deepFind(d, 'starCount');
      log(
        `  互动中心查询成功${stars != null ? `，当前幸运星 ${stars}` : ''}` +
          `${ids.size ? `，任务集 ${[...ids].join('/')}` : '，未发现任务集 ID'}`
      );
      starCols = [...ids];
      if (DEBUG) log(`  [debug] 互动中心组件: ${Object.keys(d).join(',')}`);
    } else {
      log(`  互动中心查询失败: ${retMsg(ih)}（回退到内置任务集）`);
    }
    await sleep(1200);

    log('  --- 签到 ---');
    if (SIGN_IN) {
      await doSignIn(c, sum);
    } else {
      log('  已跳过签到(elmSignIn=false，只做幸运星)');
      sum.sign = '未执行';
    }
    await sleep(1500);

    log('  --- 任务 ---');
    let cols = COLLECTIONS.slice();
    /**
     * 互动中心报上来的任务集优先。它们是接口实测的，比内置表可靠；
     * 2602 除外——那是天天免单主会场，发抽奖机会，不能当幸运星集子。
     */
    for (const id of starCols) {
      if (id === '2602' || cols.some((x) => x.id === id)) continue;
      cols.unshift({
        id,
        scene: 'interact_center',
        asac: COLLECTIONS[0].asac,
        name: `互动中心${id}`,

      });
      log(`  新增任务集 ${id}（来自互动中心主态）`);
    }
    // md.homepage 给的 ID 若既不在内置表也没被互动中心报过，也跑一遍试试
    if (collectionId && !cols.some((x) => x.id === String(collectionId))) {
      cols.unshift({
        id: String(collectionId),
        scene: 'interact_center',
        asac: COLLECTIONS[0].asac,
        name: `任务集${collectionId}`,

      });
    }
    /**
     * 2602 是天天免单主会场，发的是抽免单机会，不是幸运星。而且实测它的
     * pageview 打点全部返回成功、阶段却一直停在 RUNNING —— 三个浏览任务
     * 白花 45 秒和 6 个请求，一次也没推动过。默认跳过，要跑加 elmDoChance=true。
     */
    if (STAR_ONLY_COLS) {
      const before = cols.length;
      cols = cols.filter((x) => x.id !== '2602');
      if (cols.length !== before)
        log('  已跳过任务集 2602（发抽免单机会不发幸运星，且打点推不动阶段）');
      log('    要跑它就在 argument 里加 elmDoChance=true');
    }
    // 剩下的集子都跑。哪个集子发什么，看领奖时打出来的原始 prizeType，不靠文案猜
    log(`  待跑任务集: ${cols.map((x) => x.id).join(' / ')}`);
    for (const col of cols) {
      await doTasks(c, col, sum);
      await sleep(2000);
    }

    if (NO_DRAW) {
      log('  已跳过抽奖(elmStarOnly=true，任务照做，只是不抽)');
    } else {
      log('  --- 抽奖 ---');
      await doDraw(c, sum);
      const cl = await API.cardList(c);
      if (isOk(cl)) {
        const arr =
          biz(cl).instanceList || flat(cl).instanceList || flat(cl).list || [];
        log(`  免单卡: ${Array.isArray(arr) ? arr.length : 0} 张`);
      }
    }
  } catch (e) {
    log(`  账号异常: ${e.message}`);
    sum.fail.push(e.message);
  }
  return sum;
}

// ---------- 汇总 & 推送 ----------
/** 把 ["抽奖机会x1","抽奖机会x2"] 合并成 "抽奖机会x3" */
function mergeGains(list) {
  const map = {};
  list.forEach((g) => {
    const m = g.match(/^(.*?)x(\d+(?:\.\d+)?)$/);
    if (m) map[m[1]] = (map[m[1]] || 0) + Number(m[2]);
    else map[g] = (map[g] || 0) + 1;
  });
  return Object.entries(map).map(([k, v]) => `${k}x${v}`);
}

function buildSummary(all) {
  const lines = [];
  const okCount = all.filter((s) => !s.fail.length).length;
  lines.push(`账号 ${all.length} 个，正常 ${okCount} 个，异常 ${all.length - okCount} 个`);
  const total = mergeGains(all.flatMap((s) => s.gain));
  if (total.length) lines.push(`总收获: ${total.join('、')}`);
  lines.push('');
  all.forEach((s) => {
    const parts = [`签到:${s.sign}`];
    // taskDone 是"动作做成了"(打点通过)，不等于"拿到东西了"。
    // 之前只报 taskDone，出现过打点 10 个、实收 0 个还显示"任务:10个"的虚报
    parts.push(`打点:${s.taskDone.length ? s.taskDone.length + '个' : '无'}`);
    const g = mergeGains(s.gain);
    parts.push(`收获:${g.length ? g.join('、') : '无'}`);
    if ((s.claimFail || []).length) parts.push(`领奖失败:${s.claimFail.length}个`);
    if (s.skip.length) parts.push(`跳过:${s.skip.length}个`);
    lines.push(`${s.name} ${parts.join(' | ')}`);
    if (s.fail.length) lines.push(`  异常: ${[...new Set(s.fail)].join('; ')}`);
  });
  // 打点全过但一件没领到 —— 指向发奖侧被拦，不是任务没做成，别让用户以为脚本没跑
  const pinged = all.reduce((n, s) => n + s.taskDone.length, 0);
  const claimBad = all.reduce((n, s) => n + (s.claimFail || []).length, 0);
  if (!total.length && pinged && claimBad)
    lines.push(`\n打点 ${pinged} 个全过，但领奖 ${claimBad} 个全失败 —— 卡在发奖侧`);
  // 服务端自己点名 RISK_USER 时说清楚归因，免得以为是脚本或 CK 的问题
  if (all.some((s) => s.riskHit))
    lines.push('发奖侧点名账号风控(RISK_USER)，换头/换参数都不改结果');
  // 没收获但也没失败、且一堆任务跑前就已领过 —— 是"没得领"不是"领不动"，
  // 这两种情况汇总看起来一模一样，不说清会以为脚本又挂了
  const pre = all.reduce((n, s) => n + (s.preClaimed || 0), 0);
  if (!total.length && !claimBad && pre)
    lines.push(`\n${pre} 个任务跑之前就已领过，脚本无事可做(不是领取失败)`);
  return lines.join('\n');
}

/* ==================== 圈X 通知 / 抓取 / 入口 ==================== */

/**
 * notify —— 青龙版走 sendNotify 模块，这里走 $notify。
 * 签名保持 (title, content) 不变，业务逻辑那句 await notify(...) 一行不用改。
 * 汇总内容多行，第一行拿来当 subtitle，全文进 body：
 * 「运行日志不简化、推送只发汇总」这个约定沿用青龙版。
 */
async function notify(title, content) {
  const text = String(content || '').trim();
  if (!text) {
    log('汇总为空，不推送');
    return;
  }
  const lines = text.split('\n').filter((l) => l.trim());
  const sub = lines.length > 1 ? lines[0].slice(0, 60) : '';
  const body = lines.length > 1 ? lines.slice(1).join('\n') : text;
  try {
    $notify(title, sub, body || text);
    log('推送已发送');
  } catch (e) {
    log(`推送失败: ${e.message || e}`);
  }
}

/** "a=1; b=2" -> Map。同名取后出现的那个（较新）。 */
function jarParse(str) {
  const map = new Map();
  for (const part of String(str || '').split(';')) {
    const s = part.trim();
    if (!s) continue;
    const i = s.indexOf('=');
    if (i <= 0) continue;
    map.set(s.slice(0, i).trim(), s.slice(i + 1).trim());
  }
  return map;
}

const jarBuild = (map) => [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

/** 只返回项名，绝不返回值 —— 日志和通知里不出现任何凭证内容 */
const jarNames = (str) => [...jarParse(str).keys()].sort();

/* ---------- 模式一：重写，抓凭证 ---------- */

/**
 * ynuf.aliapp.org/service/um.json 的响应体里直接是明文令牌：
 *   {"tn":"T2gA…(68 字符)","id":"T2gA…"}
 * tn 就是活动页后续 mtop 请求带的 bx-umidtoken。抓包实测这次调用带着
 * f-refer: wv_h5 和 origin: https://tb.ele.me，确认是活动页 WebView 侧的
 * umid（不是原生的 x-umt）。响应零加密，不需要逆向任何算法。
 * SDK 侧缓存 5 小时，所以抓一次能用几小时。
 */
function captureUmid() {
  let raw = '';
  try {
    raw = typeof $response !== 'undefined' && $response ? $response.body || '' : '';
  } catch (e) {
    raw = '';
  }
  // 这是 script-response-body 类型：$done({}) 会被圈X 当成"把响应体替换为空"，
  // 令牌 SDK 拿到空响应，活动页风控初始化直接挂。所有出口都必须原样回传 body。
  const pass = () => $done(raw ? { body: raw } : {});

  if (!raw) return pass();
  let tn = '';
  try {
    const j = JSON.parse(raw);
    tn = String(j.tn || '');
  } catch (e) {
    log('[重写] um.json 响应不是 JSON，原样放行');
    return pass();
  }
  // 只做形状校验，不锁前缀（服务端换前缀不该让脚本瞎）
  if (tn.length < 40 || /[^A-Za-z0-9_\-+/=]/.test(tn)) {
    log(`[重写] um.json 里 tn 形状不对(长度 ${tn.length})，原样放行`);
    return pass();
  }

  const before = readK(K_UMID);
  writeK(K_UMID, tn);
  writeK(K_UMID_TS, Date.now());
  if (tn !== before) {
    log(`已更新风控令牌，长度 ${tn.length}`);
    $notify(QX_NAME, '已抓到风控令牌', `bx-umidtoken 长度 ${tn.length}，5 小时内有效`);
  } else {
    log(`[重写] 风控令牌没变，长度 ${tn.length}`);
  }
  return pass();
}

/**
 * 从 tb.ele.me / rsc-api.ele.me 的真实请求头里抓 CK。
 * 抓请求头而不是 document.cookie，HttpOnly 的项才拿得到 —— 手动复制会漏掉的
 * 正是这部分。顺带把同一批头里的 UA、bx-umidtoken、_m_h5_tk 一起收了。
 */
/**
 * 抓 App 自己点「领取奖励」发的那一发 receiveprize。
 *
 * 为什么要抓：脚本发的和 App 发的都到了 riskControl:2 这一档，服务端却只
 * 拒脚本那发（返回 RISK_USER），而活动页上按钮是可点的红色 —— 说明差别在
 * 请求本身，不在账号。逐字对比是唯一能定位差在哪个字段的办法。
 *
 * 只留字段名和长度、外加非敏感字段的值；cookie / token / sid 一律不落盘，
 * 因为 $prefs 的内容会进日志和推送。
 */
function captureRealClaim(url) {
  const h = (($request && $request.headers) || {});
  const body = String(($request && $request.body) || '');

  // instanceId 是账号绑定的，跟 logClaimCtx 保持一致只记有无，不留值
  const SAFE = [
    'missionCollectionId', 'missionId', 'bizScene', 'accountPlan',
    'count', 'sum', 'asac', 'longitude', 'latitude',
  ];
  const SENSITIVE = /cookie|token|sid|sign|sgext|wua|utdid|umt|uid|unb/i;

  // mtop 的 data 是 form body 里的 data=<json>，先剥出来
  let dataRaw = '';
  const mb = /(?:^|&)data=([^&]*)/.exec(body);
  if (mb) { try { dataRaw = decodeURIComponent(mb[1]); } catch (e) { dataRaw = mb[1]; } }

  const shape = {};
  try {
    const j = JSON.parse(dataRaw || '{}');
    Object.keys(j).forEach((k) => {
      const v = j[k];
      // 安全白名单里的字段留真值（都是任务 id / 场景名这类非私密量），
      // 其余只留"有没有 + 多长"，够对账又不落盘敏感值
      shape[k] = SAFE.indexOf(k) >= 0 && !SENSITIVE.test(k)
        ? v
        : `<${v == null ? 'null' : typeof v}:${String(v).length}>`;
    });
  } catch (e) {
    shape._parseError = `data 不是 JSON，长度 ${dataRaw.length}`;
  }

  // 头只记名字 + 长度，另外单独标注几个关键风控头到底有没有
  const hnames = Object.keys(h);
  const marks = {};
  ['bx-umidtoken', 'asac', 'x-sid', 'x-sgext', 'x-sign', 'wua', 'x-mini-wua', 'rc-token']
    .forEach((n) => {
      const v = pickHeaderCI(h, n);
      marks[n] = v ? `有(${String(v).length})` : '无';
    });

  const snap = {
    ts: Date.now(),
    api: (/[?&]api=([^&]*)/.exec(url) || [])[1] || '',
    v: (/[?&]v=([^&]*)/.exec(url) || [])[1] || '',
    hasTtidInQuery: /[?&]ttid=/.test(url),
    dataKeys: shape,
    headerNames: hnames,
    riskHeaders: marks,
  };
  let s = '';
  try { s = JSON.stringify(snap); } catch (e) { s = '{}'; }
  writeK(K_REAL_CLAIM, s);

  log('[重写] ★ 抓到 App 真实领奖请求，已存快照。下次跑定时任务会打出对账结果');
  log(`[重写]   api=${snap.api} v=${snap.v}`);
  log(`[重写]   风控头: ${Object.keys(marks).map((n) => `${n}=${marks[n]}`).join(' ')}`);
  log(`[重写]   data 字段: ${Object.keys(shape).join(',')}`);
  return $done({});
}

/**
 * 把 App 真实那发和脚本要发的逐字比，只报差异。
 * 参数 mine 是脚本这边即将发出去的 data 对象。
 */
function diffRealClaim(mine, myHeaders) {
  const raw = readK(K_REAL_CLAIM);
  if (!raw) return false;
  let snap;
  try { snap = JSON.parse(raw); } catch (e) { return false; }

  const age = Math.round((Date.now() - (snap.ts || 0)) / 60000);
  log(`  ── 与 App 真实领奖请求对账(快照 ${age} 分钟前) ──`);
  if (snap.api && snap.api.indexOf('receiveprize') < 0)
    log(`  ⚠ App 走的接口名是 ${snap.api}，不是 receiveprize —— 接口就选错了`);
  if (snap.v && snap.v !== '1.0') log(`  ⚠ App 用的版本是 v${snap.v}，脚本用 v1.0`);

  const theirs = snap.dataKeys || {};
  const tk = Object.keys(theirs);
  const mk = Object.keys(mine || {});
  const miss = tk.filter((k) => mk.indexOf(k) < 0);
  const extra = mk.filter((k) => tk.indexOf(k) < 0);
  if (miss.length) log(`  ⚠ App 带了脚本没带的字段: ${miss.join(',')}`);
  if (extra.length) log(`  · 脚本多带的字段: ${extra.join(',')}`);
  tk.forEach((k) => {
    const a = theirs[k];
    if (typeof a === 'string' && /^<.*>$/.test(a)) return; // 脱敏过的不比值
    if (mk.indexOf(k) >= 0 && String(mine[k]) !== String(a))
      log(`  · ${k}: App=${a} 脚本=${mine[k]}`);
  });

  const rh = snap.riskHeaders || {};
  Object.keys(rh).forEach((n) => {
    const hv = pickHeaderCI(myHeaders || {}, n);
    const my = hv ? `有(${String(hv).length})` : '无';
    if (rh[n] !== my) log(`  ⚠ 头 ${n}: App=${rh[n]} 脚本=${my}`);
  });
  if (!miss.length && !tk.some((k) => mk.indexOf(k) >= 0 && String(mine[k]) !== String(theirs[k])))
    log('  data 字段与 App 一致，差异只在风控头');
  return true;
}

function captureCk() {
  let h = {};
  try {
    h = ($request && $request.headers) || {};
  } catch (e) {
    log('[重写] 取不到请求头，跳过');
    return $done({});
  }
  const incoming = pickHeaderCI(h, 'cookie');
  if (!incoming) {
    log('[重写] 该请求没带 Cookie 头，跳过');
    return $done({});
  }

  const fresh = jarParse(incoming);
  // cookie2 就是 mtop 会话 id（与 App 的 x-sid 同值），没有它这罐存了也没用
  if (!fresh.has('cookie2')) {
    log(`[重写] Cookie 里没有 cookie2(共 ${fresh.size} 项)，跳过 —— 这条不是登录态请求`);
    return $done({});
  }

  const old = jarParse(readK(K_CK));
  let jar;
  if (old.get('cookie2') !== fresh.get('cookie2')) {
    // cookie2 换了 = 换号或重新登录，整罐替换，别把两个号的项混在一起
    jar = fresh;
  } else {
    jar = old;
    for (const [k, v] of fresh) jar.set(k, v);
  }

  const names = jarNames(jarBuild(jar)).join(',');
  const before = readK(K_CK_NAMES);
  writeK(K_CK, jarBuild(jar));
  writeK(K_CK_NAMES, names);
  writeK(K_CK_TS, Date.now());

  const ua = pickHeaderCI(h, 'user-agent');
  if (ua) writeK(K_QX_UA, ua);

  // 请求头里直接带了令牌就用它，比等 um.json 更直接
  const umid = pickHeaderCI(h, 'bx-umidtoken');
  if (umid && String(umid).length >= 40) {
    if (umid !== readK(K_UMID)) log(`从请求头拿到风控令牌，长度 ${String(umid).length}`);
    writeK(K_UMID, umid);
    writeK(K_UMID_TS, Date.now());
    // 记下是哪个 host 给的。HAR 全包 332 条一发都没带，所以这个统计大概率一直是空的；
    // 真出现了才说明找到了新的令牌来源，那时候按 host 加规则，别再猜
    try {
      const host = String(($request && $request.url) || '')
        .replace(/^https?:\/\//, '').split('/')[0];
      const seen = (readK(K_UMID_HOSTS) || '').split(',').filter(Boolean);
      if (host && seen.indexOf(host) < 0) {
        seen.push(host);
        writeK(K_UMID_HOSTS, seen.join(','));
      }
    } catch (e) { /* 统计用，失败不影响主流程 */ }
  }

  // _m_h5_tk 留一份：业务逻辑本来靠响应的 Set-Cookie 自管，
  // 但圈X 有版本会吞 Set-Cookie，httpPost 里那段兜底要用这个
  const tkPairs = [...fresh.entries()]
    .filter(([k]) => /^_m_h5_tk/i.test(k))
    .map(([k, v]) => `${k}=${v}`);
  if (tkPairs.length) writeK(K_H5TK, tkPairs.join('; '));

  if (names !== before) {
    log(`已更新 CK，共 ${jar.size} 项`);
    $notify(QX_NAME, '已抓到 CK', `共 ${jar.size} 项${umid ? '，令牌同时到手' : ''}`);
  }
  return $done({});
}

/* ---------- 模式二：定时跑任务 ---------- */

async function task() {
  log('饿了么幸运星 —— 开始运行');

  // 重写到底有没有被调起过 —— 抓不到 CK 时这个数字是第一诊断依据
  const hits = Number(readK(K_HITS) || 0);
  const last = readK(K_LAST);

  const raw = process.env.elmCookie || '';
  const cks = splitAccounts(raw);
  if (!cks.length) {
    log('还没有 CK，退出');
    if (!hits) {
      log('  重写一次都没被调起过 —— 问题在配置，不在脚本：');
      log('    1) 圈X 主界面「MITM」开关是否打开、证书是否已装并信任');
      log('    2) [mitm] hostname 是否含 sp.ele.me(精确匹配，不含子域)');
      log('    3) [rewrite_local] 那两行是否 enabled、脚本路径能否取到');
      log('    4) 圈X「重写」总开关是否打开');
      $notify(QX_NAME, '重写从未触发', 'MITM/证书/hostname/重写开关，四项挨个检查');
    } else {
      log(`  重写已被调起 ${hits} 次，最后一次: ${last}`);
      log('  说明规则通了但没抓到带 cookie2 的请求 —— 用 App 打开一次「天天免单」活动页');
      $notify(QX_NAME, '还没有 CK', `重写已触发 ${hits} 次但没抓到登录态，请打开一次活动页`);
    }
    return;
  }
  if (hits) log(`重写累计被调起 ${hits} 次，最后一次: ${last}`);

  // 令牌状态。打点用兜底串能过，领奖(riskControl:2)报 RISK_USER，所以要说清楚。
  const umid = process.env.elmUmid || '';
  const umidTs = Number(readK(K_UMID_TS) || 0);
  if (!umid) {
    log('⚠ 没有风控令牌 bx-umidtoken，将用 default_empty 兜底');
    log('  实测手机 IP 下打点(riskControl:1)兜底串也能过；领奖是 riskControl:2，可能需要真令牌');
    log('  想抓真令牌: 保持 MITM 开着，用 App 打开一次天天免单活动页(页面会调 um.json)');
    log('  必须是活动页那个 WebView —— App 原生页面不触发 um.json，光开 App 没用');
  } else {
    const ageMin = umidTs ? Math.round((Date.now() - umidTs) / 60000) : -1;
    if (ageMin < 0) log(`风控令牌已就位，长度 ${umid.length}（来源: 手填/argument）`);
    else if (ageMin > 240)
      log(`⚠ 风控令牌已抓到 ${ageMin} 分钟，SDK 侧缓存 5 小时，可能已过期 —— 建议重开一次活动页`);
    else log(`风控令牌已就位，长度 ${umid.length}，抓到于 ${ageMin} 分钟前`);
  }
  const ckTs = Number(readK(K_CK_TS) || 0);
  if (ckTs) {
    const nm = jarNames(readK(K_CK));
    log(`CK 共 ${nm.length} 项，抓到于 ${Math.round((Date.now() - ckTs) / 60000)} 分钟前`);
    // 只打项名不打值。xqkp 是 AWSC SDK 缓存令牌的地方，它在不在直接决定
    // umidToken() 会走"CK 里的 xqkp"还是掉到 default_empty 兜底
    log(`  CK 项: ${nm.join(',')}`);
    if (!nm.includes('xqkp'))
      log('  ⚠ 罐里没有 xqkp —— 该 cookie 由活动页的 AWSC SDK 写入，说明抓到的是普通请求');
  }

  // App 真实领奖请求快照的状态。没抓到时要说清"到底哪一步没做"，
  // 否则用户点了按钮但规则没生效，看不出区别
  const rcRaw = readK(K_REAL_CLAIM);
  if (rcRaw) {
    let snap = null;
    try { snap = JSON.parse(rcRaw); } catch (e) { snap = null; }
    if (snap) {
      const rh = snap.riskHeaders || {};
      log(
        `App 真实领奖快照: 有，抓于 ${Math.round((Date.now() - (snap.ts || 0)) / 60000)} 分钟前`
      );
      log(`  App 那发带的风控头: ${Object.keys(rh).map((n) => `${n}=${rh[n]}`).join(' ')}`);
      log(`  data 字段: ${Object.keys(snap.dataKeys || {}).join(',')}`);
    }
  } else {
    log('App 真实领奖快照: 无 —— 领奖失败时无法逐字对账');
    const seen = readK(K_CLAIM_SEEN);
    if (seen) {
      // 见过领奖类请求却没存下快照 = 规则类型不对(request-header 读不到 body)
      log('  但见过这些领奖类请求(host|api)：');
      seen.split('\n').filter(Boolean).forEach((x) => log(`    ${x}`));
      log('  ⇒ 说明拦到了但没存下来，检查那条规则是不是 script-request-body');
    } else {
      log('  抓法: 活动页任务列表里手点一次红色「领取奖励」(MITM 要开着)');
      log('  前提: [rewrite_local] 里那条 receiveprize 规则必须是 script-request-body');
      log('        且排在通用 ele.me 那条之前，否则会被通用规则吃掉');
      log('  已手点过还是没有 = 那一发没经过被拦的 host，走的可能是原生通道');
    }
  }
  // 令牌到底藏在哪个 host 的请求里。HAR 全包 332 条零命中，所以"没有"是预期结果，
  // 得把这个结论打出来，否则每次跑都要怀疑一遍是不是规则没配好
  const tHosts = readK(K_UMID_HOSTS);
  if (tHosts) log(`带 bx-umidtoken 的请求来自: ${tHosts}`);
  else
    log('没有任何被拦请求带 bx-umidtoken —— 这是预期的：App 原生走 x-sgext 签名，只有活动页 WebView 的 um.json 产令牌');

  log(`共读取到 ${cks.length} 个账号，账号间隔 ${DELAY_SEC}s，浏览等待=${VIEW_WAIT}`);

  const all = [];
  for (let i = 0; i < cks.length; i++) {
    all.push(await runAccount(cks[i], i + 1, cks.length));
    if (i < cks.length - 1) await sleep(DELAY_SEC * 1000);
  }

  const summary = buildSummary(all);
  log('');
  log('===== 汇总 =====');
  summary.split('\n').forEach((l) => l && console.log(l));

  await notify(QX_NAME, summary);
  log('运行结束');
}

/* ---------- 入口 ---------- */
// 重写场景圈X 会注入 $request；response-body 类型的还会额外注入 $response。
// 定时任务场景两个都没有。
const IS_REWRITE = typeof $request !== 'undefined' && $request;
if (IS_REWRITE) {
  const url = String(($request && $request.url) || '');
  const short = url.replace(/^https?:\/\//, '').split('?')[0].slice(0, 70);
  const hits = Number(readK(K_HITS) || 0) + 1;
  writeK(K_HITS, hits);
  writeK(K_LAST, short);
  // 无条件打一行 —— 用户报"没反应"时，这一行的有无直接分开
  // "规则没匹配/脚本没加载" 和 "匹配了但没抓到东西" 两种情况
  log(`[重写] 第 ${hits} 次调起: ${short}`);

  /**
   * 领奖类请求的宽口径观测。用户手点了领奖、快照却是空的，说明那一发没经过
   * 任何被拦的 host。这里把凡是像领奖的 URL 都记下 host+api，用来定位 App
   * 到底走哪条路 —— 比继续猜 hostname 该加谁快。
   */
  if (/receive|prize|reward|receiveprize/i.test(url)) {
    try {
      const host = url.replace(/^https?:\/\//, '').split('/')[0];
      const api = (/[?&]api=([^&]*)/.exec(url) || [])[1] || short;
      const tag = `${host}|${api}`;
      const seen = (readK(K_CLAIM_SEEN) || '').split('\n').filter(Boolean);
      if (seen.indexOf(tag) < 0) {
        seen.push(tag);
        writeK(K_CLAIM_SEEN, seen.slice(-10).join('\n'));
      }
      log(`[重写] ★ 领奖类请求: ${tag}`);
    } catch (e) { /* 观测用，失败不影响主流程 */ }
  }

  const isUmid = /ynuf\.aliapp\.org/.test(url);
  const hasResp = typeof $response !== 'undefined' && $response;
  // App 自己点"领取奖励"那一发优先处理 —— 它同时也带完整 CK，
  // 所以抓完快照后继续走 captureCk，两件事一次做完
  const isClaim = /receiveprize/i.test(url);
  // 只有确实拿到 $response 才走 umid 分支。ynuf 规则若被误配成
  // request-header 类型，这里 hasResp=false，走 captureUmid 会拿空 body
  // 去 $done，等于把响应清空 —— 宁可什么都不做。
  if (isClaim && !hasResp) {
    // App 自己点"领取奖励"那一发。抓完快照直接结束，
    // 这条请求本身也带 CK，但对账信息更要紧，别把两件事挤在一个出口
    captureRealClaim(url);
  } else if (isUmid && !hasResp) {
    log('[重写] ynuf 命中但没有 $response —— 规则类型应为 script-response-body，请检查配置');
    $done({});
  } else if (hasResp) {
    captureUmid();
  } else {
    captureCk();
  }
} else {
  task()
    .catch((e) => {
      log(`脚本异常退出: ${(e && e.stack) || (e && e.message) || e}`);
      $notify(QX_NAME, '运行异常', String((e && e.message) || e));
    })
    .finally(() => $done());
}



