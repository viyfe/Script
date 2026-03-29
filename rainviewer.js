/*
RainViewer Pro Unlock - 2026 专用版
基于接口: /mobile/purchases/ios/actual
*/

let obj = JSON.parse($response.body);

if (obj.data) {
    // 基础购买状态
    obj.data.purchased = true;
    obj.data.is_expired = false;
    obj.data.is_cancelled = false;
    obj.data.is_trial = true;
    
    // 设置一个遥远的过期时间 (2099年)
    obj.data.expiration = 4070908800; 
    
    // 注入所有可能的 Pro 产品 ID
    obj.data.products = [
        "PREMIUM_FEATURES_3_1YEAR",
        "PRO_1YEAR",
        "premium_features_v2",
        "no_ads"
    ];
    
    // 其他关键字段
    obj.data.plan_id = "PRO_1YEAR";
    obj.data.has_orders = true;
}

$done({body: JSON.stringify(obj)});
