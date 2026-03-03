/*
PP停车小程序 - 全平台兼容版 (青龙 / QX / Loon / Surge)

[青龙面板使用]
1. 在环境变量添加 PPTC_AUTH，值为抓包到的 Authorization 值 (如 Bearer eyJhb...)
2. Node 环境需安装 request 依赖。

[Quantumult X 配置参考]
[mitm]
hostname = user-api.4pyun.com

[rewrite_local]
^https?:\/\/user-api\.4pyun\.com\/rest\/2\.0\/ url script-request-header pptc.js

[task_local]
5 8 * * * pptc.js, tag=PP停车签到, enabled=true
*/

const $ = new Env("PP停车");

// 1. 判断是否为重写请求触发（自动获取 Token）
if (typeof $request !== 'undefined' && $request.url) {
    if ($request.url.indexOf("user-api.4pyun.com") > -1) {
        let auth = $request.headers['Authorization'] || $request.headers['authorization'];
        if (auth) {
            $.setdata(auth, "PPTC_AUTH");
            $.log("🎉 获取 Token 成功: " + auth.substring(0, 25) + "...");
            $.msg($.name, "🎉 获取 Token 成功", "已保存到本地，请手动运行一次脚本测试。");
        }
    }
    $.done();
} else {
    // 2. 判断为定时任务触发（执行签到和查询）
    main().catch(e => $.log(e)).finally(() => $.done());
}

async function main() {
    let token = $.getdata("PPTC_AUTH") || $.getdata("pptc_auth");
    
    if (!token) {
        $.log("❌ 未找到 Token，请先抓包或在环境变量设置 PPTC_AUTH");
        $.msg($.name, "❌ 任务失败", "未找到 Token，请进入小程序触发重写抓取。");
        return;
    }
    
    // 容错：自动补全 Bearer
    if (!token.startsWith("Bearer ")) {
        token = "Bearer " + token;
    }

    $.log("🚀 开始执行 PP停车 任务...");
    
    const headers = {
        'Authorization': token,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.69',
        'Content-Type': 'application/json'
    };

    let msgStr = "";

    // 【1】执行签到
    $.log("正在请求签到接口...");
    let checkInRes = await $.get({ url: "https://user-api.4pyun.com/rest/2.0/bonus/reward/task/status", headers: headers });
    
    if (checkInRes && checkInRes.body) {
        try {
            let res = JSON.parse(checkInRes.body);
            if (res.code === "1001" && res.payload) {
                $.log(`✅ 签到成功: 连续签到 ${res.payload.combo} 天`);
                msgStr += `[签到] 连续签到 ${res.payload.combo} 天\n`;
            } else {
                $.log(`⚠️ 签到返回状态异常: ${checkInRes.body}`);
                msgStr += `[签到] ${res.message || '返回异常'}\n`;
            }
        } catch (e) {
            $.log(`❌ 签到数据解析失败: ${checkInRes.body}`);
        }
    } else {
        $.log(`❌ 签到网络请求失败`);
    }

    // 【2】查询余额
    $.log("正在请求余额接口...");
    let balanceRes = await $.get({ url: "https://user-api.4pyun.com/rest/2.0/reward/balance", headers: headers });
    
    if (balanceRes && balanceRes.body) {
        try {
            let res = JSON.parse(balanceRes.body);
            if (res.code === "1001" && res.payload) {
                $.log(`✅ 余额查询成功: ${res.payload.balance} 积分`);
                msgStr += `[积分] 当前余额 ${res.payload.balance} 分\n[等级] ${res.payload.level.name}`;
            } else {
                $.log(`⚠️ 余额返回状态异常: ${balanceRes.body}`);
            }
        } catch (e) {
            $.log(`❌ 余额数据解析失败: ${balanceRes.body}`);
        }
    } else {
        $.log(`❌ 余额网络请求失败`);
    }

    // 发送最终通知
    $.msg($.name, "执行完毕", msgStr);
}

// ============================================
// 稳如磐石的多平台兼容底层 (Env)
// ============================================
function Env(name) {
    this.name = name;
    this.isNode = () => 'undefined' !== typeof module && !!module.exports;
    this.isQX = () => 'undefined' !== typeof $task;
    this.isSurge = () => 'undefined' !== typeof $httpClient && 'undefined' === typeof $loon;
    this.isLoon = () => 'undefined' !== typeof $loon;

    this.log = (...msgs) => {
        console.log(`[${this.name}] ${msgs.join(" ")}`);
    };

    this.getdata = (key) => {
        if (this.isNode()) return process.env[key];
        if (this.isQX()) return $prefs.valueForKey(key);
        if (this.isSurge() || this.isLoon()) return $persistentStore.read(key);
        return null;
    };

    this.setdata = (val, key) => {
        if (this.isNode()) return false;
        if (this.isQX()) return $prefs.setValueForKey(val, key);
        if (this.isSurge() || this.isLoon()) return $persistentStore.write(val, key);
        return false;
    };

    this.msg = (title, subtitle, desc) => {
        if (this.isQX()) $notify(title, subtitle, desc);
        if (this.isSurge() || this.isLoon()) $notification.post(title, subtitle, desc);
        if (this.isNode()) console.log(`\n[通知] ${title}\n${subtitle}\n${desc}\n`);
    };

    this.get = (options) => {
        return new Promise((resolve) => {
            if (this.isNode()) {
                const req = typeof require !== 'undefined' ? require('request') : null;
                if (req) {
                    req(options, (error, response, body) => resolve({ error, response, body }));
                } else {
                    resolve({ error: "Missing request module", response: null, body: null });
                }
            } else if (this.isQX()) {
                options.method = 'GET';
                $task.fetch(options).then(
                    response => resolve({ error: null, response, body: response.body }),
                    error => resolve({ error: error.error || error, response: null, body: null })
                );
            } else if (this.isSurge() || this.isLoon()) {
                $httpClient.get(options, (error, response, body) => resolve({ error, response, body }));
            }
        });
    };

    this.done = () => {
        if (this.isNode()) return;
        if (typeof $done !== 'undefined') $done({});
    };
}

// --- 环境兼容层 ---
function Env(n){this.getdata=(k)=>{if(typeof $prefs!="undefined")return $prefs.valueForKey(k);if(typeof $persistentStore!="undefined")return $persistentStore.read(k)};this.wait=(ms)=>new Promise(r=>setTimeout(r,ms));this.log=(...m)=>console.log(`[${n}]`,...m);this.send=(o,c)=>{if(typeof require!="undefined"){require('request')[o.method.toLowerCase()](o,c)}else{$task.fetch(o).then(r=>c(null,r,r.body),e=>c(e))}};this.done=()=>{$done({})}}
