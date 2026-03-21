/*
 * 顺丰速运日常积分任务 (JS 1:1 完整无损版)
 * Author: @viyfe (JS 转换)
 * Version: 1.2.0-JS
 * * 环境变量: sfsyUrl (支持换行符分割，无需 URL 编码)
 */

const $ = new Env("顺丰速运");
const CryptoJS_MD5 = require_md5(); // 引入底部的 MD5 实现

// ==================== Bark 推送配置 ====================
const CUSTOM_BARK_ICON = "https://gitee.com/hlt1995/BARK_ICON/raw/main/SFExpress.png";
const CUSTOM_BARK_GROUP = "顺丰速运";
const PUSH_SWITCH = process.env.PUSH_SWITCH || "1";

const BARK_PUSH = process.env.BARK_PUSH || $.getdata('BARK_PUSH') || "";
const BARK_ICON = CUSTOM_BARK_ICON || process.env.BARK_ICON || "";
const BARK_GROUP = CUSTOM_BARK_GROUP || process.env.BARK_GROUP || "";

// ==================== 全局常量配置 ====================
const PROXY_TIMEOUT = 15000; // 代理超时时间（毫秒）
const MAX_PROXY_RETRIES = 5; // 最大代理重试次数
const REQUEST_RETRY_COUNT = 3; // 请求重试次数
const CONCURRENT_NUM = parseInt(process.env.SFBF || $.getdata('SFBF') || '1'); // JS 模拟并发数

// ==================== 配置类 ====================
class Config {
    constructor() {
        this.APP_NAME = "顺丰速运";
        this.VERSION = "1.2.0";
        this.ENV_NAME = "sfsyUrl";
        this.PROXY_API_URL = process.env.SF_PROXY_API_URL || $.getdata('SF_PROXY_API_URL') || '';
        
        this.PROXY_TIMEOUT = 15000;
        this.MAX_PROXY_RETRIES = 5;
        this.REQUEST_RETRY_COUNT = 3;
        
        this.TOKEN = 'wwesldfs29aniversaryvdld29';
        this.SYS_CODE = 'MCS-MIMP-CORE';
        
        this.SKIP_TASKS = ['用行业模板寄件下单','用积分兑任意礼品','参与积分活动','每月累计寄件','完成每月任务','去使用AI寄件'];
    }
}

// ==================== 日志系统 ====================
class Logger {
    constructor() {
        this.ICONS = {
            'task_found': '🎯', 'task_skip': '⏭️', 'task_complete': '✅',
            'reward_get': '🎁', 'info': '📝', 'success': '✨', 'error': '❌',
            'warning': '⚠️', 'user': '👤', 'money': '💰', 'gift': '🎁', 'target': '🎯'
        };
        this.messages = [];
        this.current_account_msg = [];
    }

    _format_msg(icon, content) { return `${icon} ${content}`; }
    
    _safe_print(msg) { console.log(msg); } // JS 是单线程，无需 Lock
    
    task_found(task_name, status = 2) {
        let msg = this._format_msg(this.ICONS['task_found'], `发现任务: ${task_name} (状态: ${status})`);
        this._safe_print(msg);
        this.current_account_msg.push(msg); this.messages.push(msg);
    }
    
    task_skip(task_name) {
        let msg = this._format_msg(this.ICONS['task_skip'], `[${task_name}] 已跳过`);
        this._safe_print(msg);
        this.current_account_msg.push(msg); this.messages.push(msg);
    }
    
    task_complete(task_name) {
        let msg = this._format_msg(this.ICONS['task_complete'], `[${task_name}] 提交成功`);
        this._safe_print(msg);
        this.current_account_msg.push(msg); this.messages.push(msg);
    }
    
    reward_get(task_name) {
        let msg = this._format_msg(this.ICONS['reward_get'], `[${task_name}] 奖励领取成功`);
        this._safe_print(msg);
        this.current_account_msg.push(msg); this.messages.push(msg);
    }
    
    info(content) {
        let msg = this._format_msg(this.ICONS['info'], content);
        this._safe_print(msg);
        this.current_account_msg.push(msg); this.messages.push(msg);
    }
    
    success(content) {
        let msg = this._format_msg(this.ICONS['success'], content);
        this._safe_print(msg);
        this.current_account_msg.push(msg); this.messages.push(msg);
    }
    
    error(content) {
        let msg = this._format_msg(this.ICONS['error'], content);
        this._safe_print(msg);
        this.current_account_msg.push(msg); this.messages.push(msg);
    }
    
    warning(content) {
        let msg = this._format_msg(this.ICONS['warning'], content);
        this._safe_print(msg);
        this.current_account_msg.push(msg); this.messages.push(msg);
    }
    
    user_info(account_index, mobile) {
        let msg = this._format_msg(this.ICONS['user'], `账号${account_index}: 【${mobile}】登录成功`);
        this._safe_print(msg);
        this.current_account_msg.push(msg); this.messages.push(msg);
    }
    
    points_info(points, prefix = "当前积分") {
        let msg = this._format_msg(this.ICONS['money'], `${prefix}: 【${points}】`);
        this._safe_print(msg);
        this.current_account_msg.push(msg); this.messages.push(msg);
    }
    
    reset_account_msg() { this.current_account_msg = []; }
    get_all_messages() { return this.messages.join('\n'); }
    get_account_messages() { return this.current_account_msg.join('\n'); }
}

// ==================== 代理管理器 ====================
class ProxyManager {
    constructor(api_url) {
        this.api_url = api_url;
        this.logger = new Logger();
    }
    
    async get_proxy() {
        try {
            if (!this.api_url) {
                console.log('⚠️ 未配置代理API地址，将不使用代理');
                return null;
            }
            return new Promise(resolve => {
                $.get({ url: this.api_url, timeout: 10000 }, (err, resp, data) => {
                    if (!err && resp.status === 200) {
                        let proxy_text = data.trim();
                        if (proxy_text.includes(':')) {
                            let proxy = proxy_text.startsWith('http') ? proxy_text : `http://${proxy_text}`;
                            console.log(`✅ 成功获取代理: ${proxy.replace(/@.*/, '@***:***')}`);
                            resolve(proxy); // JS 环境下仅作记录或支持的 HTTP 请求
                        } else resolve(null);
                    } else {
                        console.log(`❌ 获取代理失败: ${data}`);
                        resolve(null);
                    }
                });
            });
        } catch (e) {
            console.log(`❌ 获取代理异常: ${e.message}`);
            return null;
        }
    }
}

// ==================== HTTP客户端 ====================
class SFHttpClient {
    constructor(config, proxy_manager) {
        this.config = config;
        this.proxy_manager = proxy_manager;
        this.cookie = "";
        this.headers = {
            'Host': 'mcs-mimp-web.sf-express.com',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781 WindowsWechat XWEB/6945 Flue',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'sec-fetch-site': 'none',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-user': '?1',
            'sec-fetch-dest': 'document',
            'accept-language': 'zh-CN,zh',
            'platform': 'MINI_PROGRAM',
        };
    }

    _generate_sign() {
        const timestamp = Date.now().toString();
        const data = `token=${this.config.TOKEN}&timestamp=${timestamp}&sysCode=${this.config.SYS_CODE}`;
        const signature = CryptoJS_MD5(data);
        return { 'sysCode': this.config.SYS_CODE, 'timestamp': timestamp, 'signature': signature };
    }

    async request(url_path, method = 'POST', data = {}, max_retries = REQUEST_RETRY_COUNT) {
        let sign_data = this._generate_sign();
        Object.assign(this.headers, sign_data);
        if (this.cookie) this.headers['Cookie'] = this.cookie;

        const full_url = url_path.startsWith('http') ? url_path : `https://mcs-mimp-web.sf-express.com${url_path}`;
        let retry_count = 0;
        let proxy_retry_count = 0;

        while (proxy_retry_count < this.config.MAX_PROXY_RETRIES) {
            if (retry_count >= 2) {
                console.log('请求已失败2次，尝试切换代理IP');
                await this.proxy_manager.get_proxy();
                retry_count = 0;
            }

            let options = {
                url: full_url,
                method: method.toUpperCase(),
                headers: this.headers,
                timeout: this.config.PROXY_TIMEOUT
            };
            if (method.toUpperCase() === 'POST') options.body = JSON.stringify(data);

            try {
                let res = await new Promise((resolve, reject) => {
                    $.http.send(options, method.toUpperCase()).then(resp => {
                        try {
                            resolve(JSON.parse(resp.body));
                        } catch (e) { reject('JSONDecodeError'); }
                    }).catch(e => reject(e));
                });
                
                if (!res) {
                    console.log(`响应内容为空，正在重试 (${retry_count + 1}/${max_retries})`);
                    retry_count++;
                    await $.wait(2000);
                    continue;
                }
                return res;
            } catch (e) {
                retry_count++;
                console.log(`请求失败，正在重试 (${retry_count}/${max_retries}): ${e}`);
                if (String(e).includes('ProxyError') || String(e).includes('timeout')) {
                    proxy_retry_count++;
                    console.log(`代理连接失败，尝试切换代理 (${proxy_retry_count}/${this.config.MAX_PROXY_RETRIES})`);
                    if (proxy_retry_count < this.config.MAX_PROXY_RETRIES) {
                        await this.proxy_manager.get_proxy();
                    }
                }
                await $.wait(2000);
            }
        }
        console.log('请求最终失败，返回None');
        return null;
    }

    async login(url, timeout = PROXY_TIMEOUT) {
        try {
            let decoded_input = decodeURIComponent(url).trim();
            if (decoded_input.includes('sessionId=') || decoded_input.includes('_login_mobile_=')) {
                this.cookie = decoded_input;
                let user_id = decoded_input.match(/_login_user_id_=([^;]+)/)?.[1] || '';
                let phone = decoded_input.match(/_login_mobile_=([^;]+)/)?.[1] || '';
                if (phone) return [true, user_id, phone];
                return [false, '', ''];
            } else {
                return new Promise(resolve => {
                    $.get({ url: decoded_input, headers: this.headers, timeout: timeout }, (err, resp, data) => {
                        let ck = resp?.headers['Set-Cookie'] || resp?.headers['set-cookie'] || "";
                        if (ck) {
                            this.cookie = ck;
                            let user_id = ck.match(/_login_user_id_=([^;]+)/)?.[1] || '';
                            let phone = ck.match(/_login_mobile_=([^;]+)/)?.[1] || '';
                            resolve([!!phone, user_id, phone]);
                        } else {
                            resolve([false, '', '']);
                        }
                    });
                });
            }
        } catch (e) {
            console.log(`登录异常: ${e.message}`);
            return [false, '', ''];
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
        this.strategyId = "";
        this.title = "";
        this.point = 0;
    }

    generate_device_id() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    _extract_task_id_from_url(url) {
        try {
            if (url.includes('_ug_view_param=')) {
                let json_str = url.split('_ug_view_param=')[1].split('&')[0];
                let ug_params = JSON.parse(decodeURIComponent(json_str));
                if (ug_params.taskId) return String(ug_params.taskId);
            }
        } catch (e) { this.logger.warning(`从URL提取taskId失败: ${e.message}`); }
        return '';
    }

    _set_task_attrs(task) {
        this.taskId = String(task.taskId || '');
        this.taskCode = String(task.taskCode || '');
        this.strategyId = parseInt(task.strategyId || 0);
        this.title = String(task.title || '未知任务');
        this.point = parseInt(task.point || 0);
        
        if (!this.taskCode && task.buttonRedirect) {
            let extracted_task_id = this._extract_task_id_from_url(task.buttonRedirect);
            if (extracted_task_id) {
                this.taskCode = extracted_task_id;
                this.logger.info(`从buttonRedirect中提取到taskId: ${this.taskCode}`);
            }
        }
    }

    async app_sign_in() {
        const url = '/mcs-mimp/commonPost/~memberNonactivity~integralTaskSignPlusService~getUnFetchPointAndDiscount';
        let original_platform = this.http.headers['platform'];
        this.http.headers['platform'] = 'SFAPP';
        
        try {
            let response = await this.http.request(url, 'POST', {});
            if (response && response.success) {
                let obj = response.obj || [];
                if (obj.length > 0) {
                    let reward_names = obj.map(item => item.packetName || '未知奖励');
                    this.logger.success(`[APP签到] 签到成功，获得【${reward_names.join(', ')}】`);
                } else {
                    this.logger.info(`[APP签到] 今日已签到或无可领取奖励`);
                }
                return [true, ''];
            } else {
                let error_msg = response ? response.errorMessage : '请求失败';
                if (error_msg && error_msg.includes('没有待领取礼包')) {
                    this.logger.info(`[APP签到] 检测到需要二次领取，等待1秒后重试...`);
                    await $.wait(1000);
                    let response2 = await this.http.request(url, 'POST', {});
                    if (response2 && response2.success) {
                        let obj2 = response2.obj || [];
                        if (obj2.length > 0) {
                            let reward_names = obj2.map(item => item.packetName || '未知奖励');
                            this.logger.success(`[APP签到] 二次领取成功，获得【${reward_names.join(', ')}】`);
                        } else this.logger.info(`[APP签到] 二次领取完成，但无可领取奖励`);
                        return [true, ''];
                    } else {
                        let error_msg2 = response2 ? response2.errorMessage : '请求失败';
                        this.logger.error(`[APP签到] 二次领取失败: ${error_msg2}`);
                        return [false, error_msg2];
                    }
                } else {
                    this.logger.error(`[APP签到] 失败: ${error_msg}`);
                    return [false, error_msg];
                }
            }
        } finally {
            this.http.headers['platform'] = original_platform;
        }
    }

    async sign_in() {
        const url = '/mcs-mimp/commonPost/~memberNonactivity~integralTaskSignPlusService~automaticSignFetchPackage';
        const data = {"comeFrom": "vioin", "channelFrom": "WEIXIN"};
        let response = await this.http.request(url, 'POST', data);
        
        if (response && response.success) {
            let count_day = response.obj?.countDay || 0;
            let packet_list = response.obj?.integralTaskSignPackageVOList || [];
            let packet_name = packet_list.length > 0 ? packet_list[0].packetName : '';
            this.logger.success(`签到成功，获得【${packet_name}】，本周累计签到【${count_day + 1}】天`);
            return [true, count_day, packet_name, ''];
        } else {
            let error_msg = response ? response.errorMessage : '未知错误';
            this.logger.error(`签到失败: ${error_msg}`);
            return [false, 0, '', error_msg];
        }
    }

    async get_task_list() {
        const url = '/mcs-mimp/commonPost/~memberNonactivity~integralTaskStrategyService~queryPointTaskAndSignFromES';
        let all_tasks = [];
        let task_codes_seen = new Set();
        
        for (let channel_type of ['1', '2', '3', '4', '01', '02', '03', '04']) {
            let data = { 'channelType': channel_type, 'deviceId': this.generate_device_id() };
            let response = await this.http.request(url, 'POST', data);
            
            if (response && response.success && response.obj) {
                if (channel_type === '1') this.total_points = response.obj.totalPoint || 0;
                let tasks = response.obj.taskTitleLevels || [];
                
                for (let task of tasks) {
                    let task_code = task.taskCode;
                    if (!task_code && task.buttonRedirect) {
                        task_code = this._extract_task_id_from_url(task.buttonRedirect);
                        if (task_code) task.taskCode = task_code;
                    }
                    if (!task_code) continue;
                    
                    if (!task_codes_seen.has(task_code)) {
                        task_codes_seen.add(task_code);
                        all_tasks.push(task);
                    }
                }
            } else {
                let error_msg = response ? response.errorMessage : '请求失败';
                this.logger.warning(`获取 channelType=${channel_type} 的任务失败: ${error_msg}`);
            }
        }
        return all_tasks;
    }

    async execute_task() {
        const url = '/mcs-mimp/commonRoutePost/memberEs/taskRecord/finishTask';
        let response = await this.http.request(url, 'POST', {'taskCode': this.taskCode});
        return response && response.success;
    }

    async _update_points() {
        let tasks = await this.get_task_list();
        if (tasks.length > 0) this.logger.points_info(this.total_points, "当前积分");
    }

    async receive_task_reward() {
        const url = '/mcs-mimp/commonPost/~memberNonactivity~integralTaskStrategyService~fetchIntegral';
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
        const url = '/mcs-mimp/commonPost/~memberGoods~mallGoodsLifeService~list';
        let data = { "memGrade": 3, "categoryCode": "SHTQ", "showCode": "SHTQWNTJ" };
        let response = await this.http.request(url, 'POST', data);
        if (response && response.success) {
            let obj_list = response.obj || [];
            let welfare_list = [];
            for (let module of obj_list) {
                let goods_list = module.goodsList || [];
                for (let goods of goods_list) {
                    if (goods.exchangeStatus === 1) {
                        welfare_list.push({
                            'goodsId': goods.goodsId, 'goodsNo': goods.goodsNo,
                            'goodsName': goods.goodsName, 'showName': goods.showName || '', 'id': goods.id
                        });
                    }
                }
            }
            return welfare_list;
        }
        return [];
    }

    async receive_welfare(goods_no, goods_name, task_code) {
        const url = '/mcs-mimp/commonPost/~memberGoods~pointMallService~createOrder';
        let data = { "from": "Point_Mall", "orderSource": "POINT_MALL_EXCHANGE", "goodsNo": goods_no, "quantity": 1, "taskCode": task_code };
        let response = await this.http.request(url, 'POST', data);
        if (response && response.success) {
            let order_no = response.obj?.orderNo || '';
            this.logger.success(`成功领取生活特权: ${goods_name} (订单号: ${order_no})`);
            return true;
        } else {
            let error_msg = response ? response.errorMessage : '请求失败';
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
            if (await this.receive_welfare(goods_no, display_name, this.taskCode)) return true;
            await $.wait(1000);
        }
        return false;
    }

    async run_all_tasks() {
        console.log('-'.repeat(50));
        this.logger.info('正在获取任务列表...');
        let tasks = await this.get_task_list();
        if (tasks.length === 0) {
            this.logger.error('获取任务列表失败');
            return [0, 0];
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
                this.logger.warning(`${task_title} - 无法提取taskCode，跳过`);
                continue;
            }
            
            this.logger.task_found(task_title, task_status);
            
            // 特殊任务处理
            if (task_title.includes('领任意生活特权福利')) {
                if (await this.handle_welfare_task(task_title)) {
                    await $.wait(2000);
                    if (await this.execute_task()) {
                        this.logger.task_complete(task_title);
                        await $.wait(2000);
                        if (await this.receive_task_reward()) {
                            this.logger.reward_get(task_title);
                            await this._update_points();
                        }
                    } else this.logger.warning(`任务执行失败: ${task_title}`);
                } else this.logger.warning(`${task_title} - 无法完成,跳过`);
                await $.wait(3000);
                continue;
            }
            
            if (task_status === 1) {
                if (task_title.includes('连签7天') && task.process) {
                    let [current, total] = task.process.split('/').map(Number);
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
                } else this.logger.warning(`任务执行失败: ${task_title}`);
                continue;
            }
            await $.wait(3000);
        }
        
        let final_tasks = await this.get_task_list();
        let points_after = final_tasks.length > 0 ? this.total_points : points_before;
        if (final_tasks.length > 0) this.logger.points_info(points_after, "执行后积分");
        
        return [points_before, points_after];
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
        while (retry_count < this.config.MAX_PROXY_RETRIES && !this.login_success) {
            try {
                this.http_client = new SFHttpClient(this.config, this.proxy_manager);
                let [success, user_id, phone] = await this.http_client.login(this.account_url);
                if (success) {
                    this.user_id = user_id;
                    this.phone = phone;
                    let masked_phone = this.phone.substring(0,3) + "****" + this.phone.substring(7);
                    this.logger.user_info(this.account_index, masked_phone);
                    this.login_success = true;
                    break;
                } else {
                    if (retry_count < this.config.MAX_PROXY_RETRIES - 1) {
                        console.log(`账号${this.account_index} 登录失败，尝试重新获取代理 (${retry_count + 1}/${this.config.MAX_PROXY_RETRIES})`);
                        await $.wait(2000);
                    }
                }
            } catch (e) { console.log(`账号${this.account_index} 登录异常: ${String(e).substring(0,100)}`); }
            retry_count++;
        }
        if (!this.login_success) this.logger.error(`账号${this.account_index} 登录失败，已重试${this.config.MAX_PROXY_RETRIES}次`);
    }

    async run() {
        if (!this.login_success) return { 'success': false, 'phone': '', 'points_before': 0, 'points_after': 0, 'points_earned': 0, 'sign_success': false, 'countDay': 0, 'sign_error': '登录失败' };
        
        await $.wait(Math.floor(Math.random() * 2000) + 1000);
        let executor = new TaskExecutor(this.http_client, this.logger, this.config, this.user_id);
        
        await executor.app_sign_in();
        await $.wait(1000);
        let [sign_success, count_day, packet_name, sign_error] = await executor.sign_in();
        
        if (!sign_success && sign_error.includes('活动太火爆')) {
            let max_retries = 3;
            for (let retry = 0; retry < max_retries; retry++) {
                this.logger.warning(`签到失败（代理IP问题），2秒后重新获取代理并重试（第${retry + 1}次）...`);
                await $.wait(2000);
                try {
                    this.http_client = new SFHttpClient(this.config, this.proxy_manager);
                    let [success, user_id, phone] = await this.http_client.login(this.account_url);
                    if (success) {
                        executor.http = this.http_client;
                        executor.user_id = user_id;
                        let sign_res = await executor.sign_in();
                        sign_success = sign_res[0]; count_day = sign_res[1]; sign_error = sign_res[3];
                        if (sign_success) { this.logger.success('重新登录后签到成功'); break; }
                        else if (!sign_error.includes('活动太火爆')) break;
                    } else if (retry === max_retries - 1) this.logger.error(`重新登录失败，已重试${max_retries}次`);
                } catch (e) { if (retry === max_retries - 1) this.logger.error(`重新登录异常: ${String(e).substring(0,100)}`); }
            }
        }
        
        let [points_before, points_after] = await executor.run_all_tasks();
        return { 'success': true, 'phone': this.phone, 'points_before': points_before, 'points_after': points_after, 'points_earned': points_after - points_before, 'sign_success': sign_success, 'countDay': count_day, 'sign_error': sign_error };
    }
}

// ==================== 单账号执行函数 ====================
async function run_single_account(account_info, index, config) {
    try {
        console.log(`🚀 开始执行账号${index + 1}`);
        let account = new AccountManager(account_info, index, config);
        await account.init();
        let result = await account.run();
        console.log(result.success ? `✅ 账号${index + 1}执行完成` : `❌ 账号${index + 1}执行失败`);
        result.index = index;
        return result;
    } catch (e) {
        let error_msg = `账号${index + 1}执行异常: ${e.message}`;
        console.log(`❌ ${error_msg}`);
        return { 'index': index, 'success': false, 'phone': '', 'points_before': 0, 'points_after': 0, 'points_earned': 0, 'sign_success': false, 'countDay': 0, 'sign_error': error_msg };
    }
}

// ==================== 主程序 ====================
async function main() {
    let config = new Config();
    let env_value = process.env[config.ENV_NAME] || $.getdata(config.ENV_NAME);
    if (!env_value) { console.log(`❌ 未找到环境变量 ${config.ENV_NAME}，请检查配置`); return; }

    let account_urls = [];
    if (env_value.includes('\n')) account_urls = env_value.split('\n').map(u=>u.trim()).filter(u=>!!u);
    else {
        account_urls = env_value.split(/&(?=https?:\/\/)/);
        account_urls = account_urls.map(u=>u.trim()).filter(u=>!!u);
    }
    
    if (account_urls.length === 0) { console.log(`❌ 环境变量 ${config.ENV_NAME} 为空或格式错误`); return; }

    // 随机打乱
    account_urls.sort(() => Math.random() - 0.5);
    console.log(`🔀 已随机打乱账号执行顺序`);

    console.log("=".repeat(50));
    console.log(`🎉 ${config.APP_NAME} v${config.VERSION}`);
    console.log(`👨‍💻 Author: @viyfe (JS Converted)`);
    console.log(`📱 共获取到 ${account_urls.length} 个账号`);
    console.log(`⚙️ 并发数量: ${CONCURRENT_NUM}`);
    console.log(`⏰ 执行时间: ${new Date().toLocaleString()}`);
    console.log("=".repeat(50));

    let all_results = [];
    if (CONCURRENT_NUM <= 1) {
        console.log("🔄 使用串行模式执行...");
        for (let index = 0; index < account_urls.length; index++) {
            let res = await run_single_account(account_urls[index], index, config);
            all_results.push(res);
            if (index < account_urls.length - 1) {
                console.log("=".repeat(50));
                console.log(`⏳ 等待 2 秒后执行下一个账号...`);
                await $.wait(2000);
            }
        }
    } else {
        console.log(`🔄 使用并发模式执行，并发数: ${CONCURRENT_NUM}`);
        // 简易控制并发池
        for (let i = 0; i < account_urls.length; i += CONCURRENT_NUM) {
            let batch = account_urls.slice(i, i + CONCURRENT_NUM);
            let promises = batch.map((url, j) => run_single_account(url, i + j, config));
            let resBatch = await Promise.all(promises);
            all_results.push(...resBatch);
            if (i + CONCURRENT_NUM < account_urls.length) await $.wait(2000);
        }
    }

    all_results.sort((a, b) => a.index - b.index);

    let success_count = all_results.filter(r => r.success).length;
    let total_earned = all_results.reduce((acc, r) => acc + (r.success ? r.points_earned : 0), 0);

    console.log(`\n` + "=".repeat(80));
    console.log(`📊 积分统计汇总`);
    console.log("=".repeat(80));
    console.log(`序号    手机号          今日获得积分    总积分          状态`);
    console.log("-".repeat(80));
    
    for (let r of all_results) {
        let phone = r.phone ? r.phone.substring(0,3) + "****" + r.phone.substring(7) : "未登录";
        let status = r.success ? "✅成功" : "❌失败";
        console.log(`${(r.index + 1).toString().padEnd(6)} ${phone.padEnd(15)} ${r.points_earned.toString().padEnd(15)} ${r.points_after.toString().padEnd(15)} ${status}`);
    }
    
    console.log("-".repeat(80));
    console.log(`汇总    账号总数: ${all_results.length.toString().padEnd(10)} 今日总获得: ${total_earned.toString().padEnd(10)} 成功: ${success_count}`);
    console.log("=".repeat(80));
    console.log("\n🎊 所有账号任务执行完成!");

    // ==================== Bark 推送逻辑 ====================
    if (PUSH_SWITCH === "1" && BARK_PUSH) {
        let bark_url = BARK_PUSH.startsWith('http') ? BARK_PUSH : `https://api.day.app/${BARK_PUSH}`;
        let body = "";
        for (let r of all_results) {
            let phone = r.phone || '';
            let masked = (phone && phone.length === 11) ? phone.substring(0,3) + "****" + phone.substring(7) : phone;
            body += `👤 账号${r.index + 1}:【${masked}】\n`;
            if (r.success) {
                if (r.sign_success) body += `✨ 签到成功，本周累计签到【${r.countDay + 1}】天\n`;
                else body += `⚠️ 签到失败：${r.sign_error}\n`;
                body += `💰 当前积分：【${r.points_after}】（${r.points_earned >= 0 ? '+' : ''}${r.points_earned}）\n`;
            } else {
                body += `❌ 账号执行失败\n`;
            }
            body += `\n`;
        }
        
        try {
            let pushRes = await new Promise(resolve => {
                $.post({
                    url: bark_url,
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ "title": "🚚 顺丰速运签到结果\n", "body": body.trim(), "icon": BARK_ICON, "group": BARK_GROUP })
                }, (err, resp, data) => resolve(resp));
            });
            if (pushRes && pushRes.status === 200) console.log(`✅ Bark推送成功`);
            else console.log(`⚠️ Bark推送失败，状态码: ${pushRes ? pushRes.status : '未知'}`);
        } catch (e) { console.log(`❌ Bark推送异常: ${e.message}`); }
    } else {
        if (!BARK_PUSH) console.log("\n📱 未配置BARK_PUSH，跳过推送");
        else if (PUSH_SWITCH !== "1") console.log("\n📱 推送开关已关闭，跳过推送");
    }
}

// 启动执行
main().catch(e => console.log(e)).finally(() => $.done());


// ==================== MD5 加密库注入 ====================
function require_md5() {
    return function Crypto_MD5(s) {
        var k=[],i,j,b=[1732584193,4023233417,2562383102,271733878],s_=[7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
        for(i=0;i<64;i++)k[i]=Math.floor(Math.abs(Math.sin(i+1))*4294967296);
        var l=s.length,n=l+8,m=((n-(n%64))/64+1)*16,p=new Array(m*4).fill(0);
        for(i=0;i<l;i++)p[i]=s.charCodeAt(i);p[l]=128;p[m*4-4]=l*8&255;p[m*4-3]=(l*8>>>8)&255;p[m*4-2]=(l*8>>>16)&255;p[m*4-1]=(l*8>>>24)&255;
        const add=(x,y)=>(x+y)>>>0, rot=(x,s)=>(x<<s)|(x>>>(32-s));
        for(i=0;i<m;i+=16){
            let [a,c,d,e]=b, f, g;
            for(j=0;j<64;j++){
                if(j<16){f=(c&d)|(~c&e);g=j}else if(j<32){f=(e&c)|(~e&d);g=(5*j+1)%16}else if(j<48){f=c^d^e;g=(3*j+5)%16}else{f=d^(c|~e);g=(7*j)%16}
                let x = p[i*4+g*4]|p[i*4+g*4+1]<<8|p[i*4+g*4+2]<<16|p[i*4+g*4+3]<<24;
                let t=add(add(add(a,f),k[j]),x);
                [e,a,c,d]=[d,add(c,rot(t,s_[j])),c,d];
            }
            b=[add(b[0],a),add(b[1],c),add(b[2],d),add(b[3],e)];
        }
        return b.map(x=>x.toString(16).padStart(8,'0')).join('');
    };
}


// ==================== 你提供的 Env 运行环境代码 ====================
function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),n={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(n,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Routing":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Routing":!1})),$httpClient.post(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="POST",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.post(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}else e(null,null,null)}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()?$notify(e,s,i,o(r)):this.isNode()),!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}
