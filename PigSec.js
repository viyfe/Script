/**
 * @fileoverview PigSec 每日自动签到
 * @supported Quantumult X, Loon, Surge, Node.js
 * @cron 15 8 * * *
 */

const $ = new Env("PigSec 签到");
const notify = $.isNode() ? require('./sendNotify') : '';

let accounts = (typeof process !== "undefined" && process.env.PIGSEC_DATA) ? process.env.PIGSEC_DATA : ($.getdata("pigsec_data") || "");

const USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1";

!(async () => {
    if (!accounts) {
        $.msg($.name, "", "请配置环境变量 pigsec_data，格式为 '账号#密码'");
        return;
    }

    let accountList = accounts.split(/&|\n/).filter(item => item.trim());
    let notifyMsg = [];

    await $.wait(randomInt(2000, 5000));

    for (let i = 0; i < accountList.length; i++) {
        let acc = accountList[i].trim();
        if (!acc.includes("#")) continue;

        let [username, password] = acc.split("#");
        $.log(`\n--- 开始处理账号: ${username} ---`);
        notifyMsg.push(`【账号 ${i + 1}】${username}`);

        let tokens = await login(username, password);
        if (!tokens.access_token) {
            notifyMsg.push("❌ 登录失败，请检查账号或密码是否拼写错误");
            notifyMsg.push("-".repeat(15));
            continue;
        }
        
        await $.wait(randomInt(2000, 4000));

        // 签到前：从 /me 拿经验，从新接口拿实时积分
        let userInfoBefore = await getUserInfo(tokens.access_token);
        let financialBefore = await getFinancialSummary(tokens.access_token, tokens.refresh_token);
        
        let expBefore = userInfoBefore.total_experience || 0;
        let pointsBefore = financialBefore.points !== undefined ? financialBefore.points : (userInfoBefore.points || 0);
        
        $.log(`签到前 -> 积分: ${pointsBefore} | 经验: ${expBefore}`);

        await $.wait(randomInt(1000, 3000));

        let isChecked = await checkStatus(tokens.access_token);
        if (isChecked) {
            $.log("今日已签到，跳过签到动作...");
            notifyMsg.push(`状态: 今日已签到\n当前积分: ${pointsBefore}\n当前经验: ${expBefore}`);
        } else {
            $.log("正在执行签到...");
            let checkInRes = await executeCheckin(tokens.access_token, tokens.refresh_token);
            $.log(`签到结果: ${checkInRes}`);

            let delayAfter = randomInt(4000, 7000);
            $.log(`等待 ${delayAfter/1000} 秒后获取最新积分...`);
            await $.wait(delayAfter);

            // 签到后：再次从新接口拿实时积分
            let userInfoAfter = await getUserInfo(tokens.access_token);
            let financialAfter = await getFinancialSummary(tokens.access_token, tokens.refresh_token);
            
            let expAfter = userInfoAfter.total_experience || expBefore;
            let pointsAfter = financialAfter.points !== undefined ? financialAfter.points : pointsBefore;
            
            $.log(`签到后 -> 积分: ${pointsAfter} | 经验: ${expAfter}`);

            notifyMsg.push(`状态: ${checkInRes}\n签到前: 积分 ${pointsBefore} | 经验 ${expBefore}\n签到后: 积分 ${pointsAfter} | 经验 ${expAfter}`);
        }

        notifyMsg.push("-".repeat(15));

        if (i < accountList.length - 1) {
            await $.wait(randomInt(5000, 10000));
        }
    }

    $.msg($.name, "", notifyMsg.join("\n"));
    
    if ($.isNode() && notify) {
        await notify.sendNotify($.name, notifyMsg.join("\n"));
    }

})().catch((e) => {
    $.logErr(e);
}).finally(() => {
    $.done();
});

// --- API 请求封装 ---

function getHeaders(token = null, cookie = null) {
    let headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh-Hans;q=0.9",
        "Connection": "keep-alive"
    };
    if (token) headers["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    if (cookie) headers["Cookie"] = cookie.includes("refresh_token=") ? cookie : `refresh_token=${cookie}`;
    return headers;
}

function login(username, password) {
    return new Promise((resolve) => {
        let headers = getHeaders();
        headers["Content-Type"] = "application/json";
        headers["Origin"] = "https://www.pigsec.cn";
        headers["Referer"] = "https://www.pigsec.cn/";

        let options = {
            url: "https://www.pigsec.cn/v1/auth/login",
            headers: headers,
            body: JSON.stringify({ username, password })
        };

        $.post(options, (err, resp, data) => {
            try {
                if (err) throw err;
                let res = JSON.parse(data);
                if (res.code === 0) resolve(res.data);
                else resolve({});
            } catch (e) {
                resolve({});
            }
        });
    });
}

function getUserInfo(token) {
    return new Promise((resolve) => {
        let t = Date.now();
        let options = {
            url: `https://www.pigsec.cn/v1/auth/me?_t=${t}`,
            headers: getHeaders(token)
        };
        options.headers["Referer"] = "https://www.pigsec.cn/user";

        $.get(options, (err, resp, data) => {
            try {
                let res = JSON.parse(data);
                if (res.code === 0) resolve(res.data);
                else resolve({});
            } catch (e) {
                resolve({});
            }
        });
    });
}

// 【新增】调用你发现的资产面板接口，获取最真实的积分
function getFinancialSummary(token, cookie) {
    return new Promise((resolve) => {
        let t = Date.now();
        let options = {
            url: `https://www.pigsec.cn/v1/auth/financial/summary?_t=${t}`,
            headers: getHeaders(token, cookie)
        };
        options.headers["Referer"] = "https://www.pigsec.cn/user";

        $.get(options, (err, resp, data) => {
            try {
                let res = JSON.parse(data);
                if (res.code === 0 && res.data) resolve(res.data);
                else resolve({});
            } catch (e) {
                resolve({});
            }
        });
    });
}

function checkStatus(token) {
    return new Promise((resolve) => {
        let t = Date.now();
        let options = {
            url: `https://www.pigsec.cn/v1/checkin/status?_t=${t}`,
            headers: getHeaders(token)
        };
        options.headers["Referer"] = "https://www.pigsec.cn/index";

        $.get(options, (err, resp, data) => {
            try {
                let res = JSON.parse(data);
                if (res.code === 0) resolve(res.data.is_checkined);
                else resolve(false);
            } catch (e) {
                resolve(false);
            }
        });
    });
}

function executeCheckin(token, cookie) {
    return new Promise((resolve) => {
        let headers = getHeaders(token, cookie);
        headers["Origin"] = "https://www.pigsec.cn";
        headers["Referer"] = "https://www.pigsec.cn/index";
        headers["Content-Length"] = "0";

        let options = {
            url: "https://www.pigsec.cn/v1/checkin",
            headers: headers
        };

        $.post(options, (err, resp, data) => {
            try {
                let res = JSON.parse(data);
                if (res.code === 0) resolve(res.data.message || "签到成功");
                else resolve(res.msg || "签到失败");
            } catch (e) {
                resolve("请求异常");
            }
        });
    });
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- Env 环境兼容类 ---
function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),n={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(n,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Routing":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Routing":!1})),$httpClient.post(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="POST",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.post(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}else e(null,null,null)}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()?$notify(e,s,i,o(r)):this.isNode()),!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}
