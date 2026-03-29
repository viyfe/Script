/*
RainViewer Pro Unlock - 2026 最终方案
支持接口: /mobile/purchases/ios/actual 以及 /v2/profile
*/

let body = $response.body;
if (!body) $done({});

let obj = JSON.parse(body);

// 方案 A: 针对你抓到的 /actual 接口
if ($request.url.indexOf("/actual") !== -1) {
    obj.data = {
        "id": "2000000476197081",
        "purchased": true,
        "type": 1, // 提升类型等级
        "products": ["PRO_1YEAR", "premium_features_v2", "PREMIUM_FEATURES_3_1YEAR"],
        "expiration": 4070908800,
        "has_orders": true,
        "is_trial": false,
        "is_expired": false,
        "is_grace": false,
        "is_cancelled": false,
        "is_test": false,
        "duration": "YEAR",
        "plan_id": "PRO_1YEAR"
    };
}

// 方案 B: 针对备用的 /v2/profile 接口
if ($request.url.indexOf("/v2/profile") !== -1) {
    obj.is_premium = true;
    obj.premium_until = 4070908800;
    obj.ads_disabled = true;
    obj.features = ["all", "high_res", "fast_update"];
}

$done({ body: JSON.stringify(obj) });
