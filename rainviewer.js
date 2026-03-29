/*
RainViewer Pro Unlock (RevenueCat 版)
适用接口: api.revenuecat.com
*/

let obj = JSON.parse($response.body);

const proInfo = {
  "expires_date": "2099-12-31T23:59:59Z",
  "purchase_date": "2023-01-01T00:00:00Z",
  "period_type": "active"
};

obj.subscriber.subscriptions = {
  "com.meteoviewer.premium_3_1year": proInfo,
  "com.meteoviewer.pro_1year": proInfo
};

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

$done({body: JSON.stringify(obj)});
