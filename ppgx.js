/***
 * 原作者@tidik，我稍作调整
 -------------- Quantumult X 配置 --------------
[MITM]
hostname = h5.ippzone.com
* 
* 功能：自动签到，自动刮卡
*
* 获取CK： 皮皮搞笑->我的->签到
*
[rewrite_local]
^https:\/\/h5\.ippzone\.com\/spacey\/api\/proxy\?url=(http:\/\/api\.in\.ippzone\.com\/treasure_hunt)/ url script-request-body https://raw.githubusercontent.com/tidik/quanx/master/script/ppgx.js
[task_local]
52 7 * * * https://raw.githubusercontent.com/tidik/quanx/master/script/ppgx.js, tag=皮皮搞笑, img-url=https://raw.githubusercontent.com/tidik/quanx/master/icon/ppgx.png,enabled=true
 */
const $ = new API("皮皮搞笑");
const PPGX_TOKEN = '#PPGX_TOKEN';
const proxyUrl = "https://h5.ippzone.com/spacey/api/proxy?url=";
let conUrl = {
    headers:{
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        "inApp" : true,
        "ua" : "Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 PiPi/2.94.0 PiPiBar/44"
    }
}
let remoteData = {
    kun_url:null,
    kun_level:null,
    kun_len:null,
    cards_type_1:[], //刮刮乐
    cards_type_2:[], //厘米
    is_check:false, //当天是否签到
    check_continues_days:null,//连续签到天数
    packs:[]
}
let msg = {
    check_in_msg:"",
    task_msg:""
}
function GetCookie(){
	let reqBody = JSON.parse($request.body);
	if(reqBody.token && reqBody.h_did  &&  reqBody.h_m ){
		let  token = reqBody.token+"@"+reqBody.h_did +"@" +reqBody.h_m ;
        $.write(token, PPGX_TOKEN);
        if($.read(PPGX_TOKEN)){
            $.notify("皮皮搞笑", "", "🎉 签到数据获取/更新成功。");
        }
	}
}
//签到
async function check_in(){
    let url = `${proxyUrl}http://api.in.ippzone.com/treasure_hunt/check_in`;
    conUrl.url = url;
    conUrl.body = await build_body();
    try {
        const ret = await $.http.post(conUrl);
        const body = JSON.parse(ret.body);
        if(body.ret == 1){
            let list = body.data.list;
            list.forEach(element => {
                if(element.name == "刮刮乐"){
                    remoteData.packs.push([element.id,element.pack_id]);
                }
            });
            $.notify($.name, '', "签到成功🎉~！");
        }
        if(body.ret == -1){
            $.notify($.name, '', "今日已签到过了😔");
        }
        
    } catch (error) {
        console.log(error);
    }finally{
        conUrl.url = null;  
        conUrl.body = null;
    }
}
//开启type = 1 刮刮卡
async function open_box_v2(){
    let url = `${proxyUrl}http://api.in.ippzone.com/treasure_hunt/open_box_v2`;
    conUrl.url = url;
    try {
        for(let Obj of remoteData.packs){
            conUrl.body = await build_body(['id',Obj[0]],['pack_id',Obj[1]]);
            const ret = await $.http.post(conUrl);
            const body = JSON.parse(ret.body);
            let task_msg = "";
            if(body.ret == -1){
                console.log(body.msg)
            }
            if(body.ret == 1){
                let data = body.data;
                
                data.list.forEach(element => {
                    if(element.name){
                        task_msg+=element.count+element.unit+element.name+"\n";
                    }
                });
            }else{
                task_msg = "所有（开卡）任务都完成了🎉~"
            }
            $.notify($.name, '', task_msg);
        }
    } catch (error) {
        console.log(error);
    }finally{
        conUrl.url = null; 
        conUrl.body = null;
    }
}
//开启type = 2 厘米
async function click(){
    let url = `${proxyUrl}http://api.in.ippzone.com/treasure_hunt/click`;
    conUrl.url = url;
    try {
        for(let Obj of remoteData.cards_type_2){
            conUrl.body = await build_body(['task_name',Obj],['type',2]);
            const ret = await $.http.post(conUrl);
            const body = JSON.parse(ret.body);
            let task_msg = "";
            if(body.ret == 1){
                task_msg +=body.data.bubble.task_point+"厘米\n";
            }else{
                task_msg = "所有(点击)任务都完成了🎉~"
            }
            $.notify($.name, '', task_msg);
        }
    } catch (error) {
        console.log(error);
    }finally{
        conUrl.url = null; 
        conUrl.body = null;
    }
}
//获得类型2的开卡PID
async function get_pack_id(){
    let url = `${proxyUrl}http://api.in.ippzone.com/treasure_hunt/click`;
    conUrl.url = url;
    try {
        for(let Obj of remoteData.cards_type_1){
            conUrl.body = await build_body(['id',Obj],['type',1]);
            const ret = await $.http.post(conUrl);
            const body = JSON.parse(ret.body);
            if(body.ret == 1){
                let pack_id = body.data.bubble.pack_id;
                let cid = body.data.bubble.id;
                if(pack_id && cid){
                    remoteData.packs.push([cid,pack_id]);
                }
            }
        }
    } catch (error) {
        console.log(error);
    }finally{
        Object.fromEntries(remoteData.packs)
        conUrl.url = null;
        conUrl.body = null;
    }
}
//获取奖励信息
async function get_bubbles(){
    let url = `${proxyUrl}http://api.in.ippzone.com/treasure_hunt/get_bubbles`;
    conUrl.url = url;
    conUrl.body = await build_body();
    try {
        const ret = await $.http.post(conUrl);
        const body = JSON.parse(ret.body);
        if(body.ret == 1){
            const data = body.data;
            const list = data.list;
            list.forEach((element)=>{
                if(element.type == 1){
                    remoteData.cards_type_1.push(element.id);
                }else if(element.type == 2){
                    remoteData.cards_type_2.push(element.task_name);
                }
            })
        }
    } catch (error) {
        console.log(error);
    }finally{
        conUrl.url = null;
        conUrl.body = null;
    }
}
//获取所有任务状态
async function hunt_treasure(){
    let url = `${proxyUrl}http://api.in.ippzone.com/treasure_hunt/hunt_treasure`;
    conUrl.url = url;
    conUrl.body = await build_body();
    try {
        const ret = await $.http.post(conUrl);
        const body = JSON.parse(ret.body);
        if(body.ret == 1){
            const check_in_data = body.data.check_in_data;
            get_check_in_data(check_in_data);
            const kun_data = body.data.kun_data;
            get_kun_data(kun_data)
        }
    } catch (error) {
        console.log(error);
    }finally{
        conUrl.url = null;
        conUrl.body = null;
    }
}
//构造请求体参数
async function build_body(...params){
    let tokenParams = $.read( PPGX_TOKEN).split('@');
    let token = tokenParams[0];
    let h_did = tokenParams[1];
    let h_m = Number(tokenParams[2]);
    let body = [['token',token],['h_did',h_did],['h_m',h_m]];
    params.forEach((element)=>{
        body.push(element)
    });
    return JSON.stringify(Object.fromEntries(body));
}
//获取鲲数据
function get_kun_data(kun_data){
    remoteData.kun_url = kun_data.url;
    remoteData.kun_len = kun_data.integral;
    remoteData.kun_level = kun_data.level;
}
//检测签到状态& 连续签到天数
function get_check_in_data(check_in_data){
    let has_check = check_in_data.has_check;
    if(has_check == 1){
        remoteData.is_check = true;
    }
    remoteData.check_continues_days = check_in_data.check_continues_days;
}
if (isGetCookie = typeof $request !== `undefined`) {
    GetCookie();
    $.done();
}else{
    //程序入口
    !(async()=>{
        await  hunt_treasure();
        await get_bubbles();
        if(!remoteData.is_check){
            await check_in();
        }else{
            $.notify($.name, '', "今日已签到过了😔");
        }
        if(remoteData.cards_type_1.length!=0){
            await get_pack_id();
            await open_box_v2();
        }else if(remoteData.cards_type_2.length!=0){
            await click();
        }else{
            $.notify($.name, '', "所有开卡任务都已完成😔");
        }
        $.done();
    })();
}
// prettier-ignore
/*********************************** API *************************************/
function ENV(){const e="undefined"!=typeof $task,t="undefined"!=typeof $loon,s="undefined"!=typeof $httpClient&&!t,i="function"==typeof require&&"undefined"!=typeof $jsbox;return{isQX:e,isLoon:t,isSurge:s,isNode:"function"==typeof require&&!i,isJSBox:i,isRequest:"undefined"!=typeof $request,isScriptable:"undefined"!=typeof importModule}}function HTTP(e={baseURL:""}){const{isQX:t,isLoon:s,isSurge:i,isScriptable:n,isNode:o}=ENV(),r=/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)/;const u={};return["GET","POST","PUT","DELETE","HEAD","OPTIONS","PATCH"].forEach(l=>u[l.toLowerCase()]=(u=>(function(u,l){l="string"==typeof l?{url:l}:l;const h=e.baseURL;h&&!r.test(l.url||"")&&(l.url=h?h+l.url:l.url);const a=(l={...e,...l}).timeout,c={onRequest:()=>{},onResponse:e=>e,onTimeout:()=>{},...l.events};let f,d;if(c.onRequest(u,l),t)f=$task.fetch({method:u,...l});else if(s||i||o)f=new Promise((e,t)=>{(o?require("request"):$httpClient)[u.toLowerCase()](l,(s,i,n)=>{s?t(s):e({statusCode:i.status||i.statusCode,headers:i.headers,body:n})})});else if(n){const e=new Request(l.url);e.method=u,e.headers=l.headers,e.body=l.body,f=new Promise((t,s)=>{e.loadString().then(s=>{t({statusCode:e.response.statusCode,headers:e.response.headers,body:s})}).catch(e=>s(e))})}const p=a?new Promise((e,t)=>{d=setTimeout(()=>(c.onTimeout(),t(`${u} URL: ${l.url} exceeds the timeout ${a} ms`)),a)}):null;return(p?Promise.race([p,f]).then(e=>(clearTimeout(d),e)):f).then(e=>c.onResponse(e))})(l,u))),u}function API(e="untitled",t=!1){const{isQX:s,isLoon:i,isSurge:n,isNode:o,isJSBox:r,isScriptable:u}=ENV();return new class{constructor(e,t){this.name=e,this.debug=t,this.http=HTTP(),this.env=ENV(),this.node=(()=>{if(o){return{fs:require("fs")}}return null})(),this.initCache();Promise.prototype.delay=function(e){return this.then(function(t){return((e,t)=>new Promise(function(s){setTimeout(s.bind(null,t),e)}))(e,t)})}}initCache(){if(s&&(this.cache=JSON.parse($prefs.valueForKey(this.name)||"{}")),(i||n)&&(this.cache=JSON.parse($persistentStore.read(this.name)||"{}")),o){let e="root.json";this.node.fs.existsSync(e)||this.node.fs.writeFileSync(e,JSON.stringify({}),{flag:"wx"},e=>console.log(e)),this.root={},e=`${this.name}.json`,this.node.fs.existsSync(e)?this.cache=JSON.parse(this.node.fs.readFileSync(`${this.name}.json`)):(this.node.fs.writeFileSync(e,JSON.stringify({}),{flag:"wx"},e=>console.log(e)),this.cache={})}}persistCache(){const e=JSON.stringify(this.cache,null,2);s&&$prefs.setValueForKey(e,this.name),(i||n)&&$persistentStore.write(e,this.name),o&&(this.node.fs.writeFileSync(`${this.name}.json`,e,{flag:"w"},e=>console.log(e)),this.node.fs.writeFileSync("root.json",JSON.stringify(this.root,null,2),{flag:"w"},e=>console.log(e)))}write(e,t){if(this.log(`SET ${t}`),-1!==t.indexOf("#")){if(t=t.substr(1),n||i)return $persistentStore.write(e,t);if(s)return $prefs.setValueForKey(e,t);o&&(this.root[t]=e)}else this.cache[t]=e;this.persistCache()}read(e){return this.log(`READ ${e}`),-1===e.indexOf("#")?this.cache[e]:(e=e.substr(1),n||i?$persistentStore.read(e):s?$prefs.valueForKey(e):o?this.root[e]:void 0)}delete(e){if(this.log(`DELETE ${e}`),-1!==e.indexOf("#")){if(e=e.substr(1),n||i)return $persistentStore.write(null,e);if(s)return $prefs.removeValueForKey(e);o&&delete this.root[e]}else delete this.cache[e];this.persistCache()}notify(e,t="",l="",h={}){const a=h["open-url"],c=h["media-url"];if(s&&$notify(e,t,l,h),n&&$notification.post(e,t,l+`${c?"\n多媒体:"+c:""}`,{url:a}),i){let s={};a&&(s.openUrl=a),c&&(s.mediaUrl=c),"{}"===JSON.stringify(s)?$notification.post(e,t,l):$notification.post(e,t,l,s)}if(o||u){const s=l+(a?`\n点击跳转: ${a}`:"")+(c?`\n多媒体: ${c}`:"");if(r){require("push").schedule({title:e,body:(t?t+"\n":"")+s})}else console.log(`${e}\n${t}\n${s}\n\n`)}}log(e){this.debug&&console.log(`[${this.name}] LOG: ${this.stringify(e)}`)}info(e){console.log(`[${this.name}] INFO: ${this.stringify(e)}`)}error(e){console.log(`[${this.name}] ERROR: ${this.stringify(e)}`)}wait(e){return new Promise(t=>setTimeout(t,e))}done(e={}){s||i||n?$done(e):o&&!r&&"undefined"!=typeof $context&&($context.headers=e.headers,$context.statusCode=e.statusCode,$context.body=e.body)}stringify(e){if("string"==typeof e||e instanceof String)return e;try{return JSON.stringify(e,null,2)}catch(e){return"[object Object]"}}}(e,t)}
/*****************************************************************************/