/*************************************
项目名称：RainViewer 2026 强制 Pro 解锁 (全量覆盖版)
适用接口：api.revenuecat.com & api.rainviewer.com
*************************************/

var obj = JSON.parse($response.body);
const url = $request.url;

// 1. 拦截 RevenueCat (所有 Pro 功能的核心判定位)
if (url.indexOf("/v1/subscribers") != -1) {
  const proInfo = {
    "expires_date": "2099-12-31T23:59:59Z",
    "purchase_date": "2023-01-01T00:00:00Z",
    "period_type": "active",
    "store": "app_store",
    "is_sandbox": false
  };

  // 强制注入 Pro 专用的权限组
  obj.subscriber.entitlements = {
    "pro": {
      "expires_date": "2099-12-31T23:59:59Z",
      "product_identifier": "com.meteoviewer.pro_1year",
      "purchase_date": "2023-01-01T00:00:00Z"
    },
    "premium": {
      "expires_date": "2099-12-31T23:59:59Z",
      "product_identifier": "com.meteoviewer.premium_3_1year",
      "purchase_date": "2023-01-01T00:00:00Z"
    }
  };

  // 强制注入订阅列表
  obj.subscriber.subscriptions = {
    "com.meteoviewer.pro_1year": proInfo,
    "com.meteoviewer.premium_3_1year": proInfo
  };
}

// 2. 拦截 RainViewer 自己的 actual 接口 (修正你抓包到的过期数据)
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

$done({ body: JSON.stringify(obj) });
