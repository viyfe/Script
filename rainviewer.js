/*
RainViewer Unlock Pro
*/

let obj = JSON.parse($request.body);
// 模拟 Pro 账户返回的数据
obj = {
  "is_premium": true,
  "premium_until": 4070908800, // 2099年
  "ads_disabled": true,
  "features": ["all"]
};

$done({body: JSON.stringify(obj)});
