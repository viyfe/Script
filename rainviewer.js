/*************************************
项目名称：RainViewer 2026 强制 Pro 解锁
脚本功能：同步解锁所有潜在验证接口
*************************************/

var obj = JSON.parse($response.body);
const url = $request.url;

// 1. 核心验证：RevenueCat 接口 (解锁 Pro 权限组)
if (url.indexOf("/v1/subscribers") != -1) {
  const proInfo = {
    "expires_date": "2099-12-31T23:59:59Z",
    "purchase_date": "2023-01-01T00:00:00Z",
    "period_type": "active",
    "store": "app_store"
  };

  // 同时注入 premium 和 pro 权限，确保开启最高级功能
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

  obj.subscriber.subscriptions = {
    "com.meteoviewer.pro_1year": proInfo,
    "com.meteoviewer.premium_3_1year": proInfo
  };
}

// 2. 原生验证：修正你抓包到的实际过期数据 
if (url.indexOf("/mobile/purchases/ios/actual") != -1) {
  if (obj.data) {
    Object.assign(obj.data, {
      "purchased": true,
      "is_expired": false,
      "is_cancelled": false,
      "expiration": 4070908800,
      "type": 1, // 强制提升为 Pro 类型
      "products": ["PRO_1YEAR", "PREMIUM_FEATURES_3_1YEAR"],
      "plan_id": "PRO_1YEAR",
      "has_orders": true
    });
  }
}

$done({ body: JSON.stringify(obj) });
