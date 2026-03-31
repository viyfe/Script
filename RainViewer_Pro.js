/**
 * RainViewer Universal Pro Unlock
 * 适配切换 Apple ID 后的全自动解锁
 */

let url = $request.url;
let obj = JSON.parse($response.body || '{}');
let headers = $response.headers;

// 1. 抹除签名，防止 App 因为切换 ID 触发更严苛的校验 [cite: 18]
delete headers['X-Rv-Signature'];
delete headers['x-rv-signature'];

const proInfo = {
  "expires_date": "2099-12-31T23:59:59Z",
  "purchase_date": "2023-01-01T00:00:00Z",
  "period_type": "active",
  "store": "app_store",
  "ownership_type": "PURCHASED"
};

// 2. 针对 RevenueCat：不看 ID，只给权限 [cite: 2, 3]
if (url.indexOf("/v1/subscribers") != -1) {
  // 即使切换了 ID，我们也强制返回相同的 Pro 权限组 [cite: 22]
  obj.subscriber.entitlements = {
    "pro": { "expires_date": "2099-12-31T23:59:59Z", "product_identifier": "PRO_1YEAR", "purchase_date": "2023-01-01T00:00:00Z" },
    "premium": { "expires_date": "2099-12-31T23:59:59Z", "product_identifier": "PREMIUM_FEATURES_3_1YEAR", "purchase_date": "2023-01-01T00:00:00Z" }
  };
  obj.subscriber.subscriptions = {
    "PRO_1YEAR": proInfo,
    "PREMIUM_FEATURES_3_1YEAR": proInfo
  };
}

// 3. 针对原生接口：修正数据状态 [cite: 1, 23]
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
