/**
 * RainViewer Pro Ultimate - 2026
 * 逻辑：抹除 X-Rv-Signature + 强制注入最高级 Pro 权限组
 */

let url = $request.url;
let body = $response.body;
let headers = $response.headers;

// 1. 强制抹除签名，让 App 的本地校验失效 
delete headers['X-Rv-Signature'];
delete headers['x-rv-signature'];
delete headers['X-Rv-Date'];

let obj = JSON.parse(body || '{}');

// 2. 劫持 RevenueCat：注入 Pro 核心权限组 [cite: 23]
if (url.indexOf("/v1/subscribers") != -1) {
  const proInfo = { "expires_date": "2099-12-31T23:59:59Z", "purchase_date": "2023-01-01T00:00:00Z", "period_type": "active", "store": "app_store" };
  
  // 同时赋予 premium 和 pro 权限
  obj.subscriber.entitlements = {
    "premium": { "expires_date": "2099-12-31T23:59:59Z", "product_identifier": "PREMIUM_FEATURES_3_1YEAR", "purchase_date": "2023-01-01T00:00:00Z" },
    "pro": { "expires_date": "2099-12-31T23:59:59Z", "product_identifier": "PRO_1YEAR", "purchase_date": "2023-01-01T00:00:00Z" }
  };
  
  obj.subscriber.subscriptions = {
    "PREMIUM_FEATURES_3_1YEAR": proInfo,
    "PRO_1YEAR": proInfo
  };
}

// 3. 劫持原生接口：修正你抓包到的 actual 接口 
if (url.indexOf("/mobile/purchases/ios/actual") != -1) {
  if (obj.data) {
    Object.assign(obj.data, {
      "purchased": true,
      "is_expired": false,
      "is_cancelled": false,
      "expiration": 4070908800,
      "type": 2, // 尝试从 1 提升到 2，触发最高权限
      "products": ["PRO_1YEAR", "PREMIUM_FEATURES_3_1YEAR"],
      "plan_id": "PRO_1YEAR",
      "has_orders": true,
      "duration": "YEAR"
    });
  }
}

$done({ body: JSON.stringify(obj), headers: headers });
