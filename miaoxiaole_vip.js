/**
 * 喵小乐 (MiaoXiaoLe) VIP解锁 & 去广告脚本
 */

let url = $request.url;
let body = $response.body;

if (!body) {
    $done({});
}

try {
    let obj = JSON.parse(body);

    // 1. 解锁 VIP 权限
    if (url.includes("/book/user/checkVipV2")) {
        obj.success = true;
        obj.message = "成功";
        obj.code = 200;
        // 伪造 result，通常赋予 true 或包含过期时间的对象即可绕过本地判断
        obj.result = {
            "isVip": true,
            "expireTime": 4070908800000, // 2099年
            "vipType": 1
        };
    }

    // 2. 清除云端下发的广告位 ID
    if (url.includes("/book/config/getAdsSettingsV2")) {
        if (obj.result) {
            // 将所有包含 Id 的广告位字段清空
            for (let key in obj.result) {
                if (key.includes("Id")) {
                    obj.result[key] = "";
                }
            }
            // 顺便把激励视频等时间改为 99999
            if (obj.result.readRewardTime) obj.result.readRewardTime = 99999;
            if (obj.result.listenRewardTime) obj.result.listenRewardTime = 99999;
        }
    }

    $done({ body: JSON.stringify(obj) });

} catch (e) {
    console.log("喵小乐脚本解析出错: " + e);
    $done({});
}
