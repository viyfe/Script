#!name=酷狗音乐
#!desc=解锁会员及歌曲

^https?:\/\/.*\.kugou\.com\/(v1|v2|v3|v5|mobile|media\.store\/v1|adp\/ad\/v1|ads\.gateway\/v2|fxsing\/vip\/user|sing7\/homepage\/json\/v3\/vip)\/(login_by_token|get_my_info|get_login_extend_info|vipinfoV2|get_res_privilege\/lite|mine_top_banner|task_center_entrance|info|tip).* url script-response-body https://raw.githubusercontent.com/chmg2025/js/refs/heads/main/kugouvip.js
^https?:\/\/.*\.kugou\.com\/(v5|tracker\/v5)\/url url script-response-body https://raw.githubusercontent.com/chmg2025/js/refs/heads/main/kugouvip.js

hostname = *.kugou.com
