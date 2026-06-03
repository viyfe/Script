/**
 * 喵小乐 (MiaoXiaoLe) VIP解锁 & 去广告
 * 适配 Quantumult X / Loon / Surge
 */

let url = $request.url;
let body = $response.body;

if (!body) {
    $done({});
}

try {
    let obj = JSON.parse(body);

    // 1. 解锁 VIP 权限 (拦截 checkVipV2)
    if (url.includes("/book/user/checkVipV2")) {
        obj.success = true;
        obj.message = "成功";
        obj.code = 200;
        // 严格对齐抓包发现的会员对象模型，使用 String 类型避免 Dart 解析崩溃
        obj.result = {
            "id": "1592946516263490903",
            "appleProductId": "1596826350821229103",
            "productId": "1596826350821229103",
            "type": "3",
            "price": "128",
            "desc": "12个月",
            "expireTime": 4070908800000, // 给一个超长的未来时间戳
            "endTime": 4070908800000,
            "isVip": true
        };
    }

    // 2. 清除云端下发的广告位 ID (拦截 getAdsSettingsV2)
    if (url.includes("/book/config/getAdsSettingsV2")) {
        if (obj.result) {
            // 清空所有包含 Id 的广告单元，实现物理防加载
            for (let key in obj.result) {
                if (key.includes("Id")) {
                    obj.result[key] = "";
                }
            }
            // 延长激励视频等免广告时间
            if (obj.result.readRewardTime) obj.result.readRewardTime = 999999;
            if (obj.result.listenRewardTime) obj.result.listenRewardTime = 999999;
        }
    }

    // 3. 搜索入口与其他权限 (拦截 checkSearchEntrance 等)
    if (url.includes("/book/user/checkSearchEntrance") || url.includes("/book/config/getBookSettingsV2")) {
        if (obj.result === false) obj.result = true;
        if (obj.result && obj.result.canSearchBooks !== undefined) {
            obj.result.canSearchBooks = true;
            obj.result.canListenBooks = true;
        }
    }

    $done({ body: JSON.stringify(obj) });

} catch (e) {
    console.log("喵小乐脚本解析出错: " + e);
    $done({});
}
