const $ = new Env("酷狗音乐");

const KUGOU_SCRIPT_VERSION = "1.0.8";
const KUGOU_API_URL = "https://api.chksz.com/api/kugou_music";
const KUGOU_API_KEY = "YOUR_API_KEY";
const KUGOU_AUDIO_QUALITIES = ["master", "hires", "flac", "320k", "128k"];
const KUGOU_RUNTIME_STATE_KEY = "kugou_music_runtime_v3";
const KUGOU_CACHE_TTL = 5 * 60 * 1000;
const KUGOU_QUALITY_STATE_TTL = 24 * 60 * 60 * 1000;
const KUGOU_REQUEST_INTERVAL = 3200;
const KUGOU_REQUEST_LOCK_TTL = 10 * 1000;

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
  return (
    getArgumentValue("apikey") ||
    $.read("kugou_music_apikey") ||
    KUGOU_API_KEY
  );
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
  if (["mp3", "flac", "m4a", "aac", "ogg", "wav"].includes(format)) {
    return format;
  }

  const path = String(mediaUrl).split("?")[0];
  const match = path.match(/\.([a-z0-9]{2,5})$/i);
  return match ? match[1].toLowerCase() : "flac";
}

function createApiUrl(hash, quality, apiKey) {
  const query = [
    `id=${encodeURIComponent(hash)}`,
    `size=${encodeURIComponent(quality)}`,
    "type=json",
    `apikey=${encodeURIComponent(apiKey)}`,
  ].join("&");
  return `${KUGOU_API_URL}?${query}`;
}

async function requestSong(hash, quality, apiKey) {
  const response = await $.fetch(createApiUrl(hash, quality, apiKey), {
    headers: {
      Accept: "application/json",
      "User-Agent": "Quantumult X",
    },
  });
  const payload = $.toObj(response.body, {});
  const data = getResponseData(payload);
  return { response, payload, data };
}

function loadRuntimeState() {
  const saved = $.toObj($.read(KUGOU_RUNTIME_STATE_KEY), {});
  const state = saved && typeof saved === "object" ? saved : {};
  return {
    nextRequestAt: Number(state.nextRequestAt) || 0,
    cooldownUntil: Number(state.cooldownUntil) || 0,
    cache: state.cache && typeof state.cache === "object" ? state.cache : {},
    quality: state.quality && typeof state.quality === "object" ? state.quality : {},
    locks: state.locks && typeof state.locks === "object" ? state.locks : {},
  };
}

function pruneRuntimeState(state, now = Date.now()) {
  for (const [hash, item] of Object.entries(state.cache)) {
    if (!item?.expiresAt || item.expiresAt <= now) delete state.cache[hash];
  }
  for (const [hash, item] of Object.entries(state.quality)) {
    if (!item?.expiresAt || item.expiresAt <= now) delete state.quality[hash];
  }
  for (const [hash, expiresAt] of Object.entries(state.locks)) {
    if (!expiresAt || expiresAt <= now) delete state.locks[hash];
  }

  const cacheEntries = Object.entries(state.cache).sort(
    (left, right) => Number(right[1]?.expiresAt || 0) - Number(left[1]?.expiresAt || 0),
  );
  state.cache = Object.fromEntries(cacheEntries.slice(0, 30));
  return state;
}

function saveRuntimeState(state) {
  pruneRuntimeState(state);
  return $.write(JSON.stringify(state), KUGOU_RUNTIME_STATE_KEY);
}

function getQualityState(state, hash, now = Date.now()) {
  const saved = state.quality[hash];
  if (!saved || saved.expiresAt <= now) return 0;
  return Math.min(Math.max(Number(saved.index) || 0, 0), KUGOU_AUDIO_QUALITIES.length - 1);
}

function isQualityUnavailable(code, message) {
  const text = String(message || "");
  return /(?:当前|该|此)?音质.*(?:不支持|不存在|暂无|未找到|无资源)|(?:没有|无|找不到).*音质/i.test(text);
}

function createCacheData(data) {
  return {
    url: data.url,
    format: data.format || "",
    bitrate: data.bitrate || "",
    id: data.id || "",
  };
}

function getTemporaryCooldown(code, response, reason) {
  const status = Number(code) || Number(response?.statusCode || response?.status) || 0;
  const retryAfter = Number(
    response?.headers?.["Retry-After"] || response?.headers?.["retry-after"],
  );
  if (status === 429) return (retryAfter > 0 ? retryAfter : 65) * 1000;
  if (status === 503) return 20 * 1000;
  if ([502, 504].includes(status)) return 10 * 1000;
  if (/timeout|timed out|connect|network|dns|ssl|tls/i.test(String(reason || ""))) {
    return 10 * 1000;
  }
  return 0;
}

function applySongData(data, hash, quality, source) {
  const original = $.toObj($response.body, {});
  const mediaUrl = data.url;

  Object.assign(original, {
    url: [mediaUrl, mediaUrl],
    backupUrl: [mediaUrl],
    status: 1,
    priv_status: 1,
    extName: getAudioExtension(data, mediaUrl),
    hash: String(data.id || hash).toUpperCase(),
  });

  $.log(`歌曲解析成功，音质=${quality}，来源=${source}，格式=${data.format || data.bitrate || "未知"}`);
  return $.done({ body: JSON.stringify(original) });
}

function formatError(error) {
  if (error instanceof Error) return error.message || String(error);
  if (typeof error === "string") return error;

  try {
    const json = JSON.stringify(error);
    if (json && json !== "{}") return json;
  } catch (_) {}

  const details = [];
  for (const key of ["error", "message", "localizedDescription", "statusCode", "status"]) {
    if (error?.[key] !== undefined) details.push(`${key}=${error[key]}`);
  }
  return details.length ? details.join(", ") : String(error);
}

async function replaceSongUrl() {
  const hash = String(getQueryParam(requestUrl, "hash") || "").toLowerCase();
  if (!hash) {
    $.log("播放请求中没有 hash，保留原响应");
    return $.done({});
  }

  const apiKey = getApiKey();
  if (!apiKey || apiKey === "YOUR_API_KEY") {
    $.logErr("未配置 apikey，请设置 KUGOU_API_KEY、脚本参数 apikey，或持久化键 kugou_music_apikey");
    return $.done({});
  }

  const now = Date.now();
  const state = pruneRuntimeState(loadRuntimeState(), now);
  const cached = state.cache[hash];
  if (cached?.data?.url && cached.expiresAt > now) {
    return applySongData(cached.data, hash, cached.quality, "缓存");
  }

  if (state.locks[hash] > now) {
    $.log(`同一歌曲正在解析，跳过重复请求，hash=${hash}`);
    return $.done({});
  }

  const waitUntil = Math.max(state.nextRequestAt, state.cooldownUntil);
  if (waitUntil > now) {
    $.log(`接口节流中，${Math.ceil((waitUntil - now) / 1000)} 秒后再试，保留原响应`);
    return $.done({});
  }

  const qualityIndex = getQualityState(state, hash, now);
  const quality = KUGOU_AUDIO_QUALITIES[qualityIndex];
  state.locks[hash] = now + KUGOU_REQUEST_LOCK_TTL;
  state.nextRequestAt = now + KUGOU_REQUEST_INTERVAL;
  saveRuntimeState(state);

  $.log(`脚本版本=${KUGOU_SCRIPT_VERSION}，开始解析歌曲，hash=${hash}，音质=${quality}，优先级=${qualityIndex + 1}/${KUGOU_AUDIO_QUALITIES.length}，apikey=${maskSecret(apiKey)}`);

  try {
    const { response, payload, data } = await requestSong(hash, quality, apiKey);
    const completedAt = Date.now();
    const latestState = pruneRuntimeState(loadRuntimeState(), completedAt);
    delete latestState.locks[hash];

    $.log(`解析接口响应：HTTP ${response.statusCode || response.status || "未知"}，code=${payload.code ?? "未知"}，msg=${payload.msg || "无"}`);

    if (Number(payload.code) === 200 && data?.url) {
      latestState.cache[hash] = {
        data: createCacheData(data),
        quality,
        expiresAt: completedAt + KUGOU_CACHE_TTL,
      };
      latestState.quality[hash] = {
        index: qualityIndex,
        expiresAt: completedAt + KUGOU_QUALITY_STATE_TTL,
      };
      latestState.cooldownUntil = 0;
      saveRuntimeState(latestState);
      return applySongData(data, hash, quality, "接口");
    }

    const message = payload.msg || `接口未返回歌曲地址，HTTP ${response.statusCode || response.status}`;
    const cooldown = getTemporaryCooldown(payload.code, response, message);
    if (cooldown > 0) {
      latestState.cooldownUntil = completedAt + cooldown;
      saveRuntimeState(latestState);
      $.log(`临时故障，保持音质=${quality}，冷却 ${Math.ceil(cooldown / 1000)} 秒，不降级`);
      throw new Error(message);
    }

    if (isQualityUnavailable(payload.code, message)) {
      const nextIndex = Math.min(qualityIndex + 1, KUGOU_AUDIO_QUALITIES.length - 1);
      latestState.quality[hash] = {
        index: nextIndex,
        expiresAt: completedAt + KUGOU_QUALITY_STATE_TTL,
      };
      saveRuntimeState(latestState);
      if (nextIndex > qualityIndex) {
        $.log(`接口明确无 ${quality}，下次仅降一档到 ${KUGOU_AUDIO_QUALITIES[nextIndex]}`);
      }
      throw new Error(message);
    }

    saveRuntimeState(latestState);
    throw new Error(message);
  } catch (error) {
    const reason = formatError(error);
    const failedAt = Date.now();
    const failedState = pruneRuntimeState(loadRuntimeState(), failedAt);
    delete failedState.locks[hash];
    const cooldown = getTemporaryCooldown(0, null, reason);
    if (cooldown > 0) {
      failedState.cooldownUntil = Math.max(failedState.cooldownUntil, failedAt + cooldown);
    }
    saveRuntimeState(failedState);
    $.logErr(`歌曲解析失败：${reason}`);
    if (/timeout|timed out|connect|network|dns|ssl|tls/i.test(reason)) {
      $.log("请检查 Quantumult X 中 api.chksz.com 的分流、DNS 和网络连通性");
    } else {
      $.log("解析服务或其上游暂时不可用，请稍后重试");
    }
    return $.done({});
  }
}

function maskSecret(secret) {
  const value = String(secret || "");
  if (value.length <= 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
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

    write(value, key) {
      try {
        if (this.isQuanX()) return $prefs.setValueForKey(value, key);
        if (typeof $persistentStore !== "undefined") return $persistentStore.write(value, key);
      } catch (_) {}
      return false;
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
