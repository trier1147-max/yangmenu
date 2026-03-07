// 洋菜单 - 获取/创建用户，检查每日使用限制
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

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

  const today = todayStr();
  const users = db.collection("users");

  if (event.action === "consume") {
    const { data } = await users.where({ _openid: openid }).get();
    const user = data[0];
    if (!user) {
      return { success: false, error: "用户不存在" };
    }
    const lastDate = user.lastUsageDate || "";
    const dailyUsage = lastDate === today ? (user.dailyUsage || 0) : 0;
    if (dailyUsage >= 6) {
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

  const { data } = await users.where({ _openid: openid }).get();
  let user = data[0];

  if (!user) {
    await users.add({
      data: {
        _openid: openid,
        dailyUsage: 0,
        lastUsageDate: today,
        createdAt: db.serverDate(),
      },
    });
    const { data: newData } = await users.where({ _openid: openid }).get();
    user = newData[0];
  } else if (user.lastUsageDate !== today) {
    await users.where({ _openid: openid }).update({
      data: { dailyUsage: 0, lastUsageDate: today },
    });
    user = { ...user, dailyUsage: 0, lastUsageDate: today };
  }

  return {
    success: true,
    openid,
    user: {
      _openid: user._openid,
      dailyUsage: user.dailyUsage ?? 0,
      lastUsageDate: user.lastUsageDate ?? today,
      createdAt: user.createdAt,
    },
  };
};
