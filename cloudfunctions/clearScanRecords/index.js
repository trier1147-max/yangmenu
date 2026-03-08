/**
 * 云函数：清空 scan_records 集合中的所有记录
 * 注意：微信云数据库单次 remove 最多删除 20 条，需循环直到清空
 */
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const MAX_REMOVE = 20;

exports.main = async (event) => {
  const { confirm } = event || {};
  if (confirm !== true) {
    return {
      success: false,
      error: "请传入 confirm: true 以确认删除",
    };
  }

  let totalDeleted = 0;
  try {
    while (true) {
      const res = await db
        .collection("scan_records")
        .limit(MAX_REMOVE)
        .get();

      if (!res.data || res.data.length === 0) {
        break;
      }

      const tasks = res.data.map((doc) =>
        db.collection("scan_records").doc(doc._id).remove()
      );
      await Promise.all(tasks);
      totalDeleted += res.data.length;
    }

    return {
      success: true,
      totalDeleted,
      message: `已删除 ${totalDeleted} 条 scan_records 记录`,
    };
  } catch (e) {
    return {
      success: false,
      error: e.message || String(e),
      totalDeleted,
    };
  }
};
