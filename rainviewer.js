/*************************************
项目名称：RainViewer 2026 强制 Pro 解锁 (进阶版)
脚本说明：基于抓包数据 [cite: 1, 3, 23] 深度适配，强制注入 Pro 权限
*************************************/

let obj = JSON.parse($response.body || '{}');
const url = $request.url;

// 1. 劫持 RevenueCat (解锁功能组)
if (url.indexOf("/v1/subscribers") != -1) {
  const proInfo = {
    "expires_date": "2099-12-31T23:59:59Z",
    "purchase_date": "2023-01-01T00:00:00Z",
    "period_type": "active",
    "store": "app_store",
    "is_sandbox": false
  };

  // 必须同时注入 premium 和 pro 权限组
  obj.subscriber.entitlements = {
    "premium": {
      "expires_date": "2099-12-31T23:59:59Z",
      "product_identifier": "PREMIUM_FEATURES_3_1YEAR",
      "purchase_date": "2023-01-01T00:00:00Z"
    },
    "pro": {
      "expires_date": "2099-12-31T23:59:59Z",
      "product_identifier": "PRO_1YEAR",
      "purchase_date": "2023-01-01T00:00:00Z"
    }
  };

  obj.subscriber.subscriptions = {
    "PREMIUM_FEATURES_3_1YEAR": proInfo,
    "PRO_1YEAR": proInfo
  };
}

// 2. 劫持 RainViewer 自己的 actual 接口 
if (url.indexOf("/mobile/purchases/ios/actual") != -1) {
  if (obj.data) {
    obj.data.purchased = true;
    obj.data.is_expired = false;
    obj.data.is_cancelled = false;
    obj.data.expiration = 4070908800;
    obj.data.type = 1; // 强制提升至高级账户类型
    obj.data.plan_id = "PRO_1YEAR";
    obj.data.products = ["PRO_1YEAR", "PREMIUM_FEATURES_3_1YEAR"];
  }
}

$done({ body: JSON.stringify(obj) });
