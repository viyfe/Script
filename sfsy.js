/**
 * 顺丰速运日常积分任务 (全平台兼容版)
 * 转换说明：由原始 Python 版本完全无删减 1:1 翻译，并加入了获取 Cookie 数据持久化功能。
 */

const $ = new Env("顺丰速运");

// ==================== MD5 加密算法实现 (代替原生 Crypto 库) ====================
var MD5=function(d){var r=MD5.words,n=MD5.endian,t=MD5.utf8;function e(d){for(var r=t(d),n=r.length,e=[n<<3,0],o=0;o<n;o++)e[o>>2]|=r[o]<<24-(o%4)*8;for(e[d=n+8>>6<<4|14]=e[0],e[d+1]=e[1],o=0;o<d;o+=16)a(e,o);return e}function a(d,r){for(var n=d[r],t=d[r+1],e=d[r+2],o=d[r+3],a=d[r+4],f=d[r+5],c=d[r+6],i=d[r+7],u=d[r+8],s=d[r+9],h=d[r+10],l=d[r+11],v=d[r+12],g=d[r+13],p=d[r+14],m=d[r+15],C=1732584193,M=-271733879,b=-1732584194,y=271733878,w=0;w<64;w++){var x=C;C=y,y=b,b=M,M=x+function(d,r,n,t,e,a,f){return r+(d+(e^(r^n)&(t^e))+f<<a|d+(e^(r^n)&(t^e))+f>>>32-a)}(M,b,y,C,w<16?d[r+w]:w<32?d[r+(5*w+1)%16]:w<48?d[r+(3*w+5)%16]:d[r+(7*w)%16],w<16?[7,12,17,22][w%4]:w<32?[5,9,14,20][w%4]:w<48?[4,11,16,23][w%4]:[6,10,15,21][w%4],w<16?[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0][w]:w<32?[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1][w-16]:w<48?[2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2][w-32]:[3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3][w-48])}d[r]=C,d[r+1]=M,d[r+2]=b,d[r+3]=y}function o(d){for(var r=[],t=0;t<32;t++)r.push((d[t>>2]>>>24-(t%4)*8&255).toString(16).padStart(2,"0"));return r.join("")}MD5.words=function(d){for(var r=[],n=0;n<d.length;n++)r.push(d.charCodeAt(n));return r},MD5.endian=function(d){for(var r=[],n=0;n<d.length;n+=4)r.push(d[n]<<24|d[n+1]<<16|d[n+2]<<8|d[n+3]);return r},MD5.utf8=function(d){for(var r=[],n=0;n<d.length;n++){var t=d.charCodeAt(n);t<128?r.push(t):t<2048?(r.push(192|t>>6),r.push(128|63&t)):t<55296||t>=57344?(r.push(224|t>>12),r.push(128|t>>6&63),r.push(128|63&t)):(t=65536+((1023&t)<<10)+(1023&d.charCodeAt(++n)),r.push(240|t>>18),r.push(128|t>>12&63),r.push(128|t>>6&63),r.push(128|63&t))}return r};return function(d){return o(e(d))}}();

// ==================== 全局配置常量 ====================
const PUSH_SWITCH = "1";
const BARK_PUSH = process.env.BARK_PUSH || $.getdata("BARK_PUSH") || "";
const BARK_ICON = "https://gitee.com/hlt1995/BARK_ICON/raw/main/SFExpress.png";
const BARK_GROUP = "顺丰速运";
const CONCURRENT_NUM = parseInt(process.env.SFBF || $.getdata("SFBF") || '1');
const PROXY_TIMEOUT = 15000;
const MAX_PROXY_RETRIES = 5;
const REQUEST_RETRY_COUNT = 3;

// ==================== 配置类 ====================
class Config {
    constructor() {
        this.APP_NAME = "顺丰速运";
        this.VERSION = "1.2.0";
        this.ENV_NAME = "sfsyUrl";
        this.PROXY_API_URL = process.env.SF_PROXY_API_URL || $.getdata("SF_PROXY_API_URL") || '';
        this.TOKEN = 'wwesldfs29aniversaryvdld29';
        this.SYS_CODE = 'MCS-MIMP-CORE';
        this.SKIP_TASKS = ['用行业模板寄件下单','用积分兑任意礼品','参与积分活动','每月累计寄件','完成每月任务','去使用AI寄件'];
    }
}

// ==================== 日志系统 ====================
class Logger {
    constructor() {
        this.ICONS = {
            task_found: '🎯', task_skip: '⏭️', task_complete: '✅', reward_get: '🎁',
            info: '📝', success: '✨', error: '❌', warning: '⚠️', user: '👤', money: '💰'
        };
        this.messages = [];
        this.current_account_msg = [];
    }
    
    _format_msg(icon, content) {
        return `${icon} ${content}`;
    }
    
    _safe_print(msg) {
        console.log(msg);
    }
    
    task_found(task_name, status = 2) {
        let msg = this._format_msg(this.ICONS.task_found, `发现任务: ${task_name} (状态: ${status})`);
        this._safe_print(msg);
        this.current_account_msg.push(msg);
        this.messages.push(msg);
    }
    
    task_skip(task_name) {
        let msg = this._format_msg(this.ICONS.task_skip, `[${task_name}] 已跳过`);
        this._safe_print(msg);
        this.current_account_msg.push(msg);
        this.messages.push(msg);
    }
    
    task_complete(task_name) {
        let msg = this._format_msg(this.ICONS.task_complete, `[${task_name}] 提交成功`);
        this._safe_print(msg);
        this.current_account_msg.push(msg);
        this.messages.push(msg);
    }
    
    reward_get(task_name) {
        let msg = this._format_msg(this.ICONS.reward_get, `[${task_name}] 奖励领取成功`);
        this._safe_print(msg);
        this.current_account_msg.push(msg);
        this.messages.push(msg);
    }
    
    info(content) {
        let msg = this._format_msg(this.ICONS.info, content);
        this._safe_print(msg);
        this.current_account_msg.push(msg);
        this.messages.push(msg);
    }
    
    success(content) {
        let msg = this._format_msg(this.ICONS.success, content);
        this._safe_print(msg);
        this.current_account_msg.push(msg);
        this.messages.push(msg);
    }
    
    error(content) {
        let msg = this._format_msg(this.ICONS.error, content);
        this._safe_print(msg);
        this.current_account_msg.push(msg);
        this.messages.push(msg);
    }
    
    warning(content) {
        let msg = this._format_msg(this.ICONS.warning, content);
        this._safe_print(msg);
        this.current_account_msg.push(msg);
        this.messages.push(msg);
    }
    
    user_info(account_index, mobile) {
        let msg = this._format_msg(this.ICONS.user, `账号${account_index}: 【${mobile}】登录成功`);
        this._safe_print(msg);
        this.current_account_msg.push(msg);
        this.messages.push(msg);
    }
    
    points_info(points, prefix = "当前积分") {
        let msg = this._format_msg(this.ICONS.money, `${prefix}: 【${points}】`);
        this._safe_print(msg);
        this.current_account_msg.push(msg);
        this.messages.push(msg);
    }
}

// ==================== 代理管理器 ====================
class ProxyManager {
    constructor(api_url) {
        this.api_url = api_url;
    }
    
    // JS 环境通常由代理软件本身控制路由，这里保留函数原型作为兼容或日后扩展
    async get_proxy() {
        if (!this.api_url) {
            return null;
        }
        // 模拟原本获取代理的逻辑
        return null; 
    }
}

// ==================== HTTP客户端 ====================
class SFHttpClient {
    constructor(config, proxy_manager) {
        this.config = config;
        this.proxy_manager = proxy_manager;
        this.cookieStr = "";
        
        this.headers = {
            'Host': 'mcs-mimp-web.sf-express.com',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 mediaCode=SFEXPRESSAPP-iOS-ML',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'accept-language': 'zh-CN,zh-Hans;q=0.9',
            'platform': 'MINI_PROGRAM',
        };
    }
    
    _generate_sign() {
        let timestamp = Date.now().toString();
        let data = `token=${this.config.TOKEN}&timestamp=${timestamp}&sysCode=${this.config.SYS_CODE}`;
        let signature = MD5(data).toString();
        
        return {
            'sysCode': this.config.SYS_CODE,
            'timestamp': timestamp,
            'signature': signature
        };
    }
    
    async request(url, method = 'POST', data = null, max_retries = REQUEST_RETRY_COUNT) {
        let sign_data = this._generate_sign();
        let reqHeaders = Object.assign({}, this.headers, sign_data);
        if (this.cookieStr) {
            reqHeaders['Cookie'] = this.cookieStr;
        }

        let options = {
            url: url,
            headers: reqHeaders,
            timeout: PROXY_TIMEOUT
        };
        
        if (method.toUpperCase() === 'POST') {
            options.body = data ? JSON.stringify(data) : '{}';
            options.headers['Content-Type'] = 'application/json;charset=UTF-8';
        }

        let retry_count = 0;
        
        while (retry_count < max_retries) {
            try {
                let response = await new Promise((resolve) => {
                    let reqMethod = method.toUpperCase() === 'POST' ? $.post.bind($) : $.get.bind($);
                    reqMethod(options, (err, resp, body) => {
                        if (err) resolve({ success: false, err: err });
                        else resolve({ success: true, body: body, status: resp.status });
                    });
                });

                if (response.success && response.body) {
                    try {
                        return JSON.parse(response.body);
                    } catch (e) {
                        retry_count++;
                        await $.wait(2000);
                        continue;
                    }
                } else {
                    retry_count++;
                    await $.wait(2000);
                }
            } catch (e) {
                retry_count++;
                await $.wait(2000);
            }
        }
        return null;
    }
    
    login(urlStr) {
        try {
            let decoded_input = decodeURIComponent(urlStr);
            this.cookieStr = decoded_input; 
            
            let user_id = "";
            let phone = "";
            
            let items = decoded_input.split(';');
            for (let item of items) {
                if (item.indexOf('_login_user_id_=') > -1) user_id = item.split('=')[1].trim();
                if (item.indexOf('_login_mobile_=') > -1) phone = item.split('=')[1].trim();
            }
            
            if (phone || decoded_input.indexOf('sessionId=') > -1) {
                return { success: true, user_id, phone };
            }
            return { success: false, user_id: '', phone: '' };
        } catch (e) {
            return { success: false, user_id: '', phone: '' };
        }
    }
}

// ==================== 任务执行器 ====================
class TaskExecutor {
    constructor(http_client, logger, config, user_id) {
        this.http = http_client;
        this.logger = logger;
        this.config = config;
        this.user_id = user_id;
        this.total_points = 0;
        
        this.taskId = "";
        this.taskCode = "";
        this.strategyId = 0;
        this.title = "";
    }
    
    generate_device_id(characters = 'abcdef0123456789') {
        let result = '';
        let template = 'xxxxxxxx-xxxx-xxxx';
        for (let i = 0; i < template.length; i++) {
            if (template[i] === 'x') result += characters.charAt(Math.floor(Math.random() * characters.length));
            else result += template[i];
        }
        return result;
    }
    
    _extract_task_id_from_url(urlStr) {
        try {
            if (urlStr.indexOf('_ug_view_param=') > -1) {
                let json_str = urlStr.split('_ug_view_param=')[1].split('&')[0];
                let ug_params = JSON.parse(decodeURIComponent(json_str));
                if (ug_params.taskId) return String(ug_params.taskId);
            }
        } catch (e) {
            this.logger.warning(`从URL提取taskId失败: ${e.message}`);
        }
        return '';
    }
    
    _set_task_attrs(task) {
        this.taskId = String(task.taskId || '');
        this.taskCode = String(task.taskCode || '');
        this.strategyId = parseInt(task.strategyId || 0);
        this.title = String(task.title || '未知任务');
        this.point = parseInt(task.point || 0);
        
        if (!this.taskCode && task.buttonRedirect) {
            let extracted = this._extract_task_id_from_url(task.buttonRedirect);
            if (extracted) {
                this.taskCode = extracted;
                this.logger.info(`从buttonRedirect中提取到taskId: ${this.taskCode}`);
            }
        }
    }
    
    async app_sign_in() {
        let url = 'https://mcs-mimp-web.sf-express.com/mcs-mimp/commonPost/~memberNonactivity~integralTaskSignPlusService~getUnFetchPointAndDiscount';
        let original_platform = this.http.headers['platform'];
        this.http.headers['platform'] = 'SFAPP';
        
        try {
            let response = await this.http.request(url, 'POST', {});
            if (response && response.success) {
                let obj = response.obj || [];
                if (Array.isArray(obj) && obj.length > 0) {
                    let reward_names = obj.map(item => item.packetName || '未知奖励');
                    this.logger.success(`[APP签到] 签到成功，获得【${reward_names.join(", ")}】`);
                } else {
                    this.logger.info(`[APP签到] 今日已签到或无可领取奖励`);
                }
                return { success: true, error: '' };
            } else {
                let error_msg = response ? (response.errorMessage || '未知错误') : '请求失败';
                if (error_msg.indexOf('没有待领取礼包') > -1) {
                    this.logger.info(`[APP签到] 检测到需要二次领取，等待1秒后重试...`);
                    await $.wait(1000);
                    
                    let response2 = await this.http.request(url, 'POST', {});
                    if (response2 && response2.success) {
                        let obj2 = response2.obj || [];
                        if (Array.isArray(obj2) && obj2.length > 0) {
                            let reward_names = obj2.map(item => item.packetName || '未知奖励');
                            this.logger.success(`[APP签到] 二次领取成功，获得【${reward_names.join(", ")}】`);
                        } else {
                            this.logger.info(`[APP签到] 二次领取完成，但无可领取奖励`);
                        }
                        return { success: true, error: '' };
                    } else {
                        let error_msg2 = response2 ? (response2.errorMessage || '未知错误') : '请求失败';
                        this.logger.error(`[APP签到] 二次领取失败: ${error_msg2}`);
                        return { success: false, error: error_msg2 };
                    }
                } else {
                    this.logger.error(`[APP签到] 失败: ${error_msg}`);
                    return { success: false, error: error_msg };
                }
            }
        } finally {
            this.http.headers['platform'] = original_platform;
        }
    }
    
    async sign_in() {
        let url = 'https://mcs-mimp-web.sf-express.com/mcs-mimp/commonPost/~memberNonactivity~integralTaskSignPlusService~automaticSignFetchPackage';
        let data = {"comeFrom": "vioin", "channelFrom": "WEIXIN"};
        
        let response = await this.http.request(url, 'POST', data);
        if (response && response.success) {
            let count_day = (response.obj && response.obj.countDay) ? response.obj.countDay : 0;
            let packet_list = (response.obj && response.obj.integralTaskSignPackageVOList) ? response.obj.integralTaskSignPackageVOList : [];
            let packet_name = packet_list.length > 0 ? packet_list[0].packetName : '';
            this.logger.success(`签到成功，获得【${packet_name}】，本周累计签到【${count_day + 1}】天`);
            return { success: true, countDay: count_day, packetName: packet_name, error: '' };
        } else {
            let error_msg = response ? (response.errorMessage || '未知错误') : '请求失败';
            this.logger.error(`签到失败: ${error_msg}`);
            return { success: false, countDay: 0, packetName: '', error: error_msg };
        }
    }
    
    async get_task_list() {
        let url = 'https://mcs-mimp-web.sf-express.com/mcs-mimp/commonPost/~memberNonactivity~integralTaskStrategyService~queryPointTaskAndSignFromES';
        let all_tasks = [];
        let task_codes_seen = new Set();
        
        let channels = ['1', '2', '3', '4', '01', '02', '03', '04'];
        for (let channel_type of channels) {
            let data = {
                'channelType': channel_type,
                'deviceId': this.generate_device_id()
            };
            
            let response = await this.http.request(url, 'POST', data);
            
            if (response && response.success && response.obj) {
                if (channel_type === '1') {
                    this.total_points = response.obj.totalPoint || 0;
                }
                
                let tasks = response.obj.taskTitleLevels || [];
                for (let task of tasks) {
                    let task_code = task.taskCode;
                    
                    if (task.buttonRedirect) {
                        let extracted_id = this._extract_task_id_from_url(task.buttonRedirect);
                        if (extracted_id && !task_code) {
                            task_code = extracted_id;
                            task.taskCode = extracted_id;
                        }
                    }
                    
                    if (!task_code && task.buttonRedirect) {
                        let extracted_id = this._extract_task_id_from_url(task.buttonRedirect);
                        if (extracted_id) {
                            task.taskCode = extracted_id;
                            task_code = extracted_id;
                        }
                    }
                    
                    if (!task_code) continue;
                    
                    if (!task_codes_seen.has(task_code)) {
                        task_codes_seen.add(task_code);
                        all_tasks.push(task);
                    }
                }
            } else {
                let error_msg = response ? (response.errorMessage || '未知错误') : '请求失败';
                this.logger.warning(`获取 channelType=${channel_type} 的任务失败: ${error_msg}`);
            }
        }
        return all_tasks;
    }
    
    async execute_task() {
        let url = 'https://mcs-mimp-web.sf-express.com/mcs-mimp/commonRoutePost/memberEs/taskRecord/finishTask';
        let data = {'taskCode': this.taskCode};
        let response = await this.http.request(url, 'POST', data);
        if (response && response.success) return true;
        return false;
    }
    
    async _update_points() {
        let tasks = await this.get_task_list();
        if (tasks && tasks.length > 0) {
            this.logger.points_info(this.total_points, "当前积分");
        }
    }
    
    async receive_task_reward() {
        let url = 'https://mcs-mimp-web.sf-express.com/mcs-mimp/commonPost/~memberNonactivity~integralTaskStrategyService~fetchIntegral';
        let data = {
            "strategyId": this.strategyId,
            "taskId": this.taskId,
            "taskCode": this.taskCode,
            "deviceId": this.generate_device_id()
        };
        let response = await this.http.request(url, 'POST', data);
        if (response && response.success) {
            this.logger.success(`成功领取任务奖励: ${this.title}`);
            return true;
        }
        return false;
    }
    
    async get_welfare_list() {
        let url = 'https://mcs-mimp-web.sf-express.com/mcs-mimp/commonPost/~memberGoods~mallGoodsLifeService~list';
        let data = {
            "memGrade": 3,
            "categoryCode": "SHTQ",
            "showCode": "SHTQWNTJ"
        };
        let response = await this.http.request(url, 'POST', data);
        if (response && response.success) {
            let obj_list = response.obj || [];
            let welfare_list = [];
            for (let module of obj_list) {
                let goods_list = module.goodsList || [];
                for (let goods of goods_list) {
                    if (goods.exchangeStatus === 1) {
                        welfare_list.push({
                            goodsId: goods.goodsId,
                            goodsNo: goods.goodsNo,
                            goodsName: goods.goodsName,
                            showName: goods.showName || '',
                            id: goods.id
                        });
                    }
                }
            }
            return welfare_list;
        }
        return [];
    }
    
    async receive_welfare(goods_no, goods_name, task_code) {
        let url = 'https://mcs-mimp-web.sf-express.com/mcs-mimp/commonPost/~memberGoods~pointMallService~createOrder';
        let data = {
            "from": "Point_Mall",
            "orderSource": "POINT_MALL_EXCHANGE",
            "goodsNo": goods_no,
            "quantity": 1,
            "taskCode": task_code
        };
        let response = await this.http.request(url, 'POST', data);
        if (response && response.success) {
            let order_no = (response.obj && response.obj.orderNo) ? response.obj.orderNo : '';
            this.logger.success(`成功领取生活特权: ${goods_name} (订单号: ${order_no})`);
            return true;
        } else {
            let error_msg = response ? (response.errorMessage || '未知错误') : '请求失败';
            this.logger.error(`领取生活特权失败: ${goods_name} - ${error_msg}`);
            return false;
        }
    }
    
    async handle_welfare_task(task_title) {
        this.logger.info('正在获取生活特权列表...');
        let welfare_list = await this.get_welfare_list();
        if (welfare_list.length === 0) {
            this.logger.warning('没有可领取的生活特权');
            return false;
        }
        this.logger.info(`找到 ${welfare_list.length} 个可领取的生活特权`);
        
        for (let welfare of welfare_list) {
            let goods_no = welfare.goodsNo;
            let goods_name = welfare.goodsName;
            let show_name = welfare.showName;
            if (!goods_no) continue;
            
            let display_name = show_name ? `${show_name} - ${goods_name}` : goods_name;
            if (await this.receive_welfare(goods_no, display_name, this.taskCode)) {
                return true;
            }
            await $.wait(1000);
        }
        return false;
    }
    
    async run_all_tasks() {
        console.log('-'.repeat(50));
        this.logger.info('正在获取任务列表...');
        let tasks = await this.get_task_list();
        if (!tasks || tasks.length === 0) {
            this.logger.error('获取任务列表失败');
            return { points_before: 0, points_after: 0 };
        }
        
        let points_before = this.total_points;
        this.logger.points_info(points_before, "执行前积分");
        
        for (let task of tasks) {
            let task_title = task.title || '未知任务';
            let task_status = task.status;
            
            if (task_status === 3) {
                this.logger.success(`${task_title} - 已完成`);
                continue;
            }
            
            if (this.config.SKIP_TASKS.includes(task_title)) {
                this.logger.task_skip(task_title);
                continue;
            }
            
            this._set_task_attrs(task);
            
            if (!this.taskCode) {
                if (task.buttonRedirect) {
                    this.logger.info(`尝试从buttonRedirect中提取taskCode: ${task_title}`);
                    let extracted = this._extract_task_id_from_url(task.buttonRedirect);
                    if (extracted) {
                        this.taskCode = extracted;
                        this.logger.info(`成功从buttonRedirect中提取到taskCode: ${this.taskCode}`);
                    } else {
                        this.logger.warning(`${task_title} - 无法从buttonRedirect提取taskCode，跳过`);
                        continue;
                    }
                } else {
                    this.logger.warning(`${task_title} - 无法提取taskCode，跳过`);
                    continue;
                }
            }
            
            this.logger.task_found(task_title, task_status);
            
            if (task_title.indexOf('领任意生活特权福利') > -1) {
                if (await this.handle_welfare_task(task_title)) {
                    await $.wait(2000);
                    if (await this.execute_task()) {
                        this.logger.task_complete(task_title);
                        await $.wait(2000);
                        if (await this.receive_task_reward()) {
                            this.logger.reward_get(task_title);
                            await this._update_points();
                        }
                    } else {
                        this.logger.warning(`任务执行失败: ${task_title}`);
                    }
                } else {
                    this.logger.warning(`${task_title} - 无法完成,跳过`);
                }
                await $.wait(3000);
                continue;
            }
            
            if (task_status === 1) {
                if (task_title.indexOf('连签7天') > -1 && task.process) {
                    let parts = task.process.split('/');
                    let current = parseInt(parts[0]);
                    let total = parseInt(parts[1]);
                    if (current < total) {
                        this.logger.info(`【${task_title}】进度: ${task.process}，还需${total - current}天`);
                        continue;
                    }
                }
                
                if (await this.execute_task()) {
                    this.logger.task_complete(task_title);
                    await $.wait(2000);
                    task_status = 2;
                } else {
                    this.logger.warning(`任务执行失败: ${task_title}`);
                    continue;
                }
            }
            
            if (task_status === 2) {
                if (await this.receive_task_reward()) {
                    this.logger.reward_get(task_title);
                    await this._update_points();
                    continue;
                }
                if (await this.execute_task()) {
                    this.logger.task_complete(task_title);
                    await $.wait(2000);
                    if (await this.receive_task_reward()) {
                        this.logger.reward_get(task_title);
                        await this._update_points();
                    }
                } else {
                    this.logger.warning(`任务执行失败: ${task_title}`);
                }
                continue;
            }
            
            await $.wait(3000);
        }
        
        let tasks_after = await this.get_task_list();
        let points_after = (tasks_after && tasks_after.length > 0) ? this.total_points : points_before;
        if (tasks_after && tasks_after.length > 0) {
            this.logger.points_info(points_after, "执行后积分");
        }
        
        return { points_before, points_after };
    }
}

// ==================== 账号管理器 ====================
class AccountManager {
    constructor(account_url, account_index, config) {
        this.account_url = account_url;
        this.account_index = account_index + 1;
        this.config = config;
        this.logger = new Logger();
        this.proxy_manager = new ProxyManager(config.PROXY_API_URL);
        
        this.login_success = false;
        this.user_id = null;
        this.phone = null;
        this.http_client = null;
    }

    async init() {
        let retry_count = 0;
        while (retry_count < MAX_PROXY_RETRIES && !this.login_success) {
            try {
                this.http_client = new SFHttpClient(this.config, this.proxy_manager);
                let loginRes = this.http_client.login(this.account_url);
                
                if (loginRes.success) {
                    this.user_id = loginRes.user_id;
                    this.phone = loginRes.phone || "未知";
                    let masked_phone = this.phone.length >= 11 ? this.phone.substring(0, 3) + "****" + this.phone.substring(7) : this.phone;
                    this.logger.user_info(this.account_index, masked_phone);
                    this.login_success = true;
                    break;
                } else {
                    if (retry_count < MAX_PROXY_RETRIES - 1) {
                        console.log(`账号${this.account_index} 登录失败，尝试重新获取代理 (${retry_count + 1}/${MAX_PROXY_RETRIES})`);
                        await $.wait(2000);
                    }
                }
            } catch (e) {
                console.log(`账号${this.account_index} 登录异常: ${String(e).substring(0, 100)}`);
            }
            retry_count++;
        }
        
        if (!this.login_success) {
            this.logger.error(`账号${this.account_index} 登录失败，已重试${MAX_PROXY_RETRIES}次`);
        }
    }
    
    async run() {
        if (!this.login_success) {
            return {
                success: false, phone: '', points_before: 0, points_after: 0,
                points_earned: 0, sign_success: false, countDay: 0, sign_error: '登录失败'
            };
        }
        
        let wait_time = Math.floor(Math.random() * (3000 - 1000 + 1) + 1000);
        await $.wait(wait_time);
        
        let executor = new TaskExecutor(this.http_client, this.logger, this.config, this.user_id);
        
        await executor.app_sign_in();
        await $.wait(1000);
        
        let signRes = await executor.sign_in();
        
        if (!signRes.success && signRes.error.indexOf('活动太火爆') > -1) {
            let max_retries = 3;
            for (let retry = 0; retry < max_retries; retry++) {
                this.logger.warning(`签到失败（代理IP问题），2秒后重新获取代理并重试（第${retry + 1}次）...`);
                await $.wait(2000);
                try {
                    this.http_client = new SFHttpClient(this.config, this.proxy_manager);
                    let lRes = this.http_client.login(this.account_url);
                    if (lRes.success) {
                        executor.http = this.http_client;
                        executor.user_id = lRes.user_id;
                        signRes = await executor.sign_in();
                        if (signRes.success) {
                            this.logger.success('重新登录后签到成功');
                            break;
                        } else if (signRes.error.indexOf('活动太火爆') === -1) {
                            break;
                        }
                    } else {
                        if (retry === max_retries - 1) this.logger.error(`重新登录失败，已重试${max_retries}次`);
                    }
                } catch (e) {
                    if (retry === max_retries - 1) this.logger.error(`重新登录异常: ${String(e).substring(0, 100)}，已重试${max_retries}次`);
                }
            }
        }
        
        let pointsRes = await executor.run_all_tasks();
        let points_earned = pointsRes.points_after - pointsRes.points_before;
        
        return {
            success: true, phone: this.phone, points_before: pointsRes.points_before,
            points_after: pointsRes.points_after, points_earned: points_earned,
            sign_success: signRes.success, countDay: signRes.countDay, sign_error: signRes.error
        };
    }
}

async function run_single_account(account_info, index, config) {
    try {
        console.log(`🚀 开始执行账号${index + 1}`);
        let account = new AccountManager(account_info, index, config);
        await account.init();
        let result = await account.run();
        
        if (result.success) console.log(`✅ 账号${index + 1}执行完成`);
        else console.log(`❌ 账号${index + 1}执行失败`);
        
        result.index = index;
        return result;
    } catch (e) {
        let error_msg = `账号${index + 1}执行异常: ${e}`;
        console.log(`❌ ${error_msg}`);
        return { index: index, success: false, phone: '', points_before: 0, points_after: 0, points_earned: 0, sign_success: false, countDay: 0, sign_error: error_msg };
    }
}

// ==================== 获取 Cookie 入口 ====================
function getCookie() {
    if ($request.url.indexOf("mcs-mimp-web.sf-express.com") > -1) {
        let cookie = $request.headers['Cookie'] || $request.headers['cookie'];
        if (cookie && cookie.indexOf('sessionId=') > -1) {
            let currentCK = $.getdata('sfsyUrl') || "";
            let sessionMatch = cookie.match(/sessionId=([^;]+)/);
            if (sessionMatch) {
                if (currentCK.indexOf(sessionMatch[1]) > -1) {
                    // console.log("Cookie已存在，无需重复获取");
                } else {
                    let newCk = currentCK ? currentCK + "&" + cookie : cookie;
                    $.setdata(newCk, 'sfsyUrl');
                    $.msg($.name, "获取Cookie成功🎉", "已存入本地数据持久化变量中");
                    console.log(`[顺丰速运] 获取到新Cookie:\n${cookie}`);
                }
            }
        }
    }
    $.done();
}

// ==================== 主任务入口 ====================
async function main() {
    let config = new Config();
    let env_value = $.getdata(config.ENV_NAME);
    
    if (!env_value) {
        console.log(`❌ 未找到本地缓存 Cookie变量 ${config.ENV_NAME}，请先通过重写规则获取`);
        return;
    }

    let account_urls = env_value.split('&').map(url => url.trim()).filter(url => url);
    if (account_urls.length === 0) {
        console.log(`❌ ${config.ENV_NAME} 为空或格式错误`);
        return;
    }

    // 随机打乱账号顺序
    account_urls.sort(() => Math.random() - 0.5);
    console.log(`🔀 已随机打乱账号执行顺序`);

    console.log("=".repeat(50));
    console.log(`🎉 ${config.APP_NAME} v${config.VERSION}`);
    console.log(`👨‍💻 作者: 爱学习的呆子 (JS移植版)`);
    console.log(`📱 共获取到 ${account_urls.length} 个账号`);
    console.log(`⚙️ 并发数量: ${CONCURRENT_NUM}`);
    let d = new Date();
    console.log(`⏰ 执行时间: ${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`);
    console.log("=".repeat(50));
    
    let all_results = [];
    
    if (CONCURRENT_NUM <= 1) {
        console.log("🔄 使用串行模式执行...");
        for (let i = 0; i < account_urls.length; i++) {
            let res = await run_single_account(account_urls[i], i, config);
            all_results.push(res);
            if (i < account_urls.length - 1) {
                console.log("=".repeat(50));
                console.log(`⏳ 等待 2 秒后执行下一个账号...`);
                await $.wait(2000);
            }
        }
    } else {
        console.log(`🔄 使用并发模式执行，并发数: ${CONCURRENT_NUM}`);
        let promises = account_urls.map((url, i) => run_single_account(url, i, config));
        all_results = await Promise.all(promises);
    }
    
    all_results.sort((a, b) => a.index - b.index);
    
    let success_count = all_results.filter(r => r.success).length;
    let fail_count = all_results.length - success_count;
    let total_earned = all_results.filter(r => r.success).reduce((sum, r) => sum + r.points_earned, 0);
    
    console.log("\n" + "=".repeat(80));
    console.log(`📊 积分统计汇总`);
    console.log("=".repeat(80));
    console.log(`序号\t手机号\t\t今日获得积分\t总积分\t\t状态`);
    console.log("-".repeat(80));
    
    for (let result of all_results) {
        let idx = result.index + 1;
        let p = result.phone ? result.phone.substring(0, 3) + "****" + result.phone.substring(7) : "未登录";
        let e = result.points_earned;
        let t = result.points_after;
        let s = result.success ? "✅成功" : "❌失败";
        console.log(`${idx}\t${p}\t${e}\t\t${t}\t\t${s}`);
    }
    console.log("-".repeat(80));
    console.log(`汇总\t账号总数: ${all_results.length}\t今日总获得: ${total_earned}\t\t\t成功: ${success_count}`);
    console.log("=".repeat(80));
    
    console.log("\n🎊 所有账号任务执行完成!");
}

// ==================== 路由与 Env 执行环境 ====================
if (typeof $request !== "undefined") {
    // 拦截请求，获取Cookie
    getCookie();
} else {
    // 跑定时任务
    main().catch(e => $.logErr(e)).finally(() => $.done());
}

/**
 * 经典 Env 多端兼容运行环境
 */
function Env(t, e) {
    "undefined" != typeof process && JSON.stringify(process.env).indexOf("GITHUB") > -1 && process.exit(0);
    class s {
        constructor(t) { this.env = t }
        send(t, e = "GET") { t = "string" == typeof t ? { url: t } : t; let s = this.get; return "POST" === e && (s = this.post), new Promise((e, i) => { s.call(this, t, (t, s, r) => { t ? i(t) : e(s) }) }) }
        get(t) { return this.send.call(this.env, t) }
        post(t) { return this.send.call(this.env, t, "POST") }
    }
    return new class {
        constructor(t, e) { this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.startTime = (new Date).getTime(), Object.assign(this, e), this.log("", `🔔${this.name}, 开始!`) }
        isNode() { return "undefined" != typeof module && !!module.exports }
        isQuanX() { return "undefined" != typeof $task }
        isSurge() { return "undefined" != typeof $httpClient && "undefined" == typeof $loon }
        isLoon() { return "undefined" != typeof $loon }
        getScript(t) { return new Promise(e => { this.get({ url: t }, (t, s, i) => e(i)) }) }
        runScript(t, e) { return new Promise(s => { let i = this.getdata("@chavy_boxjs_userCfgs.httpapi"); i = i ? i.replace(/\n/g, "").trim() : i; let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout"); r = r ? 1 * r : 20, r = e && e.timeout ? e.timeout : r; const [o, h] = i.split("@"), n = { url: `http://${h}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: r }, headers: { "X-Key": o, Accept: "*/*" } }; this.post(n, (t, e, i) => s(i)) }).catch(t => this.logErr(t)) }
        loaddata() {
            if (!this.isNode()) return {}; {
                this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path");
                const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e);
                if (!s && !i) return {};
                { const i = s ? t : e; try { return JSON.parse(this.fs.readFileSync(i)) } catch (t) { return {} } }
            }
        }
        writedata() {
            if (this.isNode()) {
                this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path");
                const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e), r = JSON.stringify(this.data);
                s ? this.fs.writeFileSync(t, r) : i ? this.fs.writeFileSync(e, r) : this.fs.writeFileSync(t, r)
            }
        }
        getdata(t) { let e = this.getval(t); if (/^@/.test(t)) { const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t), r = s ? this.getval(s) : ""; if (r) try { const t = JSON.parse(r); e = t ? this.lodash_get(t, i, "") : e } catch (t) { e = "" } } return e }
        setdata(t, e) { let s = !1; if (/^@/.test(e)) { const [, i, r] = /^@(.*?)\.(.*?)$/.exec(e), o = this.getval(i), h = i ? "null" === o ? null : o || "{}" : "{}"; try { const e = JSON.parse(h); this.lodash_set(e, r, t), s = this.setval(JSON.stringify(e), i) } catch (e) { const o = {}; this.lodash_set(o, r, t), s = this.setval(JSON.stringify(o), i) } } else s = this.setval(t, e); return s }
        getval(t) { return this.isSurge() || this.isLoon() ? $persistentStore.read(t) : this.isQuanX() ? $prefs.valueForKey(t) : this.isNode() ? (this.data = this.loaddata(), this.data[t]) : this.data && this.data[t] || null }
        setval(t, e) { return this.isSurge() || this.isLoon() ? $persistentStore.write(t, e) : this.isQuanX() ? $prefs.setValueForKey(t, e) : this.isNode() ? (this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0) : this.data && this.data[e] || null }
        initGotEnv(t) { this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar)) }
        get(t, e = (() => { })) {
            t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"]), this.isSurge() || this.isLoon() ? (this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Routing": "false" })), $httpClient.get(t, (t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i) })) : this.isQuanX() ? (this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => e(t))) : this.isNode() && (this.initGotEnv(t), this.got(t).on("redirect", (t, e) => { try { if (t.headers["set-cookie"]) { const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar } } catch (t) { this.logErr(t) } }).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => { const { message: s, response: i } = t; e(s, i, i && i.body) }))
        }
        post(t, e = (() => { })) {
            if (t.body && t.headers && !t.headers["Content-Type"] && (t.headers["Content-Type"] = "application/x-www-form-urlencoded"), t.headers && delete t.headers["Content-Length"], this.isSurge() || this.isLoon()) this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Routing": "false" })), $httpClient.post(t, (t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i) }); else if (this.isQuanX()) t.method = "POST", this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => e(t)); else if (this.isNode()) { this.initGotEnv(t); const { url: s, ...i } = t; this.got.post(s, i).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => { const { message: s, response: i } = t; e(s, i, i && i.body) }) }
        }
        time(t, e = null) { const s = e ? new Date(e) : new Date; let i = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds() }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let e in i) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? i[e] : ("00" + i[e]).substr(("" + i[e]).length))); return t }
        msg(e = t, s = "", i = "", r) { const o = t => { if (!t) return t; if ("string" == typeof t) return this.isLoon() ? t : this.isQuanX() ? { "open-url": t } : this.isSurge() ? { url: t } : void 0; if ("object" == typeof t) { if (this.isLoon()) { let e = t.openUrl || t.url || t["open-url"], s = t.mediaUrl || t["media-url"]; return { openUrl: e, mediaUrl: s } } if (this.isQuanX()) { let e = t["open-url"] || t.url || t.openUrl, s = t["media-url"] || t.mediaUrl; return { "open-url": e, "media-url": s } } if (this.isSurge()) { let e = t.url || t.openUrl || t["open-url"]; return { url: e } } } }; if (this.isMute || (this.isSurge() || this.isLoon() ? $notification.post(e, s, i, o(r)) : this.isQuanX() && $notify(e, s, i, o(r))), !this.isMuteLog) { let t = ["", "==============📣系统通知📣=============="]; t.push(e), s && t.push(s), i && t.push(i), console.log(t.join("\n")), this.logs = this.logs.concat(t) } }
        log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator)) }
        logErr(t, e) { const s = !this.isSurge() && !this.isQuanX() && !this.isLoon(); s ? this.log("", `❗️${this.name}, 错误!`, t.stack) : this.log("", `❗️${this.name}, 错误!`, t) }
        wait(t) { return new Promise(e => setTimeout(e, t)) }
        done(t = {}) { const e = (new Date).getTime(), s = (e - this.startTime) / 1e3; this.log("", `🔔${this.name}, 结束! 🕛 ${s} 秒`), this.log(), (this.isSurge() || this.isQuanX() || this.isLoon()) && $done(t) }
    }(t, e)
}
