/*************************************
项目名称：RainViewer 2026 强制 Pro 解锁
脚本功能：暴力覆盖所有 Premium/Pro 判定位
*************************************/

var obj = JSON.parse($response.body);
const url = $request.url;

// 统一的远期时间
const expDate = "2099-12-31T23:59:59Z";
const expTS = 4070908800;

// 1. 拦截 RevenueCat (所有 2026 订阅的核心)
if (url.indexOf("/v1/subscribers") != -1) {
  const proInfo = {
    "expires_date": expDate,
    "purchase_date": "2023-01-01T00:00:00Z",
    "period_type": "active",
    "store": "app_store"
  };

  // 强制注入所有可能的 Pro 产品标识符
  const proProducts = ["com.meteoviewer.pro_1year", "com.meteoviewer.premium_3_1year", "pro_features_v1", "PRO_1YEAR"];
  
  proProducts.forEach(p => {
    obj.subscriber.subscriptions[p] = proInfo;
  });

  // 关键：同时赋予 premium 和 pro 两个最高等级权限
  obj.subscriber.entitlements = {
    "premium": {
      "expires_date": expDate,
      "product_identifier": "com.meteoviewer.premium_3_1year",
      "purchase_date": "2023-01-01T00:00:00Z"
    },
    "pro": {
      "expires_date": expDate,
      "product_identifier": "com.meteoviewer.pro_1year",
      "purchase_date": "2023-01-01T00:00:00Z"
    }
  };
}

// 2. 拦截 RainViewer 自己的 actual 接口 
if (url.indexOf("/mobile/purchases/ios/actual") != -1) {
  if (obj.data) {
    Object.assign(obj.data, {
      "purchased": true,
      "is_expired": false,
      "is_cancelled": false,
      "expiration": expTS,
      "type": 1, // 提升为最高账户类型
      "products": ["PRO_1YEAR", "PREMIUM_FEATURES_3_1YEAR"], // 强制 PRO 排在第一位 [cite: 1]
      "plan_id": "PRO_1YEAR", 
      "has_orders": true,
      "is_test": false,
      "is_trial": false
    });
  }
}

// 3. 兜底逻辑：如果存在 profile 接口也一并修改
if (url.indexOf("/v2/profile") != -1) {
  obj.is_premium = true;
  obj.is_pro = true; // 额外增加 Pro 标记位
  obj.premium_until = expTS;
  obj.features = ["all", "high_res", "fast_update", "no_ads"];
}

$done({ body: JSON.stringify(obj) });
