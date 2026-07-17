/**
 * 静态反混淆版本：字符串、索引、包装器和语义名均由静态分析推断。
 * 除场景模块外，本文件以保留原始运行行为为目标。
 * 场景模块已根据 2026-07-17 的脱敏 HAR 与 Quantumult X 原生会话更新为当前 skillBuilder 流程。
 */

/*
new Env('阿里云社区');
@Author: Leiyiyan
@Date: 2024-09-11 18:30

@Description:
阿里云社区: 完成签到、点赞、分享、评论、收藏、场景、视频等每日任务，积分可兑换实物。

获取 Cookie 方式: 阿里云 APP - 首页 - 积分商城

变量名:  aliyunWeb_data(Cookie)
        aliyunWeb_time(时间)
        aliyunWeb_scene(场景：true/false)
        aliyunWeb_stock(库存：true/false)
        aliyunWeb_video(视频：true/false)

注意事项 - 因文章评论需要审核，所以请按推荐时间执行: 
   12点前执行一次: 签到、点赞、收藏、分享、评论；
   12点后执行一次: 积分收取、取消点赞、取消收藏；
   如需自定义时间，请修改 aliyunWeb_time 变量值，取值范围为 1-23 之间的整数
------------------------------------------------------------------------------
BoxJs订阅地址: 
https://raw.githubusercontent.com/leiyiyan/resource/main/subscribe/leiyiyan.boxjs.json

[Script]
http-response ^https?:\/\/developer\.aliyun\.com\/developer\/api\/my\/user\/getUser script-path=https://raw.githubusercontent.com/leiyiyan/resource/main/script/aliyun_web/aliyun_web.js, requires-body=true, timeout=60, tag=阿里云Web Cookie
cron "0 7,13 * * *" script-path=https://raw.githubusercontent.com/leiyiyan/resource/main/script/aliyun_web/aliyun_web.js, tag=阿里云社区日常任务

[MITM]
hostname = developer.aliyun.com

====================================
⚠️【免责声明】
------------------------------------------
1、此脚本仅用于学习研究，不保证其合法性、准确性、有效性，请根据情况自行判断，本人对此不承担任何保证责任。
2、由于此脚本仅用于学习研究，您必须在下载后 24 小时内将所有内容从您的计算机或手机或任何存储设备中完全删除，若违反规定引起任何事件本人对此均不负责。
3、请勿将此脚本用于任何商业或非法目的，若违反规定请自行对此负责。
4、此脚本涉及应用与本人无关，本人对因此引起的任何隐私泄漏或其他后果不承担任何责任。
5、本人对任何脚本引发的问题概不负责，包括但不限于由脚本错误引起的任何损失和损害。
6、如果任何单位或个人认为此脚本可能涉嫌侵犯其权利，应及时通知并提供身份证明，所有权证明，我们将在收到认证文件确认后删除此脚本。
7、所有直接或间接使用、查看此脚本的人均应该仔细阅读此声明。本人保留随时更改或补充此声明的权利。一旦您使用或复制了此脚本，即视为您已接受此免责声明。
 */

/* String-table bootstrap removed after static decoding: 240 left rotations. */
const SCENE_TEST_MODE = typeof process !== "undefined" && process?.env?.ALIYUN_WEB_TEST_MODE === "1";

const $ = new Env("阿里云社区"),
  ckName = "aliyunWeb_data",
  controlTime = ($.isNode() ? process.env.aliyunWeb_time : $.getdata('aliyunWeb_time')) || '12',
  controlScene = ($.isNode() ? process.env.aliyunWeb_scene : $.getdata("aliyunWeb_scene")) || "false",
  controlStock = ($.isNode() ? process.env.aliyunWeb_stock : $.getdata("aliyunWeb_stock")) || "false",
  controlVideo = ($.isNode() ? process.env.aliyunWeb_video : $.getdata("aliyunWeb_video")) || "false",
  Notify = 1,
  notify = $.isNode() && !SCENE_TEST_MODE ? require("./sendNotify") : {
    sendNotify: async () => {}
  };
let envSplitor = ['@'];
var userCookie = ($.isNode() ? process.env[ckName] : $.getdata(ckName)) || '';
let userList = [],
  userIdx = 0,
  userCount = 0;
const taskGroup = [{
  'code': '',
  'name': '我的社区'
}, {
  'code': 'ecs',
  'name': '弹性计算'
}, {
  'code': 'computenest',
  'name': '计算巢'
}, {
  'code': 'yitian',
  'name': '倚天'
}, {
  'code': 'wuying',
  'name': '无影'
}, {
  'code': "cloudnative",
  'name': '云原生'
}, {
  'code': "storage",
  'name': '云存储'
}, {
  'code': "luoshen",
  'name': "飞天洛神云网络"
}, {
  'code': 'database',
  'name': "数据库"
}, {
  'code': 'polardb',
  'name': "PolarDB开源"
}, {
  'code': "bigdata",
  'name': "大数据与机器学习"
}, {
  'code': 'modelscope',
  'name': "ModelScope模型即服务"
}, {
  'code': "viapi",
  'name': '视觉智能'
}, {
  'code': 'dns',
  'name': "域名解析DNS"
}, {
  'code': 'iot',
  'name': "物联网"
}, {
  'code': "devops",
  'name': "云效DevOps"
}, {
  'code': 'aliyun_linux',
  'name': "龙蜥操作系统"
}, {
  'code': "modelstudio",
  'name': "百炼大模型"
}, {
  'code': 'tongyi',
  'name': "通义大模型"
}];
$.is_debug = ($.isNode() ? process.env.IS_DEDUG : $.getdata("is_debug")) || "false", $.notifyList = [], $.notifyMsg = [];
let pendingScore = 0,
  userScore = 0;

const SCENE_API_BASE = "https://developer.aliyun.com/adc/api/skillBuilder",
  SCENE_WEB_BASE = "https://www.aliyun.com",
  SCENE_LANGUAGE = "zh-CN",
  SCENE_APP_SITE = "technology_solutions",
  SCENE_LIST_PAGE_SIZE = 100,
  SCENE_MAX_ATTEMPTS = 3,
  SCENE_RECORD_POLL_ATTEMPTS = 15,
  SCENE_DEPLOY_POLL_ATTEMPTS = 120,
  SCENE_POLL_INTERVAL_MS = 3000;

function readCookieValue(cookie, name) {
  for (const part of String(cookie || "").split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex < 0) continue;
    const key = part.slice(0, separatorIndex).trim();
    if (key === name) return part.slice(separatorIndex + 1);
  }
  return "";
}

function selectSceneCandidates(response) {
  const records = response?.data?.records || response?.records || [];
  return records
    .filter((record) => record?.freeModeEnabled === true && record?.id && record?.targetId)
    .sort(() => Math.random() - 0.5);
}

function findActiveExperienceRecord(response, expectedSceneId) {
  const records = response?.data?.records || response?.records || [];
  return records.find((record) =>
    record?.id &&
    String(record?.sceneId) === String(expectedSceneId) &&
    String(record?.expMode || "").toUpperCase() === "FREE" &&
    record?.inExperiencing !== false
  ) || null;
}

function getCurrentExperienceRecord(response, expectedSceneId) {
  const record = response?.data?.userExperienceRecord;
  if (
    !record?.id ||
    String(record?.sceneId) !== String(expectedSceneId) ||
    String(record?.expMode || "").toUpperCase() !== "FREE"
  ) return null;
  return record;
}

function classifyDeployProcess(data) {
  const createStatus = data?.createStatus || "";
  const releaseStatus = data?.releaseStatus || "";
  if (createStatus === "CREATE_SUCCESS" || createStatus === "NO_NEED_TO_CREATE") return "ready";
  if (
    createStatus === "CREATE_FAILED" ||
    releaseStatus === "RELEASE_FAILED" ||
    (releaseStatus === "RELEASE_SUCCESS" && createStatus !== "CREATE_SUCCESS")
  ) return "failed";
  return "pending";
}
async function main() {
  try {
    $.log("\n================== 任务 ==================\n");
    for (const account of userList) {
      console.log("🔷账号" + account.index + " >> Start work");
      console.log("随机延迟" + account.getRandomTime() + "秒");

      const now = Date.now();
      userScore = await account.interactData() ?? {};

      if (account.ckStatus) {
        const cutoff = new Date(new Date().setHours(Math.floor(controlTime), 0, 0, 0)).getTime();
        if (now < cutoff) {
          for (const group of taskGroup) {
            const signInGroupId = await account.getUserSpaceSignInDetail(group.code);
            const signInTask = await account.getTasks(signInGroupId);
            await account.signin(signInTask, group.name);
            await $.wait(account.getRandomTime());

            const bonusAvailable = await account.assessSignInBonusQualification(signInGroupId, group.name);
            await $.wait(account.getRandomTime());
            if (bonusAvailable) {
              await account.receiveSignInBonus(signInGroupId, group.name);
              await $.wait(account.getRandomTime());
            }
          }

          const ebookId = await account.getEbooks();
          await $.wait(account.getRandomTime());
          const ebookCsrf = await account.getCsrfToken(ebookId, "ebook");
          await $.wait(account.getRandomTime());
          await account.addBookComment(ebookId, ebookCsrf);
          await $.wait(account.getRandomTime());

          for (let articleIndex = 0; articleIndex < 5; articleIndex++) {
            const articleId = await account.getArticles();
            await $.wait(account.getRandomTime());
            await account.likeOrNotLike(articleId, "aliyun-public-like", 0);
            await $.wait(account.getRandomTime());
            await account.likeOrNotLike(articleId, "aliyun-public-favorite", 0);
            await $.wait(account.getRandomTime());

            if (articleIndex === 0) {
              await account.addComment(articleId);
              await $.wait(account.getRandomTime());
              await account.likeOrNotLike(articleId, "aliyun-public-share", 0);
              await $.wait(account.getRandomTime());
            }

            const question = await account.getAsks();
            await $.wait(account.getRandomTime());
            if (question && question?.id) {
              const questionCsrf = await account.getCsrfToken(question.id, "ask");
              await $.wait(account.getRandomTime());
              const answerId = await account.getAskDetail(question);
              await $.wait(account.getRandomTime());
              if (answerId) {
                await account.voteAnswer(question.id, answerId, questionCsrf, 1);
                await $.wait(account.getRandomTime());
              }
            }
          }

          if (JSON.parse(controlScene)) {
            await account.doScene();
            await $.wait(account.getRandomTime());
          }
          if (JSON.parse(controlVideo)) {
            await account.playVideo();
            await $.wait(account.getRandomTime());
          }
          if (JSON.parse(controlStock)) await account.getGroupItems();

          pendingScore = await account.getUserTotalPendingScore();
          $.title = "获得待领取积分: " + pendingScore;
          DoubleLog("🎉 当前积分: " + userScore + ", 待领取积分: " + pendingScore);
        } else {
          for (const group of taskGroup) {
            const signInGroupId = await account.getUserSpaceSignInDetail(group.code);
            const bonusAvailable = await account.assessSignInBonusQualification(signInGroupId, group.name);
            await $.wait(account.getRandomTime());
            if (bonusAvailable) {
              await account.receiveSignInBonus(signInGroupId, group.name);
              await $.wait(account.getRandomTime());
            }
          }

          pendingScore = await account.getUserTotalPendingScore();
          await $.wait(account.getRandomTime());
          await account.collect();
          await $.wait(account.getRandomTime());
          await $.wait(account.getRandomTime());

          const favorites = await account.getFavors() ?? [];
          await $.wait(account.getRandomTime());
          if (favorites.length) {
            for (const favorite of favorites) {
              await account.likeOrNotLike(favorite.objectId, "aliyun-public-like", 1);
              await $.wait(account.getRandomTime());
              await account.likeOrNotLike(favorite.objectId, "aliyun-public-favorite", 1);
              await $.wait(account.getRandomTime());
            }
          }

          if (JSON.parse(controlStock)) await account.getGroupItems();
          const currentScore = await account.interactData() ?? {};
          $.title = "本次运行共获得" + (pendingScore || 0) + "积分";
          DoubleLog("🎉 领取积分: " + pendingScore + ", 当前积分: " + currentScore);
        }
      } else {
        $.notifyMsg.push("⛔️ 账号" + (account.userName || account.index) + " >> Check ck error!");
      }

      $.notifyList.push({
        id: account.index,
        avatar: account.avatar,
        message: $.notifyMsg
      });
      $.notifyMsg = [];
    }
  } catch (error) {
    $.log("⛔️ main run error => " + error);
    throw new Error("⛔️ main run error => " + error);
  }
}
class UserInfo {
  constructor(accountData) {
    this.index = ++userIdx;
    this.token = accountData.token || accountData;
    this.userId = accountData.userId;
    this.userName = accountData.userName;
    this.avatar = accountData.avatar;
    this.ckStatus = true;
    this.baseUrl = "";
    this.host = "https://developer.aliyun.com/developer/api";
    this.headers = {
      Cookie: this.token,
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Referer: "https://developer.aliyun.com/",
    };
    this.getRandomTime = () => randomInt(1, 2);
    this.fetch = async (requestOptions) => {
      try {
        if (typeof requestOptions === "string") requestOptions = {
          url: requestOptions
        };
        if (requestOptions?.url?.startsWith("/")) requestOptions.url = this.host + requestOptions.url;
        const response = await Request({
          ...requestOptions,
          headers: requestOptions.headers || this.headers,
          url: requestOptions.url || this.baseUrl,
        });
        debug(
          response,
          requestOptions?.url?.replace(/\/+$/, "").substring(requestOptions?.url?.lastIndexOf("/") + 1),
        );
        if (response?.code == 40001) throw new Error(response?.message || "用户需要去登录");
        return response;
      } catch (error) {
        this.ckStatus = false;
        $.log("⛔️ 请求发起失败！" + error);
      }
    };
  }
  async getUser() {
    try {
      const requestOptions = {
        'url': "/my/user/getUser",
        'type': "get"
      };
      await this.fetch(requestOptions);
    } catch (error) {
      this.ckStatus = false, $.log("⛔️ 获取签到任务列表失败! " + error);
    }
  }
  async assessSignInBonusQualification(taskGroupId, groupName) {
    if (!taskGroupId) return null;
    try {
      const requestOptions = {
        'url': "/sign/assessSignInBonusQualification",
        'type': "get",
        'params': {
          'taskGroupId': taskGroupId
        }
      };
      let response = await this.fetch(requestOptions);
      return response?.data;
    } catch (error) {
      this.ckStatus = false, $.log('⛔️\x20查询领奖条件失败!\x20' + error);
    }
  }
  async receiveSignInBonus(taskGroupId, groupName) {

    try {
      const requestOptions = {
        'url': "/sign/receiveSignInBonus",
        'type': "post",
        'dataType': "form",
        'body': {
          'taskGroupId': taskGroupId
        }
      };
      let response = await this.fetch(requestOptions);
      if (response?.code == "200") {
        const points = response?.data || 0;
        $.log("✅ 抽奖 - " + (groupName || "default") + ':\x20获得\x20' + points + " 积分");
      } else $.log("⛔️ 抽奖 - " + (groupName || "default") + ':\x20' + response?.message);
    } catch (error) {
      this.ckStatus = false, $.log('⛔️\x20抽奖失败!\x20' + error);
    }
  }
  async getUserSpaceSignInDetail(excode) {

    try {
      const requestOptions = {
        'url': "/sign/getUserSpaceSignInDetail",
        'type': 'get',
        'params': {
          'excode': excode
        }
      };
      let response = await this.fetch(requestOptions);
      const taskGroupId = response?.data?.taskGroupId || null;
      return taskGroupId;
    } catch (error) {
      this.ckStatus = false, $.log("⛔️ 获取签到任务列表失败! " + error);
    }
  }
  async getTasks(groupId) {

    if (!groupId) return null;
    try {
      const requestOptions = {
        'url': "/task/getTaskGroup?groupId=" + groupId,
        'type': 'get'
      };
      let response = await this.fetch(requestOptions);
      const taskList = response?.data?.taskList;
      let taskAction = {};
      if (taskList.length) {
        const now = new Date().getTime();
        for (let taskDefinition of taskList) {
          if (now >= taskDefinition.gmtEnableStart && now <= taskDefinition.gmtEnableEnd) {
            const finishRule = JSON.parse(taskDefinition.finishRule.replace(/&quot;/g, '\x22'));
            taskAction.actionCode = finishRule.actions[0].actionCode, taskAction.activityCode = finishRule.actions[0].actionCode, taskAction.objectId = finishRule.actions[0].objectId;
          }
        }
      }
      return taskAction;
    } catch (error) {
      this.ckStatus = false, $.log("⛔️ 获取签到任务列表失败! " + error);
    }
  }
  async signin(task, groupName) {

    if (!task) {
      $.log('✅\x20签到\x20-\x20' + (groupName || "default") + ": 该社区无签到任务");
      return;
    }
    try {
      const requestOptions = {
        'url': "/task/actionLog",
        'type': "post",
        'dataType': "form",
        'body': task
      };
      let response = await this.fetch(requestOptions);
      $.log("✅ 签到 - " + (groupName || "default") + ':\x20' + response?.message);
    } catch (error) {
      this.ckStatus = false, $.log("⛔️ 签到失败! " + error);
    }
  }
  async getArticles() {
    try {
      const pageNum = Math.floor(Math.random() * 31) + 1;
      const html = await this.fetch({
        url: "https://developer.aliyun.com/group/aliware/article_hot?pageNum=" + pageNum,
        type: "get",
      });
      const $page = $.Cheerio.load(html);
      const content = $page(".community-detail-content");
      const articles = content.find(".community-list").map((index, element) => ({
        id: $page(element).find(".feed-item").attr("data-id"),
        name: $page(element).find(".feed-item-content-title h3").text(),
      })).get();
      const article = articles[Math.floor(Math.random() * articles.length)];
      const {
        id: articleId,
        name: articleTitle
      } = article;
      $.log("✅ 随机获取文章id: " + articleId + ", 标题: " + articleTitle);
      return articleId;
    } catch (error) {
      this.ckStatus = false;
      $.log("⛔️ 获取文章列表失败! " + error);
    }
  }
  async getEbooks() {
    try {
      const pageNum = Math.floor(Math.random() * 501) + 1;
      const html = await this.fetch({
        url: "https://developer.aliyun.com/ebook/index/__0_0_0_" + pageNum,
        type: "get",
      });
      const $page = $.Cheerio.load(html);
      const ebookList = $page(".ebook-home-list");
      const ebooks = ebookList.find(".ebook-home-item").map((index, element) => ({
        id: $page(element).attr("href").replace("/ebook/", ""),
        name: $page(element).find(".ebook-home-title").text(),
      })).get();
      const ebook = ebooks[Math.floor(Math.random() * ebooks.length)];
      const {
        id: ebookId,
        name: ebookTitle
      } = ebook;
      $.log("✅ 随机电子书id: " + ebookId + ", 标题: " + ebookTitle);
      return ebookId;
    } catch (error) {
      this.ckStatus = false;
      $.log("⛔️ 获取电子书列表失败! " + error);
    }
  }
  async getAsks() {
    try {
      const pageNum = Math.floor(Math.random() * 31) + 1;
      const html = await this.fetch({
        url: "https://developer.aliyun.com/ask?pageNum=" + pageNum,
        type: "get",
      });
      const $page = $.Cheerio.load(html);
      const questionList = $page(".askProduct-list");
      const questions = questionList.find(".askProduct-item").map((index, element) => ({
        id: $page(element).attr("data-id") || "",
        name: $page(element).find(".askProduct-item-title-text h3").text() || "",
        answer: parseInt($page(element).find(".askProduct-item-info-answer").text()) || "",
      })).filter((index, question) => question.answer > 0).get();
      const question = questions[Math.floor(Math.random() * questions.length)];
      if (question?.id && question?.name) {
        const {
          id: questionId,
          name: questionTitle
        } = question;
        $.log("✅ 随机获取问答id: " + questionId + ", 标题: " + questionTitle);
        return question;
      }
      return null;
    } catch (error) {
      this.ckStatus = false;
      $.log("⛔️ 获取问答列表失败! " + error);
    }
  }
  async getAskDetail(question) {
    try {
      const html = await this.fetch({
        url: "https://developer.aliyun.com/ask/" + question.id,
        type: "get"
      });
      const $page = $.Cheerio.load(html);
      const answerList = $page(".answer-list");
      const answers = answerList.find(".answer-item").map((index, element) => ({
        id: $page(element).attr("data-id") || "",
      })).get();
      const answer = answers[Math.floor(Math.random() * question.answer)];
      if (answer) {
        const {
          id: answerId
        } = answer;
        $.log("✅ 随机获取问题问答id: " + answerId);
        return answerId;
      }
      return null;
    } catch (error) {
      this.ckStatus = false;
      $.log("⛔️ 随机获取问题问答失败! " + error);
    }
  }
  async likeOrNotLike(objectId, actionCode, status) {

    try {
      const requestOptions = {
        'url': "https://ucc.aliyun.com/uccPagingComponent/likeOrNotLike",
        'type': "get",
        'params': {
          'bizCategory': "yq-article",
          'actionCode': actionCode,
          'objectId': objectId,
          'status': status,
          'uccCsrfToken': await this.getUccCsrfToken(),
          'callback': getCallback()
        }
      };
      await this.fetch(requestOptions);
      let actionDescription = '文章' + (status === 1 ? '取消' : '');
      if (actionCode === "aliyun-public-like") actionDescription += '点赞';
      else {
        if (actionCode === "aliyun-public-favorite") actionDescription += '收藏';
        else actionCode === "aliyun-public-share" && (actionDescription += '分享');
      }
      $.log('✅\x20' + actionDescription + "成功: " + objectId);
    } catch (error) {
      this.ckStatus = false, $.log("⛔️ " + taskType + '失败!\x20' + error);
    }
  }
  async getCsrfToken(objectId, section) {

    try {
      const requestOptions = {
          'url': "https://developer.aliyun.com/csrfToken",
          'type': "get",
          'headers': {
            'Cookie': this.token,
            'User-Agent': "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 AliApp(Aliyun/6.7.1) WindVane/8.7.2 1170x2532 WK",
            'Referer': 'https://developer.aliyun.com/' + section + '/' + objectId
          }
        },
        csrfResponse = await this.fetch(requestOptions);
      return csrfResponse?.token;
    } catch (error) {
      this.ckStatus = false, $.log('⛔️\x20获取\x20csrf\x20失败!\x20' + error);
    }
  }
  async voteAnswer(questionId, answerId, csrfToken, votes) {

    try {
      const requestOptions = {
        'url': 'https://developer.aliyun.com/developer/api/my/ask/voteAnswer',
        'type': "post",
        'dataType': "form",
        'headers': {
          'Cookie': this.token,
          'User-Agent': "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 AliApp(Aliyun/6.7.1) WindVane/8.7.2 1170x2532 WK",
          'Referer': 'https://developer.aliyun.com/ask/' + questionId
        },
        'params': {
          'p_csrf': csrfToken
        },
        'body': {
          'id': answerId,
          'votes': votes
        }
      };
      await this.fetch(requestOptions), $.log("✅ 回答点赞: " + questionId + '-' + answerId);
    } catch (error) {
      this.ckStatus = false, $.log("⛔️ 回答点赞失败! " + error);
    }
  }
  async addBookComment(ebookId, csrfToken) {

    try {
      const requestOptions = {
          'url': "https://developer.aliyun.com/developer/api/ebook/mark/add",
          'type': "post",
          'dataType': 'json',
          'headers': {
            'Cookie': this.token,
            'User-Agent': "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 AliApp(Aliyun/6.7.1) WindVane/8.7.2 1170x2532 WK",
            'Referer': "https://developer.aliyun.com/ebook/" + ebookId
          },
          'params': {
            'p_csrf': csrfToken
          },
          'body': {
            'eBookId': ebookId,
            'score': 10,
            'content': '很棒的一本书'
          }
        },
        response = await this.fetch(requestOptions);
      response?.code == "200" ? $.log('✅\x20评价电子书:\x20' + ebookId) : $.log('⛔️\x20评价电子书失败!\x20' + response?.message);
    } catch (error) {
      this.ckStatus = false, $.log('⛔️\x20评价电子书失败!\x20' + error);
    }
  }
  async getFavors() {

    try {
      const requestOptions = {
          'url': "https://developer.aliyun.com/developer/api/my/subscribe/listUserFavor",
          'type': "get",
          'params': {
            'pageNum': 1,
            'pageSize': 10,
            'type': 1
          }
        },
        response = await this.fetch(requestOptions),
        {
          list: favorites
        } = response?.data;
      if (favorites.length) return $.log("✅ 开始取消文章的点赞与收藏记录"), favorites;
      return [];
    } catch (error) {
      this.ckStatus = false, $.log("⛔️ " + (type === "aliyun-public-like" ? "文章点赞" : "文章收藏") + "失败! " + error);
    }
  }
  async addComment(articleId) {

    try {
      const requestOptions = {
        'url': "https://ucc.aliyun.com/uccPagingComponent/addComment",
        'type': "get",
        'params': {
          'content': encodeURIComponent("很有用的文章，非常受用，感谢博主"),
          'objectId': articleId,
          'bizCategory': "yq-comment-type-article",
          'commentType': 0,
          'sourceAppCode': "developer-ecology",
          'sourceBizCategory': "developer-ecology-group",
          'uccCsrfToken': await this.getUccCsrfToken(),
          'callback': getCallback()
        }
      };
      await this.fetch(requestOptions), $.log("✅ 文章评论: " + articleId);
    } catch (error) {
      this.ckStatus = false, $.log("⛔️ 文章点赞失败! " + error);
    }
  }
  async doScene() {
    try {
      const candidates = await this.getSceneCandidates();
      if (!candidates.length) {
        $.log("⛔️ 没有找到可用的免费场景");
        return false;
      }
      for (let attempt = 0; attempt < Math.min(SCENE_MAX_ATTEMPTS, candidates.length); attempt++) {
        const scene = candidates[attempt];
        $.log("🚀 场景尝试 " + (attempt + 1) + "/" + Math.min(SCENE_MAX_ATTEMPTS, candidates.length) + ": " + (scene.name || "未命名场景"));
        if (await this.runScene(scene)) return true;
        if (attempt + 1 < Math.min(SCENE_MAX_ATTEMPTS, candidates.length)) await this.sceneWait(SCENE_POLL_INTERVAL_MS);
      }
      $.log("⛔️ 本次没有完成可用场景");
      return false;
    } catch (error) {
      $.log("⛔️ 场景流程失败! " + error);
      return false;
    }
  }
  buildSceneHeaders(referer, extraHeaders = {}) {
    return {
      'Accept': "application/json, text/plain, */*",
      'Cookie': this.token,
      'Origin': SCENE_WEB_BASE,
      'Referer': referer,
      'User-Agent': this.headers["User-Agent"],
      ...extraHeaders
    };
  }
  async sceneWait(milliseconds) {
    return await $.wait(milliseconds);
  }
  async getSceneCandidates() {
    const response = await this.fetch({
      'url': SCENE_API_BASE + "/pageListDeployInfo",
      'type': "get",
      'params': {
        'page': 1,
        'pageSize': SCENE_LIST_PAGE_SIZE
      },
      'headers': this.buildSceneHeaders(SCENE_WEB_BASE + "/solution/free")
    });
    if (String(response?.code) !== "200") {
      $.log("⛔️ 获取当前场景列表失败: " + (response?.message || "无响应"));
      return [];
    }
    const candidates = selectSceneCandidates(response);
    $.log("✅ 找到 " + candidates.length + " 个免费场景候选");
    return candidates;
  }
  async runScene(scene) {
    const currentSceneId = scene.id;
    const deployUrl = SCENE_WEB_BASE + "/solution/tech-solution-deploy/" + scene.targetId;
    if (!await this.openSceneDeployPage(deployUrl)) return false;

    const pageInfo = await this.getScenePageInfo(currentSceneId, deployUrl);
    if (String(pageInfo?.code) !== "200" || pageInfo?.data?.freeModeEnabled !== true) {
      $.log("⛔️ 当前候选不支持免费体验，切换场景");
      return false;
    }

    await this.getSceneExtInfo(currentSceneId, deployUrl);
    await this.getSceneResourceTemplateInfo(currentSceneId, deployUrl);
    await this.checkSceneTokenStatus(deployUrl);
    await this.getSkillBuilderUserInfo(deployUrl);
    await this.getSkillBuilderUserToken(deployUrl);

    let recordsResponse = await this.listExperienceRecords(currentSceneId, deployUrl);
    let record = findActiveExperienceRecord(recordsResponse, currentSceneId);
    await this.getUserSceneExperienceInfo(currentSceneId, record?.id, deployUrl);

    if (!record) {
      await this.checkSceneTokenStatus(deployUrl);
      record = await this.waitForExperienceRecord(currentSceneId, deployUrl);
    }
    if (!record?.id) {
      $.log("⛔️ 等待体验记录超时，切换场景");
      return false;
    }

    await this.getUserSceneExperienceInfo(currentSceneId, record.id, deployUrl);
    await this.getExperienceInfo(record.id, deployUrl);
    const deployResult = await this.waitForDeployProcess(currentSceneId, record.id, deployUrl);
    if (deployResult !== "ready") {
      await this.stopExperienceByRecordId(record.id, deployUrl);
      return false;
    }

    await this.sceneWait(5000);
    return await this.stopExperienceByRecordId(record.id, deployUrl);
  }
  async openSceneDeployPage(deployUrl) {
    const html = await this.fetch({
      'url': deployUrl,
      'type': "get",
      'resultType': "data",
      'headers': {
        'Accept': "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        'Cookie': this.token,
        'Referer': SCENE_WEB_BASE + "/solution/free",
        'User-Agent': this.headers["User-Agent"]
      }
    });
    if (!html) {
      $.log("⛔️ 打开场景部署页失败");
      return false;
    }
    return true;
  }
  async getScenePageInfo(currentSceneId, deployUrl) {
    return await this.fetch({
      'url': SCENE_API_BASE + "/getScenePageInfo",
      'type': "get",
      'params': {
        'aliyun_lang': SCENE_LANGUAGE,
        'sceneId': currentSceneId
      },
      'headers': this.buildSceneHeaders(deployUrl)
    });
  }
  async getSceneExtInfo(currentSceneId, deployUrl) {
    return await this.fetch({
      'url': SCENE_API_BASE + "/getSceneExtInfo",
      'type': "get",
      'params': {
        'aliyun_lang': SCENE_LANGUAGE,
        'sceneId': currentSceneId
      },
      'headers': this.buildSceneHeaders(deployUrl)
    });
  }
  async getSceneResourceTemplateInfo(currentSceneId, deployUrl) {
    return await this.fetch({
      'url': SCENE_API_BASE + "/getSceneResourceTemplateInfo",
      'type': "get",
      'params': {
        'aliyun_lang': SCENE_LANGUAGE,
        'sceneId': currentSceneId,
        'expMode': "free"
      },
      'headers': this.buildSceneHeaders(deployUrl)
    });
  }
  async checkSceneTokenStatus(deployUrl) {
    const response = await this.fetch({
      'url': SCENE_API_BASE + "/checkTokenStatus",
      'type': "get",
      'params': {
        'aliyun_lang': SCENE_LANGUAGE,
        'appSite': SCENE_APP_SITE
      },
      'headers': this.buildSceneHeaders(deployUrl)
    });
    const received = response?.data?.status === "RECEIVED";
    if (String(response?.code) !== "200" && !received) {
      $.log("⛔️ 场景资格检查失败: " + (response?.message || "无响应"));
      return false;
    }
    return true;
  }
  async getSkillBuilderUserInfo(deployUrl) {
    return await this.fetch({
      'url': SCENE_API_BASE + "/getUserInfo",
      'type': "get",
      'params': {
        'aliyun_lang': SCENE_LANGUAGE
      },
      'headers': this.buildSceneHeaders(deployUrl)
    });
  }
  async getSkillBuilderUserToken(deployUrl) {
    return await this.fetch({
      'url': SCENE_API_BASE + "/getUserToken",
      'type': "get",
      'params': {
        'aliyun_lang': SCENE_LANGUAGE,
        'appSite': SCENE_APP_SITE
      },
      'headers': this.buildSceneHeaders(deployUrl)
    });
  }
  async listExperienceRecords(currentSceneId, deployUrl) {
    return await this.fetch({
      'url': SCENE_API_BASE + "/listExperienceRecord",
      'type': "get",
      'params': {
        'aliyun_lang': SCENE_LANGUAGE,
        'sceneId': currentSceneId,
        'appSite': SCENE_APP_SITE,
        'pageNum': 1,
        'pageSize': SCENE_LIST_PAGE_SIZE,
        'inExperiencing': 1,
        'expMode': "free"
      },
      'headers': this.buildSceneHeaders(deployUrl)
    });
  }
  async waitForExperienceRecord(currentSceneId, deployUrl) {
    for (let attempt = 0; attempt < SCENE_RECORD_POLL_ATTEMPTS; attempt++) {
      const response = await this.listExperienceRecords(currentSceneId, deployUrl);
      const record = findActiveExperienceRecord(response, currentSceneId);
      if (record?.id) {
        $.log("✅ 已获取动态体验记录");
        return record;
      }
      const experienceResponse = await this.getUserSceneExperienceInfo(currentSceneId, null, deployUrl);
      const currentRecord = getCurrentExperienceRecord(experienceResponse, currentSceneId);
      if (currentRecord?.id) {
        $.log("✅ 已从当前体验状态获取动态记录");
        return currentRecord;
      }
      if (attempt + 1 < SCENE_RECORD_POLL_ATTEMPTS) await this.sceneWait(SCENE_POLL_INTERVAL_MS);
    }
    return null;
  }
  async getUserSceneExperienceInfo(currentSceneId, recordId, deployUrl) {
    const params = {
      'aliyun_lang': SCENE_LANGUAGE,
      'sceneId': currentSceneId
    };
    if (recordId) params.recordId = recordId;
    params.expMode = "free";
    return await this.fetch({
      'url': SCENE_API_BASE + "/getUserSceneExperienceInfo",
      'type': "get",
      'params': params,
      'headers': this.buildSceneHeaders(deployUrl)
    });
  }
  async getExperienceInfo(recordId, deployUrl) {
    return await this.fetch({
      'url': SCENE_API_BASE + "/getExperienceInfo",
      'type': "get",
      'params': {
        'aliyun_lang': SCENE_LANGUAGE,
        'recordId': recordId
      },
      'headers': this.buildSceneHeaders(deployUrl)
    });
  }
  async getDeployProcess(currentSceneId, recordId, deployUrl) {
    return await this.fetch({
      'url': SCENE_API_BASE + "/getDeployProcess",
      'type': "get",
      'params': {
        'aliyun_lang': SCENE_LANGUAGE,
        'sceneId': currentSceneId,
        'recordId': recordId
      },
      'headers': this.buildSceneHeaders(deployUrl)
    });
  }
  async waitForDeployProcess(currentSceneId, recordId, deployUrl) {
    for (let attempt = 0; attempt < SCENE_DEPLOY_POLL_ATTEMPTS; attempt++) {
      const response = await this.getDeployProcess(currentSceneId, recordId, deployUrl);
      const state = classifyDeployProcess(response?.data);
      if (state === "ready") {
        $.log("✅ 场景资源创建完成");
        return state;
      }
      if (state === "failed") {
        const errorInfo = response?.data?.errorInfo || {};
        $.log("⛔️ 场景资源创建失败: " + (errorInfo.code || response?.data?.createStatus || "UNKNOWN") + " " + (errorInfo.message || ""));
        return state;
      }
      if (attempt + 1 < SCENE_DEPLOY_POLL_ATTEMPTS) await this.sceneWait(SCENE_POLL_INTERVAL_MS);
    }
    $.log("⛔️ 等待场景资源创建超时");
    return "timeout";
  }
  async getSceneCsrfToken(deployUrl) {
    const response = await this.fetch({
      'url': "https://developer.aliyun.com/csrfToken",
      'type': "get",
      'params': {
        'aliyun_lang': SCENE_LANGUAGE
      },
      'headers': this.buildSceneHeaders(deployUrl)
    });
    const responseToken = response?.token || "";
    const cookieToken = readCookieValue(this.token, "c_csrf");
    if (response?.parameterName && response.parameterName !== "p_csrf") {
      $.log("⛔️ 当前 CSRF 参数名不受支持");
      return "";
    }
    return responseToken || cookieToken;
  }
  async stopExperienceByRecordId(recordId, deployUrl) {
    const csrfToken = await this.getSceneCsrfToken(deployUrl);
    if (!csrfToken) {
      $.log("⛔️ 获取场景 CSRF 失败");
      return false;
    }
    const referer = deployUrl + "?recordId=" + encodeURIComponent(recordId) + "&mode=free";
    const response = await this.fetch({
      'url': SCENE_API_BASE + "/stopExperienceByRecordId",
      'type': "post",
      'dataType': "form",
      'params': {
        'p_csrf': csrfToken,
        'aliyun_lang': SCENE_LANGUAGE
      },
      'body': {
        'recordId': recordId
      },
      'headers': this.buildSceneHeaders(referer, {
        'Content-Type': "application/x-www-form-urlencoded;charset=UTF-8"
      })
    });
    const stopped = String(response?.code) === "200" && response?.success === true && response?.data === true;
    $.log((stopped ? "✅" : "⛔️") + " 结束场景: " + (response?.message || "无响应"));
    return stopped;
  }
  async getVideoDetail(liveId) {

    try {
      const timestamp = Date.now(),
        callback = getCallback(timestamp),
        requestOptions = {
          'url': "https://ucc.aliyun.com/api/ucc/live/open/detail",
          'type': "get",
          'params': {
            '_': timestamp,
            'callback': callback,
            'version': '1.1.23',
            'id': liveId
          },
          'headers': {
            'User-Agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            'Cookie': this.token,
            'Referer': "https://developer.aliyun.com/live/" + liveId
          }
        },
        response = await this.fetch(requestOptions),
        videoResponse = getJson(response),
        videoName = videoResponse?.data?.live?.name,
        videoDuration = videoResponse?.data?.live?.duration;
      return console.log("✅ 获取视频信息成功: " + videoName + ", 时长: " + videoDuration + '\x20秒'), {
        'videoName': videoName,
        'videoTime': videoDuration
      };
    } catch (error) {
      return this.ckStatus = false, $.log("⛔️ 获取视频信息失败! " + error), null;
    }
  }
  async getVideoView(liveId, sessionId) {

    try {
      const timestamp = Date.now(),
        callback = getCallback(timestamp),
        requestOptions = {
          'url': "https://ucc.aliyun.com/api/ucc/live/open/view",
          'type': "get",
          'params': {
            '_': timestamp,
            'callback': callback,
            'version': '1.1.23',
            'id': liveId,
            'sessionId': sessionId
          },
          'headers': {
            'User-Agent': 'Mozilla/5.0\x20(Macintosh;\x20Intel\x20Mac\x20OS\x20X\x2010_15_7)\x20AppleWebKit/537.36\x20(KHTML,\x20like\x20Gecko)\x20Chrome/125.0.0.0\x20Safari/537.36',
            'Cookie': this.token,
            'Referer': "https://developer.aliyun.com/live/" + liveId
          }
        };
      await this.fetch(requestOptions);
    } catch (error) {
      this.ckStatus = false, $.log("⛔️ 获取视频视图失败! " + error);
    }
  }
  async play(videoName, liveId, sessionId) {

    try {
      const timestamp = Date.now(),
        callback = getCallback(timestamp),
        requestOptions = {
          'url': "https://ucc.aliyun.com/api/ucc/live/open/play",
          'type': "get",
          'params': {
            '_': timestamp,
            'callback': callback,
            'version': "1.1.23",
            'id': liveId,
            'sessionId': sessionId
          },
          'headers': {
            'User-Agent': 'Mozilla/5.0\x20(Macintosh;\x20Intel\x20Mac\x20OS\x20X\x2010_15_7)\x20AppleWebKit/537.36\x20(KHTML,\x20like\x20Gecko)\x20Chrome/125.0.0.0\x20Safari/537.36',
            'Cookie': this.token,
            'Referer': "https://developer.aliyun.com/live/" + liveId
          }
        };
      await this.fetch(requestOptions), console.log("✅ 开始播放视频: " + videoName);
    } catch (error) {
      this.ckStatus = false, $.log("⛔️ 播放视频失败! " + error);
    }
  }
  async danmu(liveId, seekSeconds) {

    try {
      const timestamp = Date.now(),
        callback = getCallback(timestamp),
        requestOptions = {
          'url': 'https://ucc.aliyun.com/api/ucc/live/open/danmu',
          'type': "get",
          'params': {
            '_': timestamp,
            'callback': callback,
            'version': "1.1.23",
            'id': liveId,
            'seek': seekSeconds
          },
          'headers': {
            'User-Agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            'Cookie': this.token,
            'Referer': 'https://developer.aliyun.com/live/' + liveId
          }
        },
        response = await this.fetch(requestOptions),
        danmuResponse = getJson(response);
      console.log('✅\x20获取第\x20' + seekSeconds + " 秒弹幕: " + JSON.stringify(danmuResponse?.data));
    } catch (error) {
      this.ckStatus = false, $.log("⛔️ 获取弹幕失败! " + error);
    }
  }
  async online(liveId, sessionId) {

    try {
      const timestamp = Date.now(),
        callback = getCallback(timestamp),
        requestOptions = {
          'url': "https://ucc.aliyun.com/api/ucc/live/open/online",
          'type': "get",
          'params': {
            '_': timestamp,
            'callback': callback,
            'version': "1.1.23",
            'id': liveId,
            'sessionId': sessionId
          },
          'headers': {
            'User-Agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            'Cookie': this.token,
            'Referer': "https://developer.aliyun.com/live/" + liveId
          }
        };
      await this.fetch(requestOptions), console.log("✅ 在线心跳确认成功");
    } catch (error) {
      this.ckStatus = false, $.log("⛔️ 在线心跳确认! " + error);
    }
  }
  async playVideo() {
    const liveId = "253842";
    const sessionId = getSessionId(this.token, liveId);
    const {
      videoName,
      videoTime: videoDuration
    } = await this.getVideoDetail(liveId);
    await $.wait(this.getRandomTime());
    await this.getVideoView(liveId, sessionId);
    await $.wait(this.getRandomTime());
    await this.play(videoName, liveId, sessionId);
    await $.wait(this.getRandomTime());
    for (let seekSeconds = 3; seekSeconds < videoDuration; seekSeconds += 3) {
      await this.danmu(liveId, seekSeconds);
      await $.wait(3000);
      if (seekSeconds == 60) await this.online(liveId, sessionId);
    }
    console.log("✅ 视频播放完毕: " + videoName);
  }
  async getGroupItems() {

    try {
      const requestOptions = {
          'url': '/lm/getGroupItems?pageNum=1&pageSize=50',
          'type': 'get'
        },
        response = await this.fetch(requestOptions),
        {
          list: items
        } = response?.data;
      if (items.length) {
        $.log("✅ 开始查询库存:");
        for (let item of items) {
          $.log('🎁\x20' + item.itemTitle.replace(/【.*?】/g, '') + ':\x20' + item.points + " 分【" + item.statusStr + '】');
        }
      }
    } catch (error) {
      $.log("⛔️ 查询待收获积分列表失败! " + error);
    }
  }
  async interactData() {

    try {
      const requestOptions = {
        'url': '/my/score/getUserScore?appCode=developer',
        'type': "get"
      };
      let response = await this.fetch(requestOptions);
      return response?.data;
    } catch (error) {
      $.log("⛔️ 查询待收获积分列表失败! " + error);
    }
  }
  async getUserTotalPendingScore() {

    try {
      const requestOptions = {
        'url': "/score/pending/getUserTotalPendingScore?appCode=developer",
        'type': "get"
      };
      let response = await this.fetch(requestOptions);
      return $.log('✅\x20待领取积分:\x20' + response?.data), response?.data;
    } catch (error) {
      $.log("⛔️ 查询待领取积分失败! " + error);
    }
  }
  async collect() {

    try {
      const requestOptions = {
        'url': '/score/pending/receiveAllPendingScore?appCode=developer',
        'type': 'get'
      };
      let response = await this.fetch(requestOptions);
      return $.log("✅ 收取积分: " + response?.data), response?.data;
    } catch (error) {
      $.log("⛔️ 收取积分失败! " + error);
    }
  }
  async getUccCsrfToken() {

    try {
      const requestOptions = {
        'url': "https://ucc.aliyun.com/uccPagingComponent/getUser",
        'type': 'get',
        'params': {
          'uccCsrfToken': '',
          'callback': getCallback()
        }
      };
      let jsonpResponse = await this.fetch(requestOptions);
      const jsonStart = jsonpResponse.indexOf('{'),
        jsonEnd = jsonpResponse.lastIndexOf('}'),
        jsonText = jsonpResponse.substring(jsonStart, jsonEnd + 1),
        userResponse = JSON.parse(jsonText);
      return userResponse.data.uccCsrfToken;
    } catch (error) {
      $.log('⛔️\x20获取UccCsrfToken失败!\x20' + error);
    }
  }
}

function getCallback(timestamp) {
  timestamp = timestamp || Date.now();
  return "jsonp_" + timestamp + "_" + Math.ceil(100000 * Math.random());
}

function getJson(response) {
  return JSON.parse(response.replace(/.*\(/, "").replace(/\)/, ""));
}

function getSessionId(cookie, videoId) {
  function md5HexUtf8(input) {
    const bytes = Array.from(unescape(encodeURIComponent(input)), (char) => char.charCodeAt(0));
    const bitLength = bytes.length * 8;
    bytes.push(128);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const lowBits = bitLength >>> 0;
    const highBits = Math.floor(bitLength / 4294967296) >>> 0;
    for (let index = 0; index < 4; index++) bytes.push((lowBits >>> (index * 8)) & 255);
    for (let index = 0; index < 4; index++) bytes.push((highBits >>> (index * 8)) & 255);

    const shifts = [
      7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
      5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
      6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
    ];
    const constants = Array.from({
        length: 64
      }, (_, index) =>
      Math.floor(Math.abs(Math.sin(index + 1)) * 4294967296) >>> 0,
    );
    const rotateLeft = (value, shift) => (value << shift) | (value >>> (32 - shift));

    let stateA = 1732584193;
    let stateB = 4023233417;
    let stateC = 2562383102;
    let stateD = 271733878;
    for (let offset = 0; offset < bytes.length; offset += 64) {
      const words = Array.from({
        length: 16
      }, (_, index) => {
        const start = offset + index * 4;
        return (bytes[start] | (bytes[start + 1] << 8) | (bytes[start + 2] << 16) | (bytes[start + 3] << 24)) >>> 0;
      });
      let a = stateA,
        b = stateB,
        c = stateC,
        d = stateD;
      for (let round = 0; round < 64; round++) {
        let mixed, wordIndex;
        if (round < 16) {
          mixed = (b & c) | (~b & d);
          wordIndex = round;
        } else if (round < 32) {
          mixed = (d & b) | (~d & c);
          wordIndex = (5 * round + 1) % 16;
        } else if (round < 48) {
          mixed = b ^ c ^ d;
          wordIndex = (3 * round + 5) % 16;
        } else {
          mixed = c ^ (b | ~d);
          wordIndex = (7 * round) % 16;
        }
        const previousD = d;
        d = c;
        c = b;
        const sum = (a + mixed + constants[round] + words[wordIndex]) >>> 0;
        b = (b + rotateLeft(sum, shifts[round])) >>> 0;
        a = previousD;
      }
      stateA = (stateA + a) >>> 0;
      stateB = (stateB + b) >>> 0;
      stateC = (stateC + c) >>> 0;
      stateD = (stateD + d) >>> 0;
    }
    return [stateA, stateB, stateC, stateD]
      .flatMap((word) => [0, 8, 16, 24].map((shift) => (word >>> shift) & 255))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function getCookieValue(name) {
    for (const part of cookie.split(";")) {
      const fields = part.split("=");
      if (fields[0].trim() == name) return fields[1];
    }
    return null;
  }

  const cna = getCookieValue("cna") || "";
  return md5HexUtf8(cna + videoId + Date.now());
}
async function getCookie() {
  if ($request && $request.method === "OPTIONS") return;
  const headers = ObjectKeys2LowerCase($request.headers);
  const token = headers.cookie;
  const body = $.toObj($response.body);
  if (!body?.data) {
    $.msg($.name, "⛔️ 获取Cookie失败!", "");
    return;
  }
  const {
    nickname,
    avatar
  } = body.data;
  const account = {
    userId: nickname,
    avatar,
    token,
    userName: nickname
  };
  userCookie = userCookie ? JSON.parse(userCookie) : [];
  const accountIndex = userCookie.findIndex((item) => item.userId == account.userId);
  if (userCookie[accountIndex]) userCookie[accountIndex] = account;
  else userCookie.push(account);
  $.setjson(userCookie, ckName);
  $.msg($.name, "🎉" + account.userName + "更新token成功!", "");
}
async function loadModule() {
  try {
    $.Cheerio = await loadCheerio();
    return $.Cheerio ? true : false;
  } catch (error) {
    throw new Error("⛔️ loadModule run error => " + error);
  }
}
async function checkEnv() {
  try {
    const separator = envSplitor.find((candidate) => userCookie.includes(candidate)) || envSplitor[0];
    userCookie = $.toObj(userCookie) || userCookie.split(separator);
    userList.push(...userCookie.map((account) => new UserInfo(account)).filter(Boolean));
    userCount = userList.length;
    console.log("共找到" + userCount + "个账号");
    return true;
  } catch (error) {
    throw new Error("⛔️ checkEnv run error => " + error);
  }
}
async function Request(requestOptions) {
  if (typeof requestOptions === "string") requestOptions = {
    url: requestOptions
  };
  try {
    if (!requestOptions?.url) throw new Error("[发送请求] 缺少 url 参数");
    let {
      url,
      type,
      headers = {},
      body,
      params,
      dataType = "form",
      resultType = "data",
    } = requestOptions;
    const method = type ? type?.toLowerCase() : "body" in requestOptions ? "post" : "get";
    const finalUrl = url.concat(method === "post" ? "?" + $.queryStr(params) : "");
    const timeout = requestOptions.timeout ?
      $.isSurge() ? requestOptions.timeout / 1000 : requestOptions.timeout :
      10000;
    if (dataType === "json") headers["Content-Type"] = "application/json;charset=UTF-8";
    const serializedBody = body && dataType == "form" ? $.queryStr(body) : $.toStr(body);
    const finalOptions = {
      ...requestOptions,
      ...(requestOptions?.opts ? requestOptions.opts : {}),
      url: finalUrl,
      headers,
      ...(method === "post" && {
        body: serializedBody
      }),
      ...(method === "get" && params && {
        params
      }),
      timeout,
    };
    const requestPromise = $.http[method.toLowerCase()](finalOptions)
      .then((response) => resultType == "data" ?
        $.toObj(response.body) || response.body :
        $.toObj(response) || response)
      .catch((error) => $.log("⛔️ 请求发起失败！原因为: " + error));
    return Promise.race([
      new Promise((resolve, reject) => setTimeout(() => reject("当前请求已超时"), timeout)),
      requestPromise,
    ]);
  } catch (error) {
    console.log("⛔️ 请求发起失败！原因为: " + error);
  }
};

function randomInt(min, max) {
  return Math.round(Math.random() * (max - min) + min);
};

function DoubleLog(message) {
  if (message && $.isNode()) {
    console.log("" + message);
    $.notifyMsg.push("" + message);
  } else if (message) {
    console.log("" + message);
    $.notifyMsg.push("" + message);
  }
};

function debug(value, label = "debug") {
  if ($.is_debug === "true") {
    $.log("\n-----------" + label + "------------\n");
    $.log(typeof value == "string" ? value : $.toStr(value) || "debug error => t=" + value);
    $.log("\n-----------" + label + "------------\n");
  }
};
async function SendMsgList(notifyList) {
  await Promise.allSettled(notifyList?.map((item) => SendMsg(item.message.join("\n"), item.avatar)));
};
async function SendMsg(message, avatar) {
  if (!message) return;
  if (0 < Notify) {
    if ($.isNode()) await notify.sendNotify($.name, message);
    else $.msg($.name, $.title || "", message, {
      "media-url": avatar
    });
  } else {
    console.log(message);
  }
};

function ObjectKeys2LowerCase(headers) {
  headers = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return new Proxy(headers, {
    get(target, property, receiver) {
      return Reflect.get(target, property.toLowerCase(), receiver);
    },
    set(target, property, value, receiver) {
      return Reflect.set(target, property.toLowerCase(), value, receiver);
    },
  });
};
async function loadCheerio() {
  const cachedCode = ($.isNode() ? process.env.Cheerio_code : $.getdata("Cheerio_code")) || "";
  if (cachedCode && Object.keys(cachedCode).length) {
    console.log("✅" + $.name + ":缓存中存在Cheerio模块,跳过下载");
    (0, eval)(cachedCode);
    return createCheerio();
  }
  console.log("🚀" + $.name + ": 开始下载Cheerio模块");
  return new Promise(async (resolve) => {
    $.getScript("https://mirror.ghproxy.com/https://raw.githubusercontent.com/Yuheng0101/X/main/Utils/cheerio.js")
      .then((code) => {
        $.setdata(code, "Cheerio_code");
        (0, eval)(code);
        const cheerio = createCheerio();
        console.log("✅Cheerio模块加载成功,请继续");
        resolve(cheerio);
      });
  });
};
if (SCENE_TEST_MODE && typeof module !== "undefined") {
  module.exports = {
    readCookieValue,
    selectSceneCandidates,
    findActiveExperienceRecord,
    getCurrentExperienceRecord,
    classifyDeployProcess,
    UserInfo
  };
} else {
  !(async () => {
    if (typeof $request != "undefined") {
      await getCookie();
    } else {
      if (!await loadModule()) throw new Error("⛔️ 加载模块失败，请检查模块路径是否正常");
      if (!await checkEnv()) throw new Error("⛔️ 未检测到ck，请添加环境变量");
      if (userList.length > 0) await main();
    }
  })()
  .catch((error) => $.notifyMsg.push(error.message || error))
    .finally(async () => {
      await SendMsgList($.notifyList);
      $.done({
        ok: 1
      });
    });
}
/** ---------------------------------固定不动区域----------------------------------------- */
// prettier-ignore
//From chavyleung's Env.js
function Env(t, e) {
  class s {
    constructor(t) {
      this.env = t
    }
    send(t, e = "GET") {
      t = "string" == typeof t ? {
        url: t
      } : t;
      let s = this.get;
      return "POST" === e && (s = this.post), new Promise(((e, r) => {
        s.call(this, t, ((t, s, a) => {
          t ? r(t) : e(s)
        }))
      }))
    }
    get(t) {
      return this.send.call(this.env, t)
    }
    post(t) {
      return this.send.call(this.env, t, "POST")
    }
  }
  return new class {
    constructor(t, e) {
      this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.encoding = "utf-8", this.startTime = (new Date).getTime(), Object.assign(this, e), this.log("", `🔔${this.name}, 开始!`)
    }
    getEnv() {
      return "undefined" != typeof $environment && $environment["surge-version"] ? "Surge" : "undefined" != typeof $environment && $environment["stash-version"] ? "Stash" : "undefined" != typeof module && module.exports ? "Node.js" : "undefined" != typeof $task ? "Quantumult X" : "undefined" != typeof $loon ? "Loon" : "undefined" != typeof $rocket ? "Shadowrocket" : void 0
    }
    isNode() {
      return "Node.js" === this.getEnv()
    }
    isQuanX() {
      return "Quantumult X" === this.getEnv()
    }
    isSurge() {
      return "Surge" === this.getEnv()
    }
    isLoon() {
      return "Loon" === this.getEnv()
    }
    isShadowrocket() {
      return "Shadowrocket" === this.getEnv()
    }
    isStash() {
      return "Stash" === this.getEnv()
    }
    toObj(t, e = null) {
      try {
        return JSON.parse(t)
      } catch {
        return e
      }
    }
    toStr(t, e = null) {
      try {
        return JSON.stringify(t)
      } catch {
        return e
      }
    }
    getjson(t, e) {
      let s = e;
      if (this.getdata(t)) try {
        s = JSON.parse(this.getdata(t))
      } catch {}
      return s
    }
    setjson(t, e) {
      try {
        return this.setdata(JSON.stringify(t), e)
      } catch {
        return !1
      }
    }
    getScript(t) {
      return new Promise((e => {
        this.get({
          url: t
        }, ((t, s, r) => e(r)))
      }))
    }
    runScript(t, e) {
      return new Promise((s => {
        let r = this.getdata("@chavy_boxjs_userCfgs.httpapi");
        r = r ? r.replace(/\n/g, "").trim() : r;
        let a = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");
        a = a ? 1 * a : 20, a = e && e.timeout ? e.timeout : a;
        const [i, o] = r.split("@"), n = {
          url: `http://${o}/v1/scripting/evaluate`,
          body: {
            script_text: t,
            mock_type: "cron",
            timeout: a
          },
          headers: {
            "X-Key": i,
            Accept: "*/*"
          },
          timeout: a
        };
        this.post(n, ((t, e, r) => s(r)))
      })).catch((t => this.logErr(t)))
    }
    loaddata() {
      if (!this.isNode()) return {};
      {
        this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path");
        const t = this.path.resolve(this.dataFile),
          e = this.path.resolve(process.cwd(), this.dataFile),
          s = this.fs.existsSync(t),
          r = !s && this.fs.existsSync(e);
        if (!s && !r) return {};
        {
          const r = s ? t : e;
          try {
            return JSON.parse(this.fs.readFileSync(r))
          } catch (t) {
            return {}
          }
        }
      }
    }
    writedata() {
      if (this.isNode()) {
        this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path");
        const t = this.path.resolve(this.dataFile),
          e = this.path.resolve(process.cwd(), this.dataFile),
          s = this.fs.existsSync(t),
          r = !s && this.fs.existsSync(e),
          a = JSON.stringify(this.data);
        s ? this.fs.writeFileSync(t, a) : r ? this.fs.writeFileSync(e, a) : this.fs.writeFileSync(t, a)
      }
    }
    lodash_get(t, e, s = void 0) {
      const r = e.replace(/\[(\d+)\]/g, ".$1").split(".");
      let a = t;
      for (const t of r)
        if (a = Object(a)[t], void 0 === a) return s;
      return a
    }
    lodash_set(t, e, s) {
      return Object(t) !== t || (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce(((t, s, r) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[r + 1]) >> 0 == +e[r + 1] ? [] : {}), t)[e[e.length - 1]] = s), t
    }
    getdata(t) {
      let e = this.getval(t);
      if (/^@/.test(t)) {
        const [, s, r] = /^@(.*?)\.(.*?)$/.exec(t), a = s ? this.getval(s) : "";
        if (a) try {
          const t = JSON.parse(a);
          e = t ? this.lodash_get(t, r, "") : e
        } catch (t) {
          e = ""
        }
      }
      return e
    }
    setdata(t, e) {
      let s = !1;
      if (/^@/.test(e)) {
        const [, r, a] = /^@(.*?)\.(.*?)$/.exec(e), i = this.getval(r), o = r ? "null" === i ? null : i || "{}" : "{}";
        try {
          const e = JSON.parse(o);
          this.lodash_set(e, a, t), s = this.setval(JSON.stringify(e), r)
        } catch (e) {
          const i = {};
          this.lodash_set(i, a, t), s = this.setval(JSON.stringify(i), r)
        }
      } else s = this.setval(t, e);
      return s
    }
    getval(t) {
      switch (this.getEnv()) {
        case "Surge":
        case "Loon":
        case "Stash":
        case "Shadowrocket":
          return $persistentStore.read(t);
        case "Quantumult X":
          return $prefs.valueForKey(t);
        case "Node.js":
          return this.data = this.loaddata(), this.data[t];
        default:
          return this.data && this.data[t] || null
      }
    }
    setval(t, e) {
      switch (this.getEnv()) {
        case "Surge":
        case "Loon":
        case "Stash":
        case "Shadowrocket":
          return $persistentStore.write(t, e);
        case "Quantumult X":
          return $prefs.setValueForKey(t, e);
        case "Node.js":
          return this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0;
        default:
          return this.data && this.data[e] || null
      }
    }
    initGotEnv(t) {
      this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar))
    }
    get(t, e = (() => {})) {
      switch (t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"], delete t.headers["content-type"], delete t.headers["content-length"]), t.params && (t.url += "?" + this.queryStr(t.params)), void 0 === t.followRedirect || t.followRedirect || ((this.isSurge() || this.isLoon()) && (t["auto-redirect"] = !1), this.isQuanX() && (t.opts ? t.opts.redirection = !1 : t.opts = {
          redirection: !1
        })), this.getEnv()) {
        case "Surge":
        case "Loon":
        case "Stash":
        case "Shadowrocket":
        default:
          this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, {
            "X-Surge-Skip-Scripting": !1
          })), $httpClient.get(t, ((t, s, r) => {
            !t && s && (s.body = r, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, r)
          }));
          break;
        case "Quantumult X":
          this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, {
            hints: !1
          })), $task.fetch(t).then((t => {
            const {
              statusCode: s,
              statusCode: r,
              headers: a,
              body: i,
              bodyBytes: o
            } = t;
            e(null, {
              status: s,
              statusCode: r,
              headers: a,
              body: i,
              bodyBytes: o
            }, i, o)
          }), (t => e(t && t.error || "UndefinedError")));
          break;
        case "Node.js":
          let s = require("iconv-lite");
          this.initGotEnv(t), this.got(t).on("redirect", ((t, e) => {
            try {
              if (t.headers["set-cookie"]) {
                const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();
                s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar
              }
            } catch (t) {
              this.logErr(t)
            }
          })).then((t => {
            const {
              statusCode: r,
              statusCode: a,
              headers: i,
              rawBody: o
            } = t, n = s.decode(o, this.encoding);
            e(null, {
              status: r,
              statusCode: a,
              headers: i,
              rawBody: o,
              body: n
            }, n)
          }), (t => {
            const {
              message: r,
              response: a
            } = t;
            e(r, a, a && s.decode(a.rawBody, this.encoding))
          }))
      }
    }
    post(t, e = (() => {})) {
      const s = t.method ? t.method.toLocaleLowerCase() : "post";
      switch (t.body && t.headers && !t.headers["Content-Type"] && !t.headers["content-type"] && (t.headers["content-type"] = "application/x-www-form-urlencoded"), t.headers && (delete t.headers["Content-Length"], delete t.headers["content-length"]), void 0 === t.followRedirect || t.followRedirect || ((this.isSurge() || this.isLoon()) && (t["auto-redirect"] = !1), this.isQuanX() && (t.opts ? t.opts.redirection = !1 : t.opts = {
          redirection: !1
        })), this.getEnv()) {
        case "Surge":
        case "Loon":
        case "Stash":
        case "Shadowrocket":
        default:
          this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, {
            "X-Surge-Skip-Scripting": !1
          })), $httpClient[s](t, ((t, s, r) => {
            !t && s && (s.body = r, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, r)
          }));
          break;
        case "Quantumult X":
          t.method = s, this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, {
            hints: !1
          })), $task.fetch(t).then((t => {
            const {
              statusCode: s,
              statusCode: r,
              headers: a,
              body: i,
              bodyBytes: o
            } = t;
            e(null, {
              status: s,
              statusCode: r,
              headers: a,
              body: i,
              bodyBytes: o
            }, i, o)
          }), (t => e(t && t.error || "UndefinedError")));
          break;
        case "Node.js":
          let r = require("iconv-lite");
          this.initGotEnv(t);
          const {
            url: a, ...i
          } = t;
          this.got[s](a, i).then((t => {
            const {
              statusCode: s,
              statusCode: a,
              headers: i,
              rawBody: o
            } = t, n = r.decode(o, this.encoding);
            e(null, {
              status: s,
              statusCode: a,
              headers: i,
              rawBody: o,
              body: n
            }, n)
          }), (t => {
            const {
              message: s,
              response: a
            } = t;
            e(s, a, a && r.decode(a.rawBody, this.encoding))
          }))
      }
    }
    time(t, e = null) {
      const s = e ? new Date(e) : new Date;
      let r = {
        "M+": s.getMonth() + 1,
        "d+": s.getDate(),
        "H+": s.getHours(),
        "m+": s.getMinutes(),
        "s+": s.getSeconds(),
        "q+": Math.floor((s.getMonth() + 3) / 3),
        S: s.getMilliseconds()
      };
      /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length)));
      for (let e in r) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? r[e] : ("00" + r[e]).substr(("" + r[e]).length)));
      return t
    }
    queryStr(t) {
      let e = "";
      for (const s in t) {
        let r = t[s];
        null != r && "" !== r && ("object" == typeof r && (r = JSON.stringify(r)), e += `${s}=${r}&`)
      }
      return e = e.substring(0, e.length - 1), e
    }
    msg(e = t, s = "", r = "", a) {
      const i = t => {
        switch (typeof t) {
          case void 0:
            return t;
          case "string":
            switch (this.getEnv()) {
              case "Surge":
              case "Stash":
              default:
                return {
                  url: t
                };
              case "Loon":
              case "Shadowrocket":
                return t;
              case "Quantumult X":
                return {
                  "open-url": t
                };
              case "Node.js":
                return
            }
          case "object":
            switch (this.getEnv()) {
              case "Surge":
              case "Stash":
              case "Shadowrocket":
              default:
                return {
                  url: t.url || t.openUrl || t["open-url"]
                };
              case "Loon":
                return {
                  openUrl: t.openUrl || t.url || t["open-url"], mediaUrl: t.mediaUrl || t["media-url"]
                };
              case "Quantumult X":
                return {
                  "open-url": t["open-url"] || t.url || t.openUrl, "media-url": t["media-url"] || t.mediaUrl, "update-pasteboard": t["update-pasteboard"] || t.updatePasteboard
                };
              case "Node.js":
                return
            }
          default:
            return
        }
      };
      if (!this.isMute) switch (this.getEnv()) {
        case "Surge":
        case "Loon":
        case "Stash":
        case "Shadowrocket":
        default:
          $notification.post(e, s, r, i(a));
          break;
        case "Quantumult X":
          $notify(e, s, r, i(a));
        case "Node.js":
      }
      if (!this.isMuteLog) {
        let t = ["", "==============📣系统通知📣=============="];
        t.push(e), s && t.push(s), r && t.push(r), console.log(t.join("\n")), this.logs = this.logs.concat(t)
      }
    }
    log(...t) {
      t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator))
    }
    logErr(t, e) {
      switch (this.getEnv()) {
        case "Surge":
        case "Loon":
        case "Stash":
        case "Shadowrocket":
        case "Quantumult X":
        default:
          this.log("", `❗️${this.name}, 错误!`, t);
          break;
        case "Node.js":
          this.log("", `❗️${this.name}, 错误!`, t.stack)
      }
    }
    wait(t) {
      return new Promise((e => setTimeout(e, t)))
    }
    done(t = {}) {
      const e = ((new Date).getTime() - this.startTime) / 1e3;
      switch (this.log("", `🔔${this.name}, 结束! 🕛 ${e} 秒`), this.log(), this.getEnv()) {
        case "Surge":
        case "Loon":
        case "Stash":
        case "Shadowrocket":
        case "Quantumult X":
        default:
          $done(t);
          break;
        case "Node.js":
          process.exit(1)
      }
    }
  }(t, e)
}
