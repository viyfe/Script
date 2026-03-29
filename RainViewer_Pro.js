/**
 * RainViewer Pro Unlock - 2026 Final
 * 逻辑：修改 Body + 抹除 Header 签名 [cite: 1, 18, 23]
 */

let url = $request.url;
let body = $response.body;
let headers = $response.headers;

// 1. 抹除签名校验头，强制绕过 HMAC 验证 [cite: 18]
delete headers['X-Rv-Signature'];
delete headers['x-rv-signature'];
delete headers['X-Rv-Date'];
delete headers['x-rv-date'];

let obj = JSON.parse(body || '{}');

// 2. 劫持 RevenueCat (解锁功能组) 
if (url.indexOf("/v1/subscribers") != -1) {
  const proInfo = {
    "expires_date": "2099-12-31T23:59:59Z",
    "purchase_date": "2023-01-01T00:00:00Z",
    "period_type": "active",
    "store": "app_store"
  };
  // 注入 Pro 和 Premium 双重权限 [cite: 3]
  obj.subscriber.subscriptions = {
    "com.meteoviewer.pro_1year": proInfo,
    "com.meteoviewer.premium_3_1year": proInfo
  };
  obj.subscriber.entitlements = {
    "pro": { "expires_date": "2099-12-31T23:59:59Z", "product_identifier": "com.meteoviewer.pro_1year", "purchase_date": "2023-01-01T00:00:00Z" },
    "premium": { "expires_date": "2099-12-31T23:59:59Z", "product_identifier": "com.meteoviewer.premium_3_1year", "purchase_date": "2023-01-01T00:00:00Z" }
  };
}

// 3. 劫持原生接口 (覆盖过期状态) [cite: 1, 3]
if (url.indexOf("/mobile/purchases/ios/actual") != -1) {
  if (obj.data) {
    Object.assign(obj.data, {
      "purchased": true,
      "is_expired": false,
      "is_cancelled": false,
      "expiration": 4070908800,
      "type": 1, 
      "products": ["PRO_1YEAR", "PREMIUM_FEATURES_3_1YEAR"],
      "plan_id": "PRO_1YEAR",
      "has_orders": true
    });
  }
}

$done({ body: JSON.stringify(obj), headers: headers });
