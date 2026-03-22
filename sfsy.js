/**
 * cron: 10 12 * * *
 * const $ = new Env('顺丰速运')
 * 顺丰速运日常积分任务 - 1:1 完整修复版
 */

const $ = new Env("顺丰速运");

// ==================== 基础加密补丁 ====================
const MD5 = (function() {
    function i(d) {
        for (var r = [], n = 0; n < d.length; n++) {
            var t = d.charCodeAt(n);
            t < 128 ? r.push(t) : t < 2048 ? (r.push(192 | t >> 6), r.push(128 | 63 & t)) : t < 55296 || t >= 57344 ? (r.push(224 | t >> 12), r.push(128 | t >> 6 & 63), r.push(128 | 63 & t)) : (t = 65536 + ((1023 & t) << 10) + (1023 & d.charCodeAt(++n)), r.push(240 | t >> 18), r.push(128 | t >> 12 & 63), r.push(128 | t >> 6 & 63), r.push(128 | 63 & t))
        }
        return r
    }
    function a(d, r) {
        for (var n = d[r], t = d[r+1], e = d[r+2], o = d[r+3], a = d[r+4], f = d[r+5], c = d[r+6], i = d[r+7], u = d[r+8], s = d[r+9], h = d[r+10], l = d[r+11], v = d[r+12], g = d[r+13], p = d[r+14], m = d[r+15], C = 1732584193, M = -271733879, b = -1732584194, y = 271733878, w = 0; w < 64; w++) {
            var x = C; C = y, y = b, b = M, M = x + function(d, r, n, t, e, a, f) {
                return r + (d + (e ^ (r ^ n) & (t ^ e)) + f << a | d + (e ^ (r ^ n) & (t ^ e)) + f >>> 32 - a)
            }(M, b, y, C, w < 16 ? d[r + w] : w < 32 ? d[r + (5 * w + 1) % 16] : w < 48 ? d[r + (3 * w + 5) % 16] : d[r + (7 * w) % 16], w < 16 ? [7, 12, 17, 22][w % 4] : w < 32 ? [5, 9, 14, 20][w % 4] : w < 48 ? [4, 11, 16, 23][w % 4] : [6, 10, 15, 21][w % 4], w < 16 ? [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0][w] : w < 32 ? [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1][w-16] : w < 48 ? [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2][w-32] : [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3][w-48])
        }
        d[r] = C, d[r + 1] = M, d[r + 2] = b, d[r + 3] = y
    }
    return function(d) {
        var r = i(d), n = r.length, t = [n << 3, 0];
        for (var o = 0; o < n; o++) t[o >> 2] |= r[o] << 24 - (o % 4) * 8;
        for (var l = n + 8 >> 6 << 4 | 14, o = 0; o < l; o += 16) a(t, o);
        var f = [];
        for (var c = 0; c < 32; c++) f.push((t[c >> 2] >>> 24 - (c % 4) * 8 & 255).toString(16).padStart(2, "0"));
        return f.join("")
    }
})();

// ==================== Config ====================
const Config = {
    APP_NAME: "顺丰速运",
    VERSION: "1.2.0",
    ENV_NAME: "sfsyUrl",
    TOKEN: 'wwesldfs29aniversaryvdld29',
    SYS_CODE: 'MCS-MIMP-CORE',
    SKIP_TASKS: ['用行业模板寄件下单','用积分兑任意礼品','参与积分活动','每月累计寄件','完成每月任务','去使用AI寄件']
};

// ==================== Logger ====================
class Logger {
    constructor() {
        this.ICONS = {
            'task_found': '🎯', 'task_skip': '⏭️', 'task_complete': '✅', 'reward_get': '🎁',
            'info': '📝', 'success': '✨', 'error': '❌', 'warning': '⚠️', 'user': '👤', 'money': '💰'
        };
    }
    _format_msg(icon, content) { return `${icon} ${content}`; }
    task_found(name, status) { console.log(this._format_msg(this.ICONS.task_found, `发现任务: ${name} (状态: ${status})`)); }
    task_skip(name) { console.log(this._format_msg(this.ICONS.task_skip, `[${name}] 已跳过`)); }
    task_complete(name) { console.log(this._format_msg(this.ICONS.task_complete, `[${name}] 提交成功`)); }
    reward_get(name) { console.log(this._format_msg(this.ICONS.reward_get, `[${name}] 奖励领取成功`)); }
    info(c) { console.log(this._format_msg(this.ICONS.info, c)); }
    success(c) { console.log(this._format_msg(this.ICONS.success, c)); }
    error(c) { console.log(this._format_msg(this.ICONS.error, c)); }
    user_info(idx, mobile) { console.log(this._format_msg(this.ICONS.user, `账号${idx}: 【${mobile}】登录成功`)); }
    points_info(pts, prefix) { console.log(this._format_msg(this.ICONS.money, `${prefix}: 【${pts}】`)); }
}

const logger = new Logger();

// ==================== TaskExecutor ====================
class TaskExecutor {
    constructor(ck) {
        this.cookie = ck;
        this.headers = {
            'Host': 'mcs-mimp-web.sf-express.com',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 mediaCode=SFEXPRESSAPP-iOS-ML',
            'platform': 'MINI_PROGRAM',
            'Content-Type': 'application/json;charset=UTF-8'
        };
        this.total_points = 0;
    }

    async request(url, data = {}, method = 'POST') {
        const ts = Date.now().toString();
        const signStr = `token=${Config.TOKEN}&timestamp=${ts}&sysCode=${Config.SYS_CODE}`;
        const signature = MD5(signStr);
        const headers = { ...this.headers, timestamp: ts, signature: signature, sysCode: Config.SYS_CODE, 'Cookie': this.cookie };
        return new Promise(resolve => {
            const opt = { url, headers };
            if (method === 'POST') opt.body = JSON.stringify(data);
            const req = method === 'POST' ? $.post : $.get;
            req.call($, opt, (err, resp, body) => {
                try { resolve(JSON.parse(body)); } catch (e) { resolve(null); }
            });
        });
    }

    generate_device_id() {
        return 'xxxxxxxx-xxxx-xxxx'.replace(/[x]/g, () => (Math.random() * 16 | 0).toString(16));
    }

    extract_task_id(url) {
        try {
            if (url && url.includes('_ug_view_param=')) {
                let params = JSON.parse(decodeURIComponent(url.split('_ug_view_param=')[1].split('&')[0]));
                return params.taskId ? String(params.taskId) : '';
            }
        } catch (e) {} return '';
    }

    async app_sign_in() {
        this.headers.platform = 'SFAPP';
        const url = 'https://mcs-mimp-web.sf-express.com/mcs-mimp/commonPost/~memberNonactivity~integralTaskSignPlusService~getUnFetchPointAndDiscount';
        let res = await this.request(url);
        if (res?.success) {
            if (res.obj && res.obj.length > 0) logger.success(`[APP签到] 成功`);
            else logger.info(`[APP签到] 无可领取奖励`);
        } else if (res?.errorMessage?.includes('没有待领取礼包')) {
            await $.wait(1000);
            await this.request(url);
        }
        this.headers.platform = 'MINI_PROGRAM';
    }

    async sign_in() {
        let res = await this.request('https://mcs-mimp-web.sf-express.com/mcs-mimp/commonPost/~memberNonactivity~integralTaskSignPlusService~automaticSignFetchPackage', {comeFrom: "vioin", channelFrom: "WEIXIN"});
        if (res?.success && res.obj) {
            let packetName = "";
            // 修复点：加入严谨的数组判断 
            if (res.obj.integralTaskSignPackageVOList && res.obj.integralTaskSignPackageVOList.length > 0) {
                packetName = res.obj.integralTaskSignPackageVOList[0].packetName || "";
            }
            logger.success(`签到成功 ${packetName ? '获得【' + packetName + '】' : ''}，累计签到【${(res.obj.countDay || 0) + 1}】天`);
        } else {
            logger.info(`签到提示: ${res?.errorMessage || '今日已签到'}`);
        }
    }

    async get_task_list() {
        const url = 'https://mcs-mimp-web.sf-express.com/mcs-mimp/commonPost/~memberNonactivity~integralTaskStrategyService~queryPointTaskAndSignFromES';
        let all = [], seen = new Set();
        for (let ch of ['1', '2', '3', '4', '01', '02', '03', '04']) {
            let res = await this.request(url, {channelType: ch, deviceId: this.generate_device_id()});
            if (res?.success && res.obj) {
                if (ch === '1') this.total_points = res.obj.totalPoint || 0;
                (res.obj.taskTitleLevels || []).forEach(t => {
                    let code = t.taskCode || this.extract_task_id(t.buttonRedirect);
                    if (code && !seen.has(code)) { seen.add(code); t.taskCode = code; all.push(t); }
                });
            }
        }
        return all;
    }

    async handle_welfare_task(taskCode) {
        let list = await this.request('https://mcs-mimp-web.sf-express.com/mcs-mimp/commonPost/~memberGoods~mallGoodsLifeService~list', {memGrade: 3, categoryCode: "SHTQ", showCode: "SHTQWNTJ"});
        if (list?.success && list.obj) {
            for (let mod of list.obj) {
                if (!mod.goodsList) continue;
                for (let g of mod.goodsList) {
                    if (g.exchangeStatus === 1) {
                        let res = await this.request('https://mcs-mimp-web.sf-express.com/mcs-mimp/commonPost/~memberGoods~pointMallService~createOrder', {from: "Point_Mall", orderSource: "POINT_MALL_EXCHANGE", goodsNo: g.goodsNo, quantity: 1, taskCode: taskCode});
                        if (res?.success) { logger.success(`成功领取生活特权: ${g.goodsName}`); return true; }
                    }
                }
            }
        }
        return false;
    }

    async run_all_tasks() {
        let tasks = await this.get_task_list();
        if (!tasks) return;
        logger.points_info(this.total_points, "执行前积分");

        for (let t of tasks) {
            if (t.status === 3) { logger.success(`${t.title} - 已完成`); continue; }
            if (Config.SKIP_TASKS.includes(t.title)) { logger.task_skip(t.title); continue; }
            
            logger.task_found(t.title, t.status);

            if (t.title.includes('领任意生活特权福利')) {
                if (await this.handle_welfare_task(t.taskCode)) {
                    await $.wait(2000);
                    let f = await this.request('https://mcs-mimp-web.sf-express.com/mcs-mimp/commonRoutePost/memberEs/taskRecord/finishTask', {taskCode: t.taskCode});
                    if (f?.success) { logger.task_complete(t.title); await $.wait(2000); await this.receive_reward(t); }
                }
                continue;
            }

            if (t.status === 1) {
                let f = await this.request('https://mcs-mimp-web.sf-express.com/mcs-mimp/commonRoutePost/memberEs/taskRecord/finishTask', {taskCode: t.taskCode});
                if (f?.success) { logger.task_complete(t.title); await $.wait(2000); t.status = 2; }
            }

            if (t.status === 2) await this.receive_reward(t);
            await $.wait(3000);
        }
        await this.get_task_list(); 
        logger.points_info(this.total_points, "执行后积分");
    }

    async receive_reward(t) {
        let res = await this.request('https://mcs-mimp-web.sf-express.com/mcs-mimp/commonPost/~memberNonactivity~integralTaskStrategyService~fetchIntegral', {strategyId: t.strategyId, taskId: t.taskId, taskCode: t.taskCode, deviceId: this.generate_device_id()});
        if (res?.success) logger.reward_get(t.title);
    }
}

// ==================== Main ====================
async function main() {
    let ckStr = $.getdata(Config.ENV_NAME);
    if (!ckStr) return $.msg($.name, "❌ 缺少配置", "请先通过重写获取顺丰Cookie");

    const accounts = ckStr.split('&').filter(x => x);
    for (let i = 0; i < accounts.length; i++) {
        let ck = accounts[i];
        let mobile = (ck.match(/_login_mobile_=([^;]+)/) || [])[1] || "未知";
        logger.user_info(i + 1, mobile.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'));

        const exec = new TaskExecutor(ck);
        await exec.app_sign_in();
        await $.wait(1000);
        await exec.sign_in();
        await exec.run_all_tasks();
    }
}

function getCookie() {
    if ($request.url.includes("mcs-mimp-web.sf-express.com")) {
        const ck = $request.headers['Cookie'] || $request.headers['cookie'];
        if (ck?.includes('sessionId=')) {
            let old = $.getdata(Config.ENV_NAME) || "";
            if (!old.includes(ck)) {
                $.setdata(old ? `${old}&${ck}` : ck, Config.ENV_NAME);
                $.msg($.name, "✅ 获取Cookie成功", "已存入持久化变量");
            }
        }
    }
    $.done();
}

if (typeof $request !== "undefined") getCookie();
else main().catch(e => $.logErr(e)).finally(() => $.done());

// ==================== Env ====================
function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Routing":"false"})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Routing":"false"})),$httpClient.post(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="POST",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.post(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),this.log("",`==============📣系统通知📣==============`,e,s,i)}}(t,e)}
