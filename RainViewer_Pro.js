/**
 * RainViewer Pro - 修正版
 * 修复了对 7.18.1 版本的支持，同步拦截 Settings 接口去除下发广告
 */
let url = $request.url;
let body = $response.body;

if (!body) {
    $done({});
}

let obj;
try {
    obj = JSON.parse(body);
} catch (e) {
    $done({});
}

// 1. 修改购买验证接口 (欺骗 App 你是 Pro)
if (url.includes("/mobile/purchases/ios/actual")) {
    if (obj.data) {
        obj.data.purchased = true;
        obj.data.is_expired = false;
        obj.data.is_cancelled = false;
        obj.data.expiration = 4070908800; // 强制续期到 2099 年
        obj.data.type = 2; // 2 代表 Pro 最高级
        obj.data.products = ["PRO_1YEAR"];
        obj.data.plan_id = "PRO_1YEAR";
        obj.data.has_orders = true;
        obj.data.duration = "YEAR";
    }
}

// 2. 核心：修改应用配置接口 (去除云端下发的广告模块和限制)
if (url.includes("/mobile/settings")) {
    if (obj.data && obj.data.ads) {
        // 遍历并关闭所有广告单元
        for (let adType in obj.data.ads) {
            if (obj.data.ads[adType].enabled !== undefined) {
                obj.data.ads[adType].enabled = false;
            }
        }
    }
}

$done({ body: JSON.stringify(obj) });
