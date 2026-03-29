/*************************************
项目名称：RainViewer 强制解锁 Pro 高级用户
使用环境：Quantumult X
更新日期：2026-03-29 (针对 Pro 层级增强)
*************************************/

var obj = JSON.parse($response.body);
const url = $request.url;

// 1. 拦截 RevenueCat (注入 Pro 权限)
if (url.indexOf("/v1/subscribers") != -1) {
  const proInfo = {
    "expires_date": "2099-12-31T23:59:59Z",
    "purchase_date": "2023-01-01T00:00:00Z",
    "period_type": "active",
    "store": "app_store",
    "is_sandbox": false
  };

  // 注入所有已知的 Pro 产品 ID
  const products = ["com.meteoviewer.pro_1year", "com.meteoviewer.premium_3_1year", "pro_features_v1"];
  
  products.forEach(p => {
    obj.subscriber.subscriptions[p] = proInfo;
  });

  // 关键：同时注入 premium 和 pro 两个权利组
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

// 2. 拦截 RainViewer 自己的 actual 接口 (修正 Pro 字段)
if (url.indexOf("/mobile/purchases/ios/actual") != -1) {
  if (obj.data) {
    Object.assign(obj.data, {
      "purchased": true,
      "is_expired": false,
      "is_cancelled": false,
      "expiration": 4070908800,
      "type": 1, // 关键：1 通常代表高级 Pro 类型
      "products": ["PRO_1YEAR", "PREMIUM_FEATURES_3_1YEAR"], // 确保 PRO 在首位
      "plan_id": "PRO_1YEAR", // 强制指定为 Pro 方案
      "has_orders": true,
      "is_test": false
    });
  }
}

$done({ body: JSON.stringify(obj) });
