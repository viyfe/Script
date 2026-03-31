/**
 * RainViewer Pro 强制修复版 (2026-03-31)
 * 解决：切换 ID 后失效、无法解锁 Pro 功能
 */

let url = $request.url;
let body = $response.body;
let headers = $response.headers;

// 1. 核心：必须抹除签名，否则 App 校验 Headers 失败会直接导致 Pro 失效 
delete headers['X-Rv-Signature'];
delete headers['x-rv-signature'];
delete headers['X-Rv-Date'];

let obj = JSON.parse(body || '{}');

// 2. 劫持 RevenueCat (强制注入 Pro 权限组)
if (url.indexOf("/v1/subscribers") != -1) {
  const proInfo = {
    "expires_date": "2099-12-31T23:59:59Z",
    "purchase_date": "2023-01-01T00:00:00Z",
    "period_text": "active",
    "store": "app_store",
    "ownership_type": "PURCHASED"
  };

  // 注入所有已知的 Pro 产品 ID，确保对齐 [cite: 1, 3]
  const ids = ["PRO_1YEAR", "com.meteoviewer.pro_1year", "PREMIUM_FEATURES_3_1YEAR"];
  
  ids.forEach(id => {
    obj.subscriber.subscriptions[id] = proInfo;
  });

  // 关键：强制定义 Pro 权限组，这是解锁多日预报的核心
  obj.subscriber.entitlements = {
    "pro": {
      "expires_date": "2099-12-31T23:59:59Z",
      "product_identifier": "PRO_1YEAR",
      "purchase_date": "2023-01-01T00:00:00Z"
    },
    "premium": {
      "expires_date": "2099-12-31T23:59:59Z",
      "product_identifier": "PREMIUM_FEATURES_3_1YEAR",
      "purchase_date": "2023-01-01T00:00:00Z"
    }
  };
}

// 3. 劫持原生接口 (修正你抓包到的 actual 过期状态) [cite: 3, 23]
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