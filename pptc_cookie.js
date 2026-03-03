/*
PP停车 自动抓取 Token
*/
const $ = new Env("PP停车获取Token");
const authKey = "pptc_auth";

if ($request && $request.headers) {
    let auth = $request.headers['Authorization'] || $request.headers['authorization'];
    if (auth) {
        $.setdata(auth, authKey);
        $.log(`获取到 Token: ${auth}`);
        $.msg("PP停车", "🎉 Token 获取成功", "已自动保存，可运行签到脚本");
    }
}
$.done();

// --- 环境兼容 ---
function Env(n){this.setdata=(v,k)=>{if(typeof $prefs!="undefined")return $prefs.setValueForKey(v,k);if(typeof $persistentStore!="undefined")return $persistentStore.write(v,k)};this.log=console.log;this.msg=(t,s,m)=> {if(typeof $notify!="undefined")$notify(t,s,m)};this.done=()=>{$done({})}}
