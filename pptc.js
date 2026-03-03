/*
PP停车 自动签到+视频任务
*/
const $ = new Env("PP停车任务");
// 兼容：优先读取环境变量 PPTC_AUTH，没有则读取本地抓取的
const token = (typeof process !== 'undefined' && process.env.PPTC_AUTH) ? process.env.PPTC_AUTH : $.getdata("pptc_auth");

async function main() {
    if (!token) {
        $.log("❌ 无 Token，请先手动进入小程序触发抓包脚本");
        return;
    }

    $.log("🚀 开始任务...");
    
    // 1. 签到
    await request("/rest/2.0/bonus/reward/task/status", "GET", "查询签到");
    
    // 2. 获取任务列表并寻找视频任务
    let list = await request("/rest/2.0/bonus/reward/task/list", "GET", "获取任务列表");
    if (list && list.payload) {
        for (let task of list.payload) {
            // 状态 0 通常代表未完成，1 代表已完成
            if (task.title.includes("视频") && task.status === 0) {
                $.log(`发现未完成任务: ${task.title}，准备执行...`);
                // 模拟看视频完成，注意：这里根据抓包推测路径
                await request("/rest/2.0/bonus/reward/task/complete", "POST", "完成视频任务", { task_id: task.id });
                await $.wait(2000); // 稍微等一下
            }
        }
    }

    // 3. 查询积分余额
    await request("/rest/2.0/reward/balance", "GET", "查询余额");
}

async function request(path, method, name, body = null) {
    const opts = {
        url: `https://user-api.4pyun.com${path}`,
        method: method,
        headers: {
            'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.69'
        }
    };
    if (body) opts.body = JSON.stringify(body);

    return new Promise(resolve => {
        $.send(opts, (err, resp, data) => {
            try {
                const res = JSON.parse(data);
                $.log(`[${name}] ${res.message || '成功'}`);
                resolve(res);
            } catch (e) { resolve(null) }
        });
    });
}

main().finally(() => $.done());

// --- 环境兼容层 ---
function Env(n){this.getdata=(k)=>{if(typeof $prefs!="undefined")return $prefs.valueForKey(k);if(typeof $persistentStore!="undefined")return $persistentStore.read(k)};this.wait=(ms)=>new Promise(r=>setTimeout(r,ms));this.log=(...m)=>console.log(`[${n}]`,...m);this.send=(o,c)=>{if(typeof require!="undefined"){require('request')[o.method.toLowerCase()](o,c)}else{$task.fetch(o).then(r=>c(null,r,r.body),e=>c(e))}};this.done=()=>{$done({})}}
