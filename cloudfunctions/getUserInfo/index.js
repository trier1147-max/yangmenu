// 洋菜单 - 获取/创建用户，检查每日使用限制
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const BASE_LIMIT = 6;
const MAX_LIMIT = 12;

// 白名单 openid，不限制使用次数。获取方式：云开发控制台 → 数据库 users 集合查看 _openid
const WHITELIST_OPENIDS = [
  'oxqZ21_TvqEBqjgmz8RxwM5YO8Vo',
];
const BONUS_FRIENDS = 2;
const BONUS_TIMELINE = 4;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, error: "无法获取 openid" };
  }

  const isWhitelisted = WHITELIST_OPENIDS.includes(openid);

  const today = todayStr();
  const users = db.collection("users");

  // action: consume - 消耗一次使用次数
  if (event.action === "consume") {
    if (isWhitelisted) {
      return { success: true };
    }
    let { data } = await users.where({ _openid: openid }).get();
    let user = data[0];
    if (!user) {
      await users.add({
        data: {
          _openid: openid,
          dailyUsage: 0,
          dailyBonus: 0,
          lastUsageDate: today,
          createdAt: db.serverDate(),
        },
      });
      const { data: newData } = await users.where({ _openid: openid }).get();
      if (!newData || newData.length === 0) {
        return { success: false, error: "用户数据创建失败，请重试" };
      }
      user = newData[0];
    }
    const lastDate = user.lastUsageDate || "";
    const dailyUsage = lastDate === today ? (user.dailyUsage || 0) : 0;
    const dailyBonus = lastDate === today ? (user.dailyBonus || 0) : 0;
    const total = BASE_LIMIT + dailyBonus;
    if (dailyUsage >= total) {
      return { success: false, error: "今日次数已用完" };
    }
    await users.where({ _openid: openid }).update({
      data: {
        dailyUsage: dailyUsage + 1,
        lastUsageDate: today,
      },
    });
    return { success: true };
  }

  // action: addBonus - 分享奖励，amount: 2=朋友 4=朋友圈
  if (event.action === "addBonus") {
    if (isWhitelisted) {
      return { success: true, remaining: 999 };
    }
    const amount = event.amount === 4 ? BONUS_TIMELINE : BONUS_FRIENDS;
    let { data } = await users.where({ _openid: openid }).get();
    let user = data[0];
    if (!user) {
      await users.add({
        data: {
          _openid: openid,
          dailyUsage: 0,
          dailyBonus: 0,
          lastUsageDate: today,
          createdAt: db.serverDate(),
        },
      });
      const { data: newData } = await users.where({ _openid: openid }).get();
      if (!newData || newData.length === 0) {
        return { success: false, error: "用户数据创建失败，请重试" };
      }
      user = newData[0];
    }
    const lastDate = user.lastUsageDate || "";
    const dailyBonus = lastDate === today ? (user.dailyBonus || 0) : 0;
    if (BASE_LIMIT + dailyBonus >= MAX_LIMIT) {
      return { success: false, error: "今日次数已达上限" };
    }
    const newBonus = Math.min(dailyBonus + amount, MAX_LIMIT - BASE_LIMIT);
    await users.where({ _openid: openid }).update({
      data: {
        dailyBonus: newBonus,
        lastUsageDate: today,
      },
    });
    const { data: updated } = await users.where({ _openid: openid }).get();
    const u = updated[0];
    const used = lastDate === today ? (u.dailyUsage || 0) : 0;
    const total = BASE_LIMIT + newBonus;
    const remaining = total - used;
    return { success: true, remaining };
  }

  // 默认：查询用户信息
  if (isWhitelisted) {
    return {
      success: true,
      openid,
      user: {
        _openid: openid,
        dailyUsage: 0,
        dailyBonus: 994,
        lastUsageDate: today,
        createdAt: new Date(),
      },
    };
  }

  const { data } = await users.where({ _openid: openid }).get();
  let user = data[0];

  if (!user) {
    await users.add({
      data: {
        _openid: openid,
        dailyUsage: 0,
        dailyBonus: 0,
        lastUsageDate: today,
        createdAt: db.serverDate(),
      },
    });
    const { data: newData } = await users.where({ _openid: openid }).get();
    if (!newData || newData.length === 0) {
      return { success: false, error: "用户数据创建失败，请重试" };
    }
    user = newData[0];
  } else if (user.lastUsageDate !== today) {
    await users.where({ _openid: openid }).update({
      data: { dailyUsage: 0, dailyBonus: 0, lastUsageDate: today },
    });
    user = { ...user, dailyUsage: 0, dailyBonus: 0, lastUsageDate: today };
  }

  return {
    success: true,
    openid,
    user: {
      _openid: user._openid,
      dailyUsage: user.dailyUsage ?? 0,
      dailyBonus: user.dailyBonus ?? 0,
      lastUsageDate: user.lastUsageDate ?? today,
      createdAt: user.createdAt,
    },
  };
};
