/**
 * @file NGA 自动获取 UID 和 AccessToken
 * * 使用说明：
 * 1. 开启本脚本的重写规则。
 * 2. 打开 NGA App 刷新首页，或者在浏览器登录 NGA 网页版。
 * 3. 弹出“NGA获取凭证成功”通知后，请禁用此脚本，以免每次请求都触发重复写入。
 */

const $ = new Env("NGA获取凭证");

let uid = "";
let token = "";
let reqUri = $request.url;

// 1. 尝试从请求体 (App端请求通常在 body 中) 提取
if ($request.body && typeof $request.body === "string") {
    let uidMatch = $request.body.match(/access_uid=([^&]+)/);
    let tokenMatch = $request.body.match(/access_token=([^&]+)/);
    if (uidMatch && uidMatch[1]) uid = uidMatch[1];
    if (tokenMatch && tokenMatch[1]) token = tokenMatch[1];
}

// 2. 尝试从 Header 的 Cookie (网页端) 中提取
let cookie = $request.headers && ($request.headers["Cookie"] || $request.headers["cookie"]);
if (!uid && cookie) {
    let uidMatch = cookie.match(/ngaPassportUid=([^;]+)/);
    let tokenMatch = cookie.match(/ngaPassportCid=([^;]+)/);
    if (uidMatch && uidMatch[1]) uid = uidMatch[1];
    if (tokenMatch && tokenMatch[1]) token = tokenMatch[1];
}

if (uid && token) {
    let credentials = `${uid},${token}`;
    let oldCreds = $.getdata("NGA_CREDENTIALS");

    // 避免重复通知和写入
    if (oldCreds !== credentials) {
        // 如果想支持多账号自动追加，可以改成: 
        // let newCreds = oldCreds ? oldCreds + "&" + credentials : credentials;
        // 这里默认采用单账号覆盖模式，最不容易出错。
        $.setdata(credentials, "NGA_CREDENTIALS");
        $.msg("NGA获取凭证成功 🎉", "已保存到持久化存储", `UID: ${uid}\n现在你可以关闭此获取脚本，签到脚本会自动读取。`);
        $.log(`成功获取并存储凭证: ${credentials}`);
    }
}

// 必须调用 done 释放请求
$.done({});

// ============================================
// 兼容 QX, Surge, Loon 的 Env 环境类
// ============================================
function Env(t){class s{constructor(t){this.name=t,this.logs=[],this.isSurge=()=>"undefined"!=typeof $httpClient&&"undefined"==typeof $loon,this.isQuanX=()=>"undefined"!=typeof $task,this.isLoon=()=>"undefined"!=typeof $loon}getdata(t){if(this.isSurge()||this.isLoon())return $persistentStore.read(t);if(this.isQuanX())return $prefs.valueForKey(t)}setdata(t,s){if(this.isSurge()||this.isLoon())return $persistentStore.write(t,s);if(this.isQuanX())return $prefs.setValueForKey(t,s)}msg(t,s="",i=""){if(this.isSurge()||this.isLoon())$notification.post(t,s,i);if(this.isQuanX())$notify(t,s,i)}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join("\n"))}done(t={}){const s=new Date().getTime(),i=(s-(this.startTime||s))/1e3;if(this.isSurge()||this.isQuanX()||this.isLoon())$done(t)}}return new s(t)}
