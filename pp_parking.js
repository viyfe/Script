/**
 * PP停车签到 & 刷视频积分任务
 * 自动拦截Token并保存至 BoxJS，支持多账号。
 * 每天运行2次即可。
 */

const $ = new Env("PP停车");

const KEY_DECRYPT = "466d67cf8f9810707404fae5ed172b8e";
const WX_ENCRYPT = "riegh^ee:w0fok5je5eeS{eecaes1nep";

const api_headers = {
    'Host': 'api.660pp.com',
    'accept': '*/*',
    'content-type': 'application/x-www-form-urlencoded',
    'rest_api_type': '1',
    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Parking/4.3.2 (iOS 16.6.1; iPhone15,2; Build/1312) NetType/WIFI',
    'accept-language': 'zh_CN'
};

const wx_headers = {
    'Host': 'user-api.4pyun.com',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) UnifiedPCWindowsWechat(0xf2541022) XWEB/16467',
    'xweb_xhr': '1',
    'content-type': 'application/x-www-form-urlencoded',
    'accept': '*/*',
    'referer': 'https://servicewechat.com/wxa204074068ad40ef/879/page-frame.html',
    'accept-language': 'zh-CN,zh;q=0.9'
};

// ================= 核心执行逻辑 =================
!(async () => {
    if (typeof $request !== "undefined") {
        await getCookie();
    } else {
        await main();
    }
})().catch((e) => {
    $.logErr(e);
}).finally(() => {
    $.done();
});

// ================= 重写获取 Token =================
async function getCookie() {
    let token = $request.headers["rest_api_token"] || $request.headers["Rest_api_token"] || 
                $request.headers["Authorization"] || $request.headers["authorization"];
    if (token) {
        token = token.replace("Bearer ", "");
        let currentTokens = $.getdata("pp_token") || "";
        if (currentTokens.indexOf(token) === -1) {
            let newVal = currentTokens ? currentTokens + "@" + token : token;
            $.setdata(newVal, "pp_token");
            $.msg($.name, "获取Token成功 🎉", "已自动保存到 BoxJS 数据中！");
            $.log(`[获取Token成功] ${token}`);
        }
    }
}

// ================= 定时任务逻辑 =================
async function main() {
    let tokensStr = $.getdata("pp_token") || "";
    if (!tokensStr) {
        $.msg($.name, "未找到 Token", "请先在微信小程序打开【PP停车】获取Token，或在BoxJS中手动填写");
        return;
    }
    
    let tokens = tokensStr.split(/[@&]/);
    $.log(`查找到 ${tokens.length} 个账号\n`);
    let newTokens = [];
    
    for (let i = 0; i < tokens.length; i++) {
        let u = tokens[i];
        let user_phone = u.indexOf('#') > -1 ? u.split('#')[0] : `账号${i + 1}`;
        let user_token = u.indexOf('#') > -1 ? u.split('#')[1] : u;

        $.log(`\n========== 开始执行 [${user_phone}] ==========`);
        let userInfo = await getUserInfo(user_token);
        if (!userInfo) {
            newTokens.push(u); // 失败则保留原Token
            continue;
        }

        let refreshedToken = await refreshToken(user_phone, user_token);
        if (refreshedToken) {
            newTokens.push(`${user_phone}#${refreshedToken}`);
            user_token = refreshedToken;
        } else {
            newTokens.push(u);
        }

        await daySign(userInfo.nickname, user_token);

        for (let j = 0; j < 2; j++) {
            let taskId = await getTask(userInfo.nickname, user_token);
            if (taskId) {
                await completeTask(userInfo.nickname, user_token, taskId);
            }
            await $.wait(5000); // 间隔5秒
        }

        await rewardBalance(userInfo.nickname, user_token, userInfo.userId);
        await $.wait(3000);
    }

    // 更新持久化Token防过期
    $.setdata(newTokens.join('@'), 'pp_token');
    $.log("\n所有账号执行完毕，Token缓存已更新。");
}

// ================= API 请求封装 =================
async function getUserInfo(token) {
    let headers = { ...wx_headers, 'authorization': `Bearer ${token}` };
    return new Promise(resolve => {
        $.send({ url: 'https://user-api.4pyun.com/rest/2.0/user/whoami', headers, method: 'GET' }, (err, resp, data) => {
            try {
                let res = JSON.parse(data);
                if (res.code === '1001') {
                    $.log(`[${res.payload.nickname}] 获取用户信息：成功`);
                    resolve({ nickname: res.payload.nickname, userId: res.payload.identity });
                } else {
                    $.log(`获取用户信息：失败：${data}`);
                    resolve(null);
                }
            } catch (e) {
                $.log(`获取用户信息异常：${e.message}`);
                resolve(null);
            }
        });
    });
}

async function refreshToken(phone, token) {
    let headers = { ...api_headers, 'rest_api_token': token };
    return new Promise(resolve => {
        $.send({ url: 'https://api.660pp.com/rest/1.6/user/token', headers, method: 'PUT' }, (err, resp, data) => {
            try {
                let res = JSON.parse(data);
                if (res.code === '1001') {
                    let result = JSON.parse(decrypt(res.result));
                    $.log(`[${phone}] 刷新token成功`);
                    resolve(result.token);
                } else {
                    $.log(`[${phone}] 刷新token失败：${data}`);
                    resolve(null);
                }
            } catch (e) {
                $.log(`[${phone}] 刷新token异常：${e.message}`);
                resolve(null);
            }
        });
    });
}

async function daySign(nickname, token) {
    let headers = { ...api_headers, 'rest_api_token': token };
    return new Promise(resolve => {
        $.send({ url: 'https://api.660pp.com/rest/1.6/reward/bonus?yc7OyqO6qQ%3D%3D=rL7JhL/NrriG2tPZ2aegog%3D%3D', headers, method: 'GET' }, (err, resp, data) => {
            try {
                let res = JSON.parse(data);
                if (res.code === '1001') {
                    let result = JSON.parse(decrypt(res.result));
                    let msg = result.message.replace(/\r\n/g, '');
                    if (msg.includes('签到获得') || msg.includes('已连续签到')) {
                        $.log(`[${nickname}] 签到成功：${msg} 已累计获得：${result.combo} 积分`);
                    } else if (msg === '您已签到成功') {
                        $.log(`[${nickname}] 已签到`);
                    } else {
                        $.log(`[${nickname}] 签到失败：${msg}`);
                    }
                } else {
                    $.log(`[${nickname}] 获取签到数据失败：${data}`);
                }
            } catch (e) {}
            resolve();
        });
    });
}

async function getTask(nickname, token) {
    let headers = { ...wx_headers, 'authorization': `Bearer ${token}` };
    return new Promise(resolve => {
        $.send({ url: 'https://user-api.4pyun.com/rest/2.0/bonus/reward/task/list?%2B9Hnx%2FPy=7bL7p%2FqgoK77uPOi%2B8WjqP%2Fw', headers, method: 'GET' }, (err, resp, data) => {
            try {
                let res = JSON.parse(data);
                if (res.code === '1001') {
                    let video_task = res.payload.row.find(t => t.name === '看视频得积分');
                    let referer_url = video_task.referer_url;
                    $.log(`[${nickname}] 获取视频任务数据成功`);
                    resolve(referer_url.split('&voucher=')[1]);
                } else {
                    $.log(`[${nickname}] 获取任务失败：${data}`);
                    resolve(null);
                }
            } catch (e) { resolve(null); }
        });
    });
}

async function completeTask(nickname, token, taskId) {
    let headers = { ...wx_headers, 'authorization': `Bearer ${token}`, 'content-type': 'application/json;charset=utf-8' };
    let reqData = `{"app_id":"wxa204074068ad40ef","purpose":"reward:motivate:advertising","voucher":"${taskId}"}`;
    let encrypt_data = encrypt(reqData, WX_ENCRYPT);

    return new Promise(resolve => {
        $.send({ url: 'https://user-api.4pyun.com/rest/2.0/bonus/reward/task/complete', headers, body: encrypt_data, method: 'POST' }, (err, resp, data) => {
            try {
                let res = JSON.parse(data);
                if (res.code === '1001') {
                    $.log(`[${nickname}] 看视频：任务完成`);
                    
                    // 领取奖励
                    headers['content-type'] = 'application/x-www-form-urlencoded';
                    $.send({ url: 'https://user-api.4pyun.com/rest/2.0/bonus/reward/acquire?%2B9Hnx%2FPy=7bL7p%2FqgoK77uPOi%2B8WjqP%2Fw&6u%2FT5%2Ffp8w%3D%3D=%2Fv%2Fp%2Fej%2BvsH17qPs9L7xqvir%2FqDo7sjk8fTx', headers, method: 'GET' }, (e2, r2, d2) => {
                        let res2 = JSON.parse(d2);
                        if (res2.code === '1001') $.log(`[${nickname}] 看视频奖励：${res2.payload.message}`);
                        else if (res2.message === '已达积分领取次数上限') $.log(`[${nickname}] 看视频：积分已达上限`);
                        else $.log(`[${nickname}] 看视频奖励领取失败：${res2.message}`);
                        resolve();
                    });
                } else {
                    $.log(`[${nickname}] 看视频任务失败：${data}`);
                    resolve();
                }
            } catch (e) { resolve(); }
        });
    });
}

async function rewardBalance(nickname, token, userId) {
    let headers = { ...wx_headers, 'authorization': `Bearer ${token}` };
    let url = `https://user-api.4pyun.com/rest/2.0/reward/balance?rP7%2Fz%2BPx7u8%3D=${encodeURIComponent(encrypt(userId, WX_ENCRYPT))}&7%2BnE5cfz8g%3D%3D=${encodeURIComponent(encrypt(userId, WX_ENCRYPT))}&%2Fbb%2F6P7j4erz=pw%3D%3D`;
    return new Promise(resolve => {
        $.send({ url, headers, method: 'GET' }, (err, resp, data) => {
            try {
                let res = JSON.parse(data);
                if (res.code === '1001') {
                    $.log(`[${nickname}] 积分余额：${res.payload.balance}`);
                    $.msg($.name, `[${nickname}] 积分余额：${res.payload.balance}`, "任务全部执行完毕");
                }
            } catch (e) {}
            resolve();
        });
    });
}

// ================= 加解密算法转换 =================
function transform(bytesData, key) {
    const lenKey = key.length;
    const lenB = bytesData.length;
    for (let i = 0; i < lenB; i++) {
        const index = (lenB - i) % lenKey;
        const keyByte = key.charCodeAt(index);
        const inByte = bytesData[i];
        const flipped = inByte ^ 0xFF;
        bytesData[i] = keyByte ^ flipped;
    }
    return bytesData;
}

function toUTF8Array(str) {
    let utf8 = [];
    for (let i = 0; i < str.length; i++) {
        let charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) { utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f)); }
        else if (charcode < 0xd800 || charcode >= 0xe000) { utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f)); }
        else {
            i++;
            charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
            utf8.push(0xf0 | (charcode >> 18), 0x80 | ((charcode >> 12) & 0x3f), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
        }
    }
    return utf8;
}

function fromUTF8Array(data) {
    let str = '', i;
    for (i = 0; i < data.length; i++) {
        let value = data[i];
        if (value < 0x80) { str += String.fromCharCode(value); }
        else if (value > 0xBF && value < 0xE0) { str += String.fromCharCode((value & 0x1F) << 6 | data[i + 1] & 0x3F); i += 1; }
        else if (value > 0xDF && value < 0xF0) { str += String.fromCharCode((value & 0x0F) << 12 | (data[i + 1] & 0x3F) << 6 | data[i + 2] & 0x3F); i += 2; }
        else {
            let charCode = ((value & 0x07) << 18 | (data[i + 1] & 0x3F) << 12 | (data[i + 2] & 0x3F) << 6 | data[i + 3] & 0x3F) - 0x010000;
            str += String.fromCharCode(charCode >> 10 | 0xD800, charCode & 0x03FF | 0xDC00); i += 3;
        }
    }
    return str;
}

function base64Encode(bytes) {
    const b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let res = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const b1 = bytes[i], b2 = bytes[i + 1], b3 = bytes[i + 2];
        res += b64chars[b1 >> 2];
        res += b64chars[((b1 & 3) << 4) | (b2 >> 4)];
        res += b2 !== undefined ? b64chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
        res += b3 !== undefined ? b64chars[b3 & 63] : '=';
    }
    return res;
}

function base64Decode(str) {
    const b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    str = str.replace(/=/g, '');
    let res = [];
    for (let i = 0; i < str.length; i += 4) {
        const n1 = b64chars.indexOf(str[i]), n2 = b64chars.indexOf(str[i + 1]), n3 = b64chars.indexOf(str[i + 2]), n4 = b64chars.indexOf(str[i + 3]);
        res.push((n1 << 2) | (n2 >> 4));
        if (n3 !== -1) res.push(((n2 & 15) << 4) | (n3 >> 2));
        if (n4 !== -1) res.push(((n3 & 3) << 6) | n4);
    }
    return res;
}

function encrypt(arg, key) {
    let bytesData = toUTF8Array(arg);
    let transformed = transform(bytesData, key);
    return base64Encode(transformed);
}

function decrypt(arg) {
    let bytesData = base64Decode(arg);
    let transformed = transform(bytesData, KEY_DECRYPT);
    return fromUTF8Array(transformed);
}

// ================= 底层环境类 =================
function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),n={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(n,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Routing":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Routing":!1})),$httpClient.post(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="POST",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.post(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}else e(null,null,null)}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()?$notify(e,s,i,o(r)):this.isNode()),!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}
