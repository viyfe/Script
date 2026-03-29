/*************************************
项目名称：RainViewer 解锁 Pro
使用环境：Quantumult X
脚本说明：基于 2026-03-29 抓包数据分析，同步解锁原生接口与 RevenueCat
*************************************/

var obj = JSON.parse($response.body);
const url = $request.url;

// 1. 拦截 RevenueCat (大多数 2026 App 的核心验证)
if (url.indexOf("/v1/subscribers") != -1) {
  const info = {
    "expires_date": "2099-12-31T23:59:59Z",
    "purchase_date": "2023-01-01T00:00:00Z",
    "period_type": "active",
    "store": "app_store"
  };
  obj.subscriber.subscriptions["com.meteoviewer.premium_3_1year"] = info;
  obj.subscriber.entitlements["premium"] = {
    "expires_date": "2099-12-31T23:59:59Z",
    "product_identifier": "com.meteoviewer.premium_3_1year",
    "purchase_date": "2023-01-01T00:00:00Z"
  };
}

// 2. 拦截 RainViewer 自己的 actual 接口 [cite: 23]
if (url.indexOf("/mobile/purchases/ios/actual") != -1) {
  // 强制覆盖你抓包到的过期数据 
  Object.assign(obj.data, {
    "purchased": true,
    "is_expired": false,
    "is_cancelled": false,
    "expiration": 4070908800,
    "type": 1,
    "products": ["PREMIUM_FEATURES_3_1YEAR", "PRO_1YEAR"],
    "plan_id": "PRO_1YEAR",
    "has_orders": true
  });
}

$done({ body: JSON.stringify(obj) });
