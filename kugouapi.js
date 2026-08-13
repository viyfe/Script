const $ = new Env("酷狗音乐");

const KUGOU_SCRIPT_VERSION = "1.1.0";
const KUGOU_API_URL = "https://api.chksz.com/api/kugou_music";
const KUGOU_API_KEY = "YOUR_API_KEY";
const KUGOU_AUDIO_QUALITY = "master";

const requestUrl = $request.url;

function getQueryParam(url, key) {
  const match = url.match(new RegExp(`[?&]${key}=([^&]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function getArgumentValue(key) {
  if (typeof $argument === "undefined" || !$argument) return null;
  if (typeof $argument === "object") return $argument[key] || null;

  const match = String($argument).match(new RegExp(`(?:^|&)${key}=([^&]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function getApiKey() {
  return getArgumentValue("apikey") || $.read("kugou_music_apikey") || KUGOU_API_KEY;
}

function setVip(data) {
  if (!data) return;

  Object.assign(data, {
    is_vip: 1,
    vip_type: 6,
    vip_begin_time: "2025-12-01 00:00:00",
    vip_end_time: "2099-12-01 00:00:00",
    listen_begin_time: "2025-12-01 00:00:00",
    listen_end_time: "2099-12-01 00:00:00",
    su_vip_begin_time: "2025-12-01 00:00:00",
    su_vip_end_time: "2099-12-01 00:00:00",
    su_vip_y_endtime: "2099-12-01 00:00:00",
    roam_end_time: "2099-12-01 00:00:00",
    m_y_endtime: "2099-12-01 00:00:00",
    vip_y_endtime: "2099-12-01 00:00:00",
    dual_su_vip_end_time: "2099-12-01 00:00:00",
    user_type: 29,
    bookvip_valid: 1,
    bookvip_end_time: "2099-12-01 00:00:00",
    roam_type: 1,
    roam_begin_time: "2025-12-01 00:00:00",
    vip_token: "1234567890abcdef",
    auth_token: "1234567890abcdef",
    y_type: 1,
    m_type: 1,
    user_y_type: 1,
    m_begin_time: "2025-12-01 00:00:00",
    m_end_time: "2099-12-01 00:00:00",
    exp: 4099737600,
    t_expire_time: 4099737600,
    m_is_old: 1,
    svip_level: 9,
    svip_score: 9999,
    singvip_valid: 1,
    vipinfo: {
      bookvip_rankvip: [],
      user_type: 29,
      m_type: 1,
      su_vip_y_endtime: "2099-12-01 00:00:00",
      su_vip_clearday: "",
      user_y_type: 1,
      vip_type: 6,
      bookvip_valid: 1,
      su_vip_begin_time: "2026-02-15 07:10:14",
      svip_score: 9999,
      su_vip_end_time: "2099-12-01 00:00:00",
      y_type: 1,
      bookvip_end_time: "2099-12-01 00:00:00",
      svip_level: 9,
    },
    busi_vip: [
      {
        is_paid_vip: 1,
        latest_product_id: "",
        busi_type: "",
        purchased_ios_type: 1,
        vip_begin_time: "2026-02-15 07:10:14",
        paid_vip_expire_time: "2099-12-01 00:00:00",
        userid: 1234567890,
        purchased_type: 0,
        product_type: "",
        y_type: 1,
        is_vip: 1,
        vip_end_time: "2099-12-01 00:00:00",
      },
    ],
  });

  data.tone_info?.user_right_list?.forEach((item) => {
    item.valid = true;
  });
}

function getResponseData(payload) {
  if (payload?.data && typeof payload.data === "object") return payload.data;
  return payload;
}

function getAudioExtension(data, mediaUrl) {
  const format = String(data.format || data.bitrate || "").toLowerCase();
  if (["mp3", "flac", "m4a", "aac", "ogg", "wav"].includes(format)) return format;

  const path = String(mediaUrl).split("?")[0];
  const match = path.match(/\.([a-z0-9]{2,5})$/i);
  return match ? match[1].toLowerCase() : "flac";
}

function formatError(error) {
  if (error instanceof Error) return error.message || String(error);
  if (typeof error === "string") return error;

  try {
    const json = JSON.stringify(error);
    if (json && json !== "{}") return json;
  } catch (_) {}

  return String(error);
}

async function replaceSongUrl() {
  const hash = getQueryParam(requestUrl, "hash");
  if (!hash) {
    $.log("播放请求中没有 hash，保留原响应");
    return $.done({});
  }

  const apiKey = getApiKey();
  if (!apiKey || apiKey === "YOUR_API_KEY") {
    $.logErr("未配置 apikey，请在 BoxJS 的 kugou_music 中填写 API Key");
    return $.done({});
  }

  $.log(`脚本版本=${KUGOU_SCRIPT_VERSION}，解析歌曲，音质=${KUGOU_AUDIO_QUALITY}，hash=${hash}`);

  try {
    const query = [
      `id=${encodeURIComponent(hash)}`,
      `size=${KUGOU_AUDIO_QUALITY}`,
      "type=json",
      `apikey=${encodeURIComponent(apiKey)}`,
    ].join("&");
    const response = await $.fetch(`${KUGOU_API_URL}?${query}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Quantumult X",
      },
    });
    const payload = $.toObj(response.body, {});
    const data = getResponseData(payload);
    const status = response.statusCode || response.status || "unknown";

    $.log(`解析接口响应：HTTP ${status}，code=${payload.code ?? "unknown"}，msg=${payload.msg || "none"}`);

    if (Number(payload.code) !== 200 || !data?.url) {
      throw new Error(payload.msg || `接口未返回歌曲地址，HTTP ${status}`);
    }

    const original = $.toObj($response.body, {});
    Object.assign(original, {
      url: [data.url, data.url],
      backupUrl: [data.url],
      status: 1,
      priv_status: 1,
      extName: getAudioExtension(data, data.url),
      hash: String(data.id || hash).toUpperCase(),
    });
    return $.done({ body: JSON.stringify(original) });
  } catch (error) {
    $.logErr(`歌曲解析失败：${formatError(error)}`);
    return $.done({});
  }
}

if (
  requestUrl.includes("v5/login_by_token") ||
  requestUrl.includes("/get_my_info") ||
  requestUrl.includes("/get_union_vip") ||
  requestUrl.includes("mobile/vipinfoV2") ||
  requestUrl.includes("mobile/vipinfo") ||
  requestUrl.includes("/get_login_extend_info")
) {
  const json = $.toObj($response.body, {});
  setVip(json.data);
  $.done({ body: JSON.stringify(json) });
} else if (requestUrl.includes("v5/url")) {
  replaceSongUrl();
} else if (requestUrl.includes("v1/get_res_privilege/lite")) {
  const json = $.toObj($response.body, {});
  const item = json.data?.[0];

  if (item?.trans_param) {
    Object.assign(item.trans_param, {
      musicpack_advance: 0,
      display: 0,
      display_rate: 0,
      pay_block_tpl: 0,
      free_limited: 0,
      all_quality_free: 1,
      download_privilege: 8,
    });
    Object.assign(item, {
      level: 0,
      status: 1,
      price: 0,
      buy_count: 1,
      pay_type: 0,
      buy_count_audios: 1,
    });
    item.relate_goods?.forEach((goods) => {
      goods.status = 1;
      goods.price = 0;
      goods.pay_type = 0;
      goods.popup = null;
    });
  }

  if (json.userinfo) {
    Object.assign(json.userinfo, {
      m_type: 1,
      vip_type: 6,
      vip_user_type: 3,
      quota_remain: 999,
    });
  }
  json.vip_user_type = 3;
  json.appid_group = 0;
  $.done({ body: JSON.stringify(json) });
} else if (
  requestUrl.includes("v1/mine_top_banner") ||
  requestUrl.includes("v2/task_center_entrance")
) {
  const json = $.toObj($response.body, {});
  delete json.data?.ads;
  $.done({ body: JSON.stringify(json) });
} else if (
  requestUrl.includes("vip/user/info") ||
  requestUrl.includes("json/v3/vip/tip")
) {
  const json = $.toObj($response.body, {});
  Object.assign(json.data || {}, {
    status: 1,
    vipLevel: 9,
    svip: 1,
    expireTime: 4099737600000,
  });
  if (json.data?.vipTips?.[0]) {
    json.data.vipTips[0].btnText = "尊贵 SVIP 畅享所有特权";
  }
  $.done({ body: JSON.stringify(json) });
} else {
  $.log("未匹配接口");
  $.done({});
}


function Env(name) {
  return new (class {
    constructor() {
      this.name = name;
      this.startTime = Date.now();
      this.log("", `🔔${this.name}, 开始!`);
    }

    platform() {
      if (typeof $environment !== "undefined" && $environment["surge-version"]) return "Surge";
      if (typeof $environment !== "undefined" && $environment["stash-version"]) return "Stash";
      if (typeof $task !== "undefined") return "Quantumult X";
      if (typeof $loon !== "undefined") return "Loon";
      if (typeof $rocket !== "undefined") return "Shadowrocket";
      if (typeof Egern !== "undefined") return "Egern";
      return "Unknown";
    }

    isQuanX() {
      return this.platform() === "Quantumult X";
    }

    toObj(value, fallback = null) {
      try {
        return JSON.parse(value);
      } catch (_) {
        return fallback;
      }
    }

    read(key) {
      try {
        if (this.isQuanX()) return $prefs.valueForKey(key);
        if (typeof $persistentStore !== "undefined") return $persistentStore.read(key);
      } catch (_) {}
      return null;
    }

    async fetch(url, options = {}) {
      const request = { url, ...options };
      request.method = request.method || (request.body ? "POST" : "GET");
      const method = request.method.toLowerCase();

      if (this.isQuanX()) {
        const response = await $task.fetch(request);
        response.status = response.statusCode;
        return response;
      }

      return new Promise((resolve, reject) => {
        $httpClient[method](request, (error, response, body) => {
          if (error) return reject(error);
          response.body = body;
          response.status = response.statusCode;
          return resolve(response);
        });
      });
    }

    log(...messages) {
      console.log(messages.join(""));
    }

    logErr(error) {
      this.log("", `❗️${this.name}, 错误!`, error);
    }

    done(value = {}) {
      const duration = (Date.now() - this.startTime) / 1000;
      this.log("", `🔔${this.name}, 结束! 🕛${duration}秒`);
      $done(value);
    }
  })();
}
