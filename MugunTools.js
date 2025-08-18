/*
 * MugunTools VIP Unlock Script
 *
 * This script modifies API responses to unlock VIP features.
 * Supported arguments: 'doc', 'user', 'login'
 */

(function() {
    // 检查请求是否存在
    if (typeof $request === 'undefined' || typeof $response === 'undefined') {
        $done({});
        return;
    }

    let body = $response.body;
    const argument = $argument;

    // 根据传入的参数执行不同的替换逻辑
    switch (argument) {
        case 'doc':
            // 规则1: muguntools.com/api/document_v2
            // "is_vip":false -> "is_vip":true
            try {
                let obj = JSON.parse(body);
                if (obj.data && obj.data.list) {
                    obj.data.list.forEach(item => {
                        if (item.is_vip === false) {
                            item.is_vip = true;
                        }
                    });
                }
                body = JSON.stringify(obj);
            } catch (e) {
                console.log("MugunTools Script Error (doc): " + e.toString());
            }
            break;

        case 'user':
            // 规则2: muguntools.com/api/user/index
            // "is_vip":0,"vip_start":0,"vip_end":0 -> "is_vip":1,"vip_start":0,"vip_end":999999999
            try {
                let obj = JSON.parse(body);
                if (obj.data && obj.data.is_vip === 0) {
                    obj.data.is_vip = 1;
                    obj.data.vip_end = 999999999;
                    obj.data.vip_end_text = "永久有效"; // 可选，增加一个友好的文本提示
                }
                body = JSON.stringify(obj);
            } catch (e) {
                console.log("MugunTools Script Error (user): " + e.toString());
            }
            break;

        case 'login':
            // 规则3: muguntools.com/api/login/thirdLogin
            // "is_vip":false,"is_trial_vip":false -> "is_vip":true,"is_trial_vip":false
            try {
                let obj = JSON.parse(body);
                if (obj.data && obj.data.is_vip === false) {
                    obj.data.is_vip = true;
                }
                body = JSON.stringify(obj);
            } catch (e) {
                console.log("MugunTools Script Error (login): " + e.toString());
            }
            break;

        default:
            console.log("MugunTools Script: No valid argument provided.");
            break;
    }

    $done({ body });
})();