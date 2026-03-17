/**
 * 51代理每日签到 (多环境兼容版)
 * 变量名: dailick
 * 变量格式: 手机号#密码 
 * 多账号格式: 账号1#密码1&账号2#密码2
 * 支持 BoxJS 数据持久化存储
 */

const $ = new Env("51代理签到");

// 修复了在 QX/Surge 等环境中因找不到 process 对象而导致 "A JavaScript exception occurred" 的报错
let accounts = $.getdata("dailick") || (typeof process !== 'undefined' ? process.env.dailick : "") || "";
let currentCookie = ""; // 存放当前账号的 Cookie 会话

!(async () => {
    if (!accounts) {
        $.msg($.name, "", "❌ 请先在 BoxJS 或环境变量中填写 dailick 变量");
        return;
    }
    let accountsArr = accounts.split('&');
    console.log(`✅ 获取到 ${accountsArr.length} 个账号\n`);

    let notifyContent = [];

    for (let i = 0; i < accountsArr.length; i++) {
        currentCookie = ""; // 切换账号时清空 Cookie 会话
        let ck = accountsArr[i].split('#');
        if (ck.length < 2) {
            console.log(`⚠️ 第 ${i + 1} 个账号格式错误，没有用 # 分开`);
            continue;
        }
        let zh = ck[0];
        let ma = ck[1];
        console.log(`\n========= 账号 [${zh}] 开始 =========`);

        let isLogin = await login(zh, ma);
        if (!isLogin) {
            notifyContent.push(`👤 账号[${zh}]: 登录失败 ❌`);
            continue;
        }

        let checkinStatus = await checkin();
        let balance = await getInfo();
        console.log(`✅ 当前状态: ${checkinStatus}`);
        console.log(`💰 当前余额: ${balance}`);

        notifyContent.push(`👤 账号[${zh}]: ${checkinStatus}, 余额 ${balance}`);
    }

    // 发送最终的推送通知
    $.msg($.name, `运行完毕，共 ${accountsArr.length} 个账号`, notifyContent.join('\n'));

})()
.catch((e) => $.logErr(e))
.finally(() => $.done());

// ==============================================
// 核心请求功能 (包含 Cookie 自动拼装功能)
// ==============================================
function myRequest(options, method = 'get') {
    if (!options.headers) options.headers = {};
    if (currentCookie) options.headers['Cookie'] = currentCookie;

    return new Promise((resolve) => {
        const callback = (err, resp, data) => {
            if (resp && resp.headers) {
                let setCookie = resp.headers['Set-Cookie'] || resp.headers['set-cookie'];
                if (setCookie) {
                    // 兼容 QX(逗号分隔字符串) 和 Node(数组)
                    let cookieArr = Array.isArray(setCookie) ? setCookie : setCookie.split(/,(?=\s*[a-zA-Z0-9_\-]+=\s*)/);
                    let cookieObj = {};
                    if (currentCookie) {
                        currentCookie.split(';').forEach(c => {
                            let parts = c.split('=');
                            if (parts.length >= 2) cookieObj[parts[0].trim()] = parts.slice(1).join('=').trim();
                        });
                    }
                    cookieArr.forEach(c => {
                        let pair = c.split(';')[0].split('=');
                        if (pair.length >= 2) cookieObj[pair[0].trim()] = pair.slice(1).join('=').trim();
                    });
                    currentCookie = Object.keys(cookieObj).map(k => `${k}=${cookieObj[k]}`).join('; ');
                }
            }
            resolve({ err, resp, data: data || "" });
        };

        if (method === 'get') $.get(options, callback);
        else $.post(options, callback);
    });
}

// ==============================================
// 具体业务逻辑
// ==============================================
async function getToken() {
    let options = {
        url: 'https://www.51daili.com/index/index/index.html',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'X-Requested-With': 'com.mmbox.xbrowser'
        }
    };
    let { data } = await myRequest(options, 'get');
    // 使用正则替代 BeautifulSoup 提取 token
    let match = data.match(/name="__login_token__"\s+value="(.*?)"/);
    if (!match) console.log("⚠️ 未找到 Token");
    return match ? match[1] : null;
}

async function bypassValidation() {
    let headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
    };
    await myRequest({ url: 'https://www.51daili.com/index/user/checkCode?tn_r=110.17999267578125', headers }, 'get');
    await myRequest({ url: 'https://www.51daili.com/index/user/getCode.html?t=0.23900913777058808', headers }, 'get');
}

async function login(zh, ma) {
    let url = 'https://www.51daili.com/index/user/login.html';
    let headers = {
        'Accept': '*/*',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    };

    // 尝试登录（还原了 Python 中的 h < 51 的逻辑）
    for (let h = 0; h < 51; h++) {
        let token = await getToken();
        if (!token) return false;
        
        await bypassValidation();

        let body = `__login_token__=${token}&account=${zh}&password=${ma}&ticket=1&keeplogin=1&is_read=1`;
        let { data } = await myRequest({ url, headers, body }, 'post');

        if (data.includes('登录成功')) {
            console.log('✅ 登录成功');
            return true;
        } else if (data.includes('您已经登录')) {
            console.log('✅ 您已经登录');
            return true;
        } else if (data.includes('未找到此用户')) {
            console.log('❌ 用户名错误');
            return false;
        } else if (data.includes('密码不匹配')) {
            console.log('❌ 用户密码错误');
            return false;
        } else if (data.includes('按钮开始验证')) {
            if (h === 50) {
                console.log('❌ 该账号多次登陆失败，请稍后再运行');
                return false;
            }
            if (h === 10) {
                console.log('⚠️ 登陆失败，遇到滑块验证，正在多次重试突破中...');
            }
            // 稍作延时防止封IP
            await new Promise(r => setTimeout(r, 500));
        } else {
            console.log(`❓ 未知状态: ${data}`);
            return false;
        }
    }
    return false;
}

async function checkin() {
    let url = 'https://www.51daili.com/index/user/signin.html';
    let { data } = await myRequest({ url }, 'get');
    if (data.includes('签到成功')) {
        return '签到成功 🎉';
    } else if (data.includes('您已签到')) {
        return '已签到 🔁';
    } else {
        return `签到异常 ⚠️`;
    }
}

async function getInfo() {
    let url = 'https://www.51daili.com/index/user/index.html';
    let { data } = await myRequest({ url }, 'get');
    
    // 使用正则替代 BeautifulSoup 获取网页内的余额 p 标签
    let regex = /<div class="rcount_c_left">[\s\S]*?<p>(.*?)<\/p>/g;
    let match;
    let balances = [];
    while ((match = regex.exec(data)) !== null) {
        let val = match[1].replace(/<[^>]+>/g, '').trim(); // 清除标签
        balances.push(val);
    }
    
    // 对应原脚本的 ye = balances[2]
    if (balances.length >= 3) {
        return balances[2];
    }
    return "解析失败";
}

// ==============================================
// 底部 Env 类 (多环境兼容核心)
// ==============================================
function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMutant=!!this.isSurge()||!!this.isQuanX()||!!this.isLoon(),this.isSurge=()=>"undefined"!=typeof $httpClient&&"undefined"==typeof $loon,this.isQuanX=()=>"undefined"!=typeof $task,this.isLoon=()=>"undefined"!=typeof $loon,this.isNode=()=>"undefined"!=typeof module&&!!module.exports,this.log=((...t)=>{this.logs=[...this.logs,...t],t?console.log(t.join("\n")):console.log("\n")}),this.msg=((e=t,s="",i="",r)=>{const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};this.isMutant()&&(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r)));if(!this.isMutant()){this.log("==============📣系统通知📣=============="),this.log("title:",e),this.log("subval:",s),this.log("body:",i)}}),this.getdata=(t=>this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null),this.setdata=((t,e)=>this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null),this.done=((t={})=>this.isSurge()||this.isQuanX()||this.isLoon()?$done(t):this.isNode()?process.exit(1):void 0)}}
