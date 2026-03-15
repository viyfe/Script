/**
 * @file incudal.js
 * @description Incudal 自动签到与获取 Cookie 脚本 (支持 QX, Surge, Loon, Node.js)
 */

const $ = new API("Incudal签到");
const isRequest = typeof $request !== "undefined";

const checkinUrl = "https://incudal.com/api/checkin/checkin";
const cookieKey = "incudal_cookie";
const authKey = "incudal_auth";

if (isRequest) {
    getCookie();
    $.done();
} else {
    checkin();
}

function getCookie() {
    if ($request && $request.headers) {
        // 兼容不同客户端 Header 大小写差异
        const headers = $request.headers;
        const cookie = headers['Cookie'] || headers['cookie'];
        const auth = headers['Authorization'] || headers['authorization'];

        let msg = [];
        if (cookie && cookie.includes("cf_clearance")) {
            const saveCookie = $.setdata(cookie, cookieKey);
            if (saveCookie) msg.push("Cookie 获取成功 🎉");
        }
        if (auth && auth.includes("Bearer")) {
            const saveAuth = $.setdata(auth, authKey);
            if (saveAuth) msg.push("Auth 获取成功 🎉");
        }

        if (msg.length > 0) {
            $.msg($.name, "获取凭证成功", msg.join("\n"));
        }
    }
}

function checkin() {
    const cookie = $.getdata(cookieKey);
    const auth = $.getdata(authKey);

    if (!cookie || !auth) {
        $.msg($.name, "签到失败 ❌", "请先在应用内或网页端触发接口获取 Cookie 和 Auth");
        $.done();
        return;
    }

    const request = {
        url: checkinUrl,
        headers: {
            "Host": "incudal.com",
            "Origin": "https://incudal.com",
            "Cookie": cookie,
            "Authorization": auth,
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate", // 移除 br，防止乱码
            "Referer": "https://incudal.com/entertainment",
            "Accept-Language": "zh-CN,zh-Hans;q=0.9"
        }
    };

    $.post(request, (error, response, data) => {
        if (error) {
            $.msg($.name, "签到请求失败 ❌", error);
        } else {
            try {
                // 根据实际返回的 JSON 结构调整提示信息
                const result = JSON.parse(data);
                $.msg($.name, "签到成功 ✅", `返回数据: ${data}`);
            } catch (e) {
                $.msg($.name, "签到成功，但解析失败 ⚠️", `原始返回: ${data}`);
            }
        }
        $.done();
    });
}

// --- 多端兼容层 API ---
function API(name) {
    this.name = name;
    this.isSurge = () => typeof $httpClient !== "undefined";
    this.isQuanX = () => typeof $task !== "undefined";
    this.isLoon = () => typeof $loon !== "undefined";
    this.isNode = () => typeof module !== "undefined" && !!module.exports;
    
    this.getdata = (key) => {
        if (this.isSurge() || this.isLoon()) return $persistentStore.read(key);
        if (this.isQuanX()) return $prefs.valueForKey(key);
        return null;
    };
    this.setdata = (val, key) => {
        if (this.isSurge() || this.isLoon()) return $persistentStore.write(val, key);
        if (this.isQuanX()) return $prefs.setValueForKey(val, key);
        return false;
    };
    this.msg = (title, subtitle, body) => {
        if (this.isSurge() || this.isLoon()) $notification.post(title, subtitle, body);
        if (this.isQuanX()) $notify(title, subtitle, body);
        console.log(`${title}\n${subtitle}\n${body}`);
    };
    this.post = (options, callback) => {
        if (this.isQuanX()) {
            if (typeof options == "string") options = { url: options };
            options["method"] = "POST";
            $task.fetch(options).then(response => {
                callback(null, response, response.body);
            }, reason => callback(reason.error, null, null));
        } else if (this.isSurge() || this.isLoon()) {
            $httpClient.post(options, (error, response, body) => {
                callback(error, response, body);
            });
        }
    };
    this.done = (value = {}) => {
        if (this.isQuanX() || this.isSurge() || this.isLoon()) $done(value);
    };
}
