/**
 * @file NGA论坛签到与日常任务
 * * =========================================
 * 【青龙面板配置】
 * 环境变量名称：NGA_CREDENTIALS
 * 环境变量格式：UID,AccessToken (多账号用 & 隔开，例如 12345,abcde&67890,fghij)
 * 环境变量可选：NGA_UA (默认 Nga_Official/90409)
 * * =========================================
 * 【Surge 配置】
 * [Script]
 * NGA论坛签到 = type=cron,cronexp="1 17 * * *",wake-system=1,timeout=60,script-path=nga_signin.js
 * * =========================================
 * 【Quantumult X 配置】
 * [task_local]
 * 1 17 * * * nga_signin.js, tag=NGA论坛签到, img-url=https://raw.githubusercontent.com/Orz-3/mini/master/Color/nga.png, enabled=true
 * * =========================================
 * 【Loon 配置】
 * [Script]
 * cron "1 17 * * *" script-path=nga_signin.js, tag=NGA论坛签到
 * * =========================================
 * 【代理软件填写变量】
 * BoxJS 或 代理工具内的数据中心填写（以 QX 为例在 task 处配置参数或直接改本文件下方默认值）：
 * 键名: NGA_CREDENTIALS , 值: UID,AccessToken
 */

const $ = new Env('NGA论坛签到');

// ============== 环境变量读取 ==============
// 优先读取本地变量，如果没有则尝试读取 Node 环境变量
let credentialsStr = $.isNode() ? (process.env.NGA_CREDENTIALS || "") : ($.getdata('NGA_CREDENTIALS') || "");
let ua = $.isNode() ? (process.env.NGA_UA || "Nga_Official/90409") : ($.getdata('NGA_UA') || "Nga_Official/90409");

// =========================================

// 生成指定范围的随机整数
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 模拟休眠
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 通用 NGA API 请求函数
async function nga_get(uid, token, lib, act, other = "", verbose = false) {
    return new Promise((resolve) => {
        let url = "https://ngabbs.com/nuke.php";
        let body = `access_uid=${uid}&access_token=${token}&app_id=1010&__act=${act}&__lib=${lib}&__output=11`;
        if (other) {
            body += `&${other}`;
        }

        let options = {
            url: url,
            headers: {
                "User-Agent": ua,
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept-Encoding": "gzip, deflate, br",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            },
            body: body,
            timeout: 30000
        };

        $.post(options, (err, resp, data) => {
            try {
                if (err) {
                    $.log(`    ❌ 请求错误 [${lib}/${act}]: ${JSON.stringify(err)}`);
                    resolve({ error: ["请求接口出错"] });
                } else {
                    let res = JSON.parse(data);
                    if (verbose) {
                        $.log(`    📡 操作 ${lib}/${act} 的服务器响应: ${data}`);
                    } else {
                        let resultInfo = res.time || res.code || (res.error ? res.error[0] : "完成");
                        $.log(`    ✅ 操作 ${lib}/${act} 完成: ${resultInfo}`);
                    }
                    resolve(res);
                }
            } catch (e) {
                $.log(`    ❌ 响应不是有效的JSON: ${data}`);
                resolve({ error: ["响应解析出错"] });
            }
        });
    });
}

// 1. 签到任务
async function check_in(uid, token, index) {
    $.log(`🎯 账号${index}: 开始签到`);
    let res = await nga_get(uid, token, "check_in", "check_in");
    
    if (res && res.data) {
        let signMsg = res.data[0];
        $.log(`✅ 账号${index}: 签到成功 - ${signMsg}`);
        return { msg: `签到成功: ${signMsg}`, success: true, continueTask: true };
    } else if (res && res.error) {
        let errorMsg = res.error[0];
        let errStr = String(errorMsg);
        
        if (errStr.includes("已经签到") || errStr.includes("今天已经签到了")) {
            $.log(`📅 账号${index}: 今日已签到 - ${errorMsg}`);
            return { msg: `今日已签到: ${errorMsg}`, success: true, continueTask: true };
        } else if (errStr.includes("登录") || errStr.includes("CLIENT")) {
            $.log(`❌ 账号${index}: 登录状态异常 - ${errorMsg}`);
            return { msg: `签到失败: ${errorMsg} (登录状态异常)`, success: false, continueTask: false };
        } else {
            $.log(`❌ 账号${index}: 签到失败 - ${errorMsg}`);
            return { msg: `签到失败: ${errorMsg}`, success: false, continueTask: true };
        }
    } else {
        $.log(`❌ 账号${index}: 签到失败 - 未知错误`);
        return { msg: `签到失败: 未知错误`, success: false, continueTask: false };
    }
}

// 2. 日常任务
async function daily_missions(uid, token, index) {
    $.log(`🎯 账号${index}: 开始执行日常任务`);
    let missions = [
        { param: "mid=2", name: "任务2" },
        { param: "mid=131", name: "任务131" },
        { param: "mid=30", name: "任务30" }
    ];
    let completed = [];
    
    for (let mission of missions) {
        try {
            let res = await nga_get(uid, token, "mission", "checkin_count_add", `${mission.param}&get_success_repeat=1&no_compatible_fix=1`);
            if (res && !res.error) {
                completed.push(mission.name);
                $.log(`    ✅ ${mission.name} 完成`);
            } else {
                $.log(`    ⚠️ ${mission.name} 可能已完成或失败`);
            }
            await sleep(randomInt(1000, 3000));
        } catch (e) {
            $.log(`    ❌ ${mission.name} 执行异常: ${e}`);
        }
    }
    return completed.length > 0 ? `日常任务: 完成${completed.length}个任务` : `日常任务: 未完成或已完成`;
}

// 3. 视频任务
async function video_missions(uid, token, index) {
    $.log(`🎯 账号${index}: 开始执行看视频任务(免广告)`);
    $.log(`    ⏰ 此过程视网络与环境而定...`);
    
    await nga_get(uid, token, "mission", "video_view_task_counter_add_v2_for_adfree_sp1", "", true);
    
    // 执行4次免广告任务
    for (let i = 0; i < 4; i++) {
        // Node环境采用30-45秒等待，代理软件防超时采用2-5秒等待
        let delaySec = $.isNode() ? randomInt(30, 45) : randomInt(2, 5);
        $.log(`    🎬 免广告任务第 ${i+1}/4 次，等待 ${delaySec} 秒...`);
        await sleep(delaySec * 1000);
        await nga_get(uid, token, "mission", "video_view_task_counter_add_v2_for_adfree", "", true);
    }
    
    $.log(`🎯 账号${index}: 开始执行看视频得N币任务`);
    // 执行5次N币任务
    for (let i = 0; i < 5; i++) {
        let delaySec = $.isNode() ? randomInt(30, 45) : randomInt(2, 5);
        $.log(`    💰 N币任务第 ${i+1}/5 次，等待 ${delaySec} 秒...`);
        await sleep(delaySec * 1000);
        await nga_get(uid, token, "mission", "video_view_task_counter_add_v2", "", true);
    }
    return "视频任务完成";
}

// 4. 分享任务
async function share_missions(uid, token, index) {
    $.log(`🎯 账号${index}: 开始执行分享任务`);
    let tid = randomInt(12345678, 24692245);
    
    for (let i = 0; i < 5; i++) {
        $.log(`    📤 分享任务第 ${i+1}/5 次`);
        await nga_get(uid, token, "data_query", "topic_share_log_v2", `event=4&tid=${tid}`);
        await sleep(randomInt(1000, 2000));
    }
    $.log(`    🎁 领取分享奖励`);
    await nga_get(uid, token, "mission", "check_mission", "mid=149&get_success_repeat=1&no_compatible_fix=1");
    return "分享任务完成";
}

// 5. 资产统计
async function get_stats(uid, token, index) {
    $.log(`🎯 账号${index}: 查询最终资产`);
    let res = await nga_get(uid, token, "check_in", "get_stat");
    
    if (res && res.data) {
        try {
            let [sign_info, money_info] = res.data;
            let continued_days = sign_info.continued || 'N/A';
            let sum_days = sign_info.sum || 'N/A';
            let n_coins = money_info.money_n || 'N/A';
            let copper_coins = money_info.money || 'N/A';
            
            let statsMsg = `连签: ${continued_days}天, 累签: ${sum_days}天, N币: ${n_coins}, 铜币: ${copper_coins}`;
            $.log(`    💰 ${statsMsg}`);
            return statsMsg;
        } catch (e) {
            $.log(`    ❌ 资产信息解析失败: ${e}`);
            return "资产查询失败";
        }
    } else {
        $.log(`    ❌ 资产查询失败`);
        return "资产查询失败";
    }
}

// 执行单一账号的所有流程
async function run_account(uid, token, index) {
    $.log(`\n==== 账号${index} 开始执行 ====`);
    $.log(`👤 用户ID: ${uid}`);
    
    let results = [];
    
    // 1. 签到
    let signRes = await check_in(uid, token, index);
    results.push(signRes.msg);
    
    if (!signRes.continueTask) {
        let errMsg = `❌ 账号${index}: ${uid}\n${signRes.msg}\n无法继续执行其他任务`;
        $.log(errMsg);
        return { msg: errMsg, success: false };
    }
    
    try {
        // 2. 日常任务
        let dailyRes = await daily_missions(uid, token, index);
        results.push(dailyRes);
        
        // 3. 视频任务
        let videoRes = await video_missions(uid, token, index);
        results.push(videoRes);
        
        // 4. 分享任务
        let shareRes = await share_missions(uid, token, index);
        results.push(shareRes);
        
        // 5. 查询资产
        let statsRes = await get_stats(uid, token, index);
        results.push(`最终资产: ${statsRes}`);
        
        let resultMsg = `👤 账号信息: ${uid}\n📊 执行结果:\n` + results.map(r => `  • ${r}`).join('\n');
        
        $.log(`\n🎉 === 最终执行结果 ===\n${resultMsg}`);
        $.log(`==== 账号${index} 执行完成 ====\n`);
        
        return { msg: resultMsg, success: signRes.success };
        
    } catch (e) {
        let errMsg = `❌ 账号${index}: 任务执行异常 - ${e}`;
        $.log(errMsg);
        return { msg: errMsg, success: false };
    }
}

// 主控逻辑
!(async () => {
    $.log(`==== NGA论坛签到开始 ====`);
    
    if (!credentialsStr) {
        let errorMsg = "❌ 未找到 NGA_CREDENTIALS 配置，请配置账号信息 (UID,AccessToken)";
        $.log(errorMsg);
        $.msg("NGA论坛签到失败", "", errorMsg);
        return;
    }
    
    let accounts = credentialsStr.split('&').filter(Boolean);
    $.log(`📝 共发现 ${accounts.length} 个账号`);
    
    let successCount = 0;
    let notifyArr = [];
    
    for (let i = 0; i < accounts.length; i++) {
        let acc = accounts[i];
        if (i > 0) {
            let delay = randomInt(5000, 15000);
            $.log(`💤 随机等待 ${delay/1000} 秒后处理下一个账号...`);
            await sleep(delay);
        }
        
        if (!acc.includes(',')) {
            let errorMsg = `❌ 账号${i+1}: 凭证格式错误，应为 'UID,AccessToken'`;
            $.log(errorMsg);
            $.msg(`NGA论坛账号${i+1}签到失败`, "", errorMsg);
            continue;
        }
        
        let [uid, token] = acc.split(',');
        let res = await run_account(uid.trim(), token.trim(), i + 1);
        
        if (res.success) successCount++;
        
        let title = `NGA账号${i+1} 签到${res.success ? '成功' : '失败'}`;
        $.msg(title, "", res.msg);
        notifyArr.push(`账号${i+1}: ${res.success ? '成功 ✅' : '失败 ❌'}`);
    }
    
    if (accounts.length > 1) {
        let summary = `📊 总计处理: ${accounts.length}个\n✅ 成功: ${successCount}个\n❌ 失败: ${accounts.length - successCount}个`;
        $.log(`\n📊 === 汇总统计 ===\n${summary}`);
        $.msg('NGA论坛签到汇总', "", summary);
    }
    
    $.log(`==== NGA论坛签到结束 ====`);
})()
.catch((e) => {
    $.log('', `❌ 脚本运行错误: ${e}`, '')
})
.finally(() => {
    $.done()
});

// ============================================
// 下方是通用兼容 JS 的 Env 环境封装类 (Chavy/Peng-YZM)
// 用于抹平 QX、Surge、Loon 和 Node.js 之间的 API 差异
// ============================================
function Env(name, opts) {
    class Env {
        constructor(name) { this.name = name; this.logs = []; this.isSurge = () => "undefined" != typeof $httpClient && "undefined" == typeof $loon; this.isQuanX = () => "undefined" != typeof $task; this.isLoon = () => "undefined" != typeof $loon; this.isNode = () => "undefined" != typeof module && !!module.exports; this.node = (() => { if (this.isNode()) { const request = require("request"); return { request } } else return null })(); }
        getdata(key) {
            if (this.isSurge() || this.isLoon()) return $persistentStore.read(key);
            if (this.isQuanX()) return $prefs.valueForKey(key);
            if (this.isNode()) return process.env[key];
        }
        setdata(val, key) {
            if (this.isSurge() || this.isLoon()) return $persistentStore.write(val, key);
            if (this.isQuanX()) return $prefs.setValueForKey(val, key);
            if (this.isNode()) { process.env[key] = val; return true; }
        }
        msg(title, subtitle = "", desc = "") {
            if (this.isSurge() || this.isLoon()) $notification.post(title, subtitle, desc);
            if (this.isQuanX()) $notify(title, subtitle, desc);
            if (this.isNode()) console.log(`\n[通知] ${title}\n${subtitle}\n${desc}`);
        }
        log(...args) {
            args.length > 0 && (this.logs = [...this.logs, ...args]);
            console.log(args.join(this.isNode() ? "\n" : "\n"));
        }
        post(options, callback) {
            if (this.isQuanX()) {
                if (typeof options == "string") options = { url: options };
                options.method = "POST";
                $task.fetch(options).then(response => {
                    response.status = response.statusCode;
                    callback(null, response, response.body);
                }, reason => callback(reason.error, null, null));
            } else if (this.isSurge() || this.isLoon()) {
                $httpClient.post(options, (err, response, body) => {
                    if (response) response.status = response.statusCode;
                    callback(err, response, body);
                });
            } else if (this.isNode()) {
                this.node.request.post(options, (err, response, body) => {
                    if (response) response.status = response.statusCode;
                    callback(err, response, body);
                });
            }
        }
        done(val = {}) {
            const endTime = new Date().getTime();
            const costTime = (endTime - (this.startTime || endTime)) / 1000;
            if (this.isSurge() || this.isQuanX() || this.isLoon()) {
                $done(val);
            }
        }
    }
    return new Env(name);
}
