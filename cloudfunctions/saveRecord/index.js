const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { imageFileID, dishes } = event;
  if (!Array.isArray(dishes) || dishes.length === 0) {
    return { success: false, error: "缺少 dishes" };
  }

  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) {
      return { success: false, error: "无法获取 openid" };
    }

    const safeDishes = (dishes || []).filter((d) => d != null && typeof d === "object");

    const res = await db.collection("scan_records").add({
      data: {
        _openid: openid,
        imageFileID: typeof imageFileID === "string" ? imageFileID : "",
        dishes: safeDishes.map((d) => ({
          originalName: d.originalName || "",
          briefCN: d.briefCN || "",
          detail: d.detail || {
            description: "",
            ingredients: [],
            flavor: "",
          },
        })),
        createdAt: db.serverDate(),
      },
    });

    return {
      success: true,
      data: { recordId: res._id },
    };
  } catch (e) {
    return {
      success: false,
      error: e.message || String(e),
    };
  }
};
