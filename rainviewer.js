/*
RainViewer Pro/Premium 2026 终极解锁 (双接口同步)
*/

let url = $request.url;
let body = $response.body;
if (!body) $done({});

let obj = JSON.parse(body);

// --- 逻辑 A: 针对 RevenueCat 验证 (核心) ---
if (url.includes("revenuecat.com/v1/subscribers")) {
    const proInfo = {
        "expires_date": "2099-12-31T23:59:59Z",
        "purchase_date": "2023-01-01T00:00:00Z",
        "period_type": "active",
        "store": "app_store"
    };
    
    obj.subscriber.subscriptions = {
        "com.meteoviewer.premium_3_1year": proInfo,
        "com.meteoviewer.pro_1year": proInfo
    };
    
    obj.subscriber.entitlements = {
        "premium": {
            "expires_date": "2099-12-31T23:59:59Z",
            "product_identifier": "com.meteoviewer.premium_3_1year",
            "purchase_date": "2023-01-01T00:00:00Z"
        },
        "pro": {
            "expires_date": "2099-12-31T23:59:59Z",
            "product_identifier": "com.meteoviewer.pro_1year",
            "purchase_date": "2023-01-01T00:00:00Z"
        }
    };
}

// --- 逻辑 B: 针对 RainViewer 原生接口 (对应你抓包到的数据) ---
if (url.includes("/mobile/purchases/ios/actual")) {
    obj.data = {
        "id": "2000000476197081",
        "purchased": true,
        "type": 1,
        "products": ["PREMIUM_FEATURES_3_1YEAR", "PRO_1YEAR"],
        "expiration": 4070908800,
        "has_orders": true,
        "is_trial": false,
        "is_expired": false,
        "is_cancelled": false,
        "is_test": false,
        "duration": "YEAR",
        "plan_id": "PRO_1YEAR"
    };
}

$done({ body: JSON.stringify(obj) });
