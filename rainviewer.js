/*
RainViewer Pro Unlock - 增强版
*/

let body = $response.body;
let obj = JSON.parse(body);

// 核心解锁逻辑：强制赋予会员属性
obj.is_premium = true;
obj.premium = true;
obj.ads_disabled = true;
obj.subscription_type = "premium";
obj.premium_until = 4070908800; // 2099年
obj.features = ["all", "no_ads", "high_res", "fast_update"];

// 针对部分版本可能存在的嵌套结构
if (obj.data) {
    obj.data.is_premium = true;
    obj.data.premium_until = 4070908800;
}

$done({body: JSON.stringify(obj)});
