let obj = JSON.parse($response.body);

obj.result = true;

let now = new Date();
now.setHours(20, 0, 0, 0); // 设为当天 20:00:00
let timestampMs = now.getTime();

// 更新 timestamp
obj.timestamp = timestampMs;

$done({ body: JSON.stringify(obj) });
