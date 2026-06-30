/**
 * Dummy rows for scripts/qa-seed.mjs — clearly fake QA data (qa-* IDs).
 * Derived from lib/*-dummy-data.ts; kept in JS so the seed script stays zero-build.
 */

function mkHolding(holdingId, fields, now, recent) {
  const purchaseAmount = fields.purchase_amount ?? 0;
  const currentValue = fields.current_value ?? 0;
  const cashDividend = fields.cash_dividend ?? 0;
  const unrealizedPnl = currentValue - purchaseAmount;
  const unrealizedPct = purchaseAmount > 0 ? (unrealizedPnl / purchaseAmount) * 100 : 0;
  const totalReturn = unrealizedPnl + cashDividend;
  const totalReturnPct = purchaseAmount > 0 ? (totalReturn / purchaseAmount) * 100 : 0;
  return {
    ...fields,
    holding_id: holdingId,
    cash_dividend: cashDividend,
    unrealized_pnl: unrealizedPnl,
    unrealized_pct: unrealizedPct,
    total_return: totalReturn,
    total_return_pct: totalReturnPct,
    created_at: now,
    updated_at: fields.updated_at ?? recent,
  };
}

function mkMovie(doubanId, fields, now) {
  return {
    movie_url: `https://movie.douban.com/subject/${doubanId.replace(/^qa-/, "")}/`,
    created_at: now,
    updated_at: now,
    douban_subject_id: doubanId,
    ...fields,
  };
}

/** @param {string} now ISO timestamp @param {string} recent slightly older updated_at for staleness demos */
export function buildQaSeed(now, recent = now) {
  const staleR4 = "2026-01-15T00:00:00Z";
  const staleR3 = "2026-02-01T00:00:00Z";
  const staleR5 = "2026-03-10T00:00:00Z";

  return {
    pd_movies: [
      mkMovie("qa-1292052", { title_primary: "肖申克的救赎", title_alt: "The Shawshank Redemption", user_rating: 5, watched_date: "2024-05-10", release_year: 1994, director: "弗兰克·德拉邦特", country: "美国", language: "英语", duration_minutes: 142, genres: "剧情 / 犯罪" }, now),
      mkMovie("qa-1291546", { title_primary: "霸王别姬", title_alt: "Farewell My Concubine", user_rating: 5, watched_date: "2024-04-02", release_year: 1993, director: "陈凯歌", country: "中国大陆", language: "汉语普通话", duration_minutes: 171, genres: "剧情 / 爱情" }, now),
      mkMovie("qa-1292720", { title_primary: "阿甘正传", title_alt: "Forrest Gump", user_rating: 4, watched_date: "2024-03-18", release_year: 1994, director: "罗伯特·泽米吉斯", country: "美国", language: "英语", duration_minutes: 142, genres: "剧情 / 爱情" }, now),
      mkMovie("qa-1295644", { title_primary: "千与千寻", title_alt: "千と千尋の神隠し", user_rating: 5, watched_date: "2024-02-21", release_year: 2001, director: "宫崎骏", country: "日本", language: "日语", duration_minutes: 125, genres: "剧情 / 动画 / 奇幻" }, now),
      mkMovie("qa-1889243", { title_primary: "星际穿越", title_alt: "Interstellar", user_rating: 4, watched_date: "2024-01-09", release_year: 2014, director: "克里斯托弗·诺兰", country: "美国", language: "英语", duration_minutes: 169, genres: "剧情 / 科幻" }, now),
      mkMovie("qa-1292722", { title_primary: "泰坦尼克号", title_alt: "Titanic", user_rating: 4, watched_date: "2023-12-20", release_year: 1997, director: "詹姆斯·卡梅隆", country: "美国", language: "英语", duration_minutes: 194, genres: "剧情 / 爱情 / 灾难" }, now),
      mkMovie("qa-1652587", { title_primary: "盗梦空间", title_alt: "Inception", user_rating: 5, watched_date: "2023-11-08", release_year: 2010, director: "克里斯托弗·诺兰", country: "美国", language: "英语", duration_minutes: 148, genres: "剧情 / 科幻 / 悬疑" }, now),
      mkMovie("qa-1292063", { title_primary: "楚门的世界", title_alt: "The Truman Show", user_rating: 5, watched_date: "2023-10-15", release_year: 1998, director: "彼得·威尔", country: "美国", language: "英语", duration_minutes: 103, genres: "剧情 / 科幻" }, now),
      mkMovie("qa-3793023", { title_primary: "三傻大闹宝莱坞", title_alt: "3 Idiots", user_rating: 5, watched_date: "2023-09-22", release_year: 2009, director: "拉吉库马尔·希拉尼", country: "印度", language: "印地语", duration_minutes: 171, genres: "剧情 / 喜剧 / 爱情" }, now),
      mkMovie("qa-1292001", { title_primary: "海上钢琴师", title_alt: "La leggenda del pianista sull'oceano", user_rating: 5, watched_date: "2023-08-30", release_year: 1998, director: "朱塞佩·托纳多雷", country: "意大利", language: "英语", duration_minutes: 165, genres: "剧情 / 音乐" }, now),
      mkMovie("qa-1291549", { title_primary: "放牛班的春天", title_alt: "Les choristes", user_rating: 4, watched_date: "2023-07-18", release_year: 2004, director: "克里斯托夫·巴拉蒂", country: "法国", language: "法语", duration_minutes: 97, genres: "剧情 / 音乐" }, now),
      mkMovie("qa-1295124", { title_primary: "辛德勒的名单", title_alt: "Schindler's List", user_rating: 5, watched_date: "2023-06-05", release_year: 1993, director: "史蒂文·斯皮尔伯格", country: "美国", language: "英语", duration_minutes: 195, genres: "剧情 / 历史 / 战争" }, now),
      mkMovie("qa-1292213", { title_primary: "美丽人生", title_alt: "La vita è bella", user_rating: 5, watched_date: "2023-05-12", release_year: 1997, director: "罗伯托·贝尼尼", country: "意大利", language: "意大利语", duration_minutes: 116, genres: "剧情 / 喜剧 / 爱情" }, now),
      mkMovie("qa-1307910", { title_primary: "无间道", user_rating: 5, watched_date: "2023-04-01", release_year: 2002, director: "刘伟强 / 麦兆辉", country: "中国香港", language: "粤语", duration_minutes: 101, genres: "剧情 / 犯罪 / 惊悚" }, now),
      mkMovie("qa-3742360", { title_primary: "让子弹飞", user_rating: 4, watched_date: "2023-03-20", release_year: 2010, director: "姜文", country: "中国大陆", language: "汉语普通话", duration_minutes: 132, genres: "剧情 / 喜剧 / 动作" }, now),
      mkMovie("qa-1291999", { title_primary: "重庆森林", user_rating: 4, watched_date: "2023-02-14", release_year: 1994, director: "王家卫", country: "中国香港", language: "粤语", duration_minutes: 102, genres: "剧情 / 爱情" }, now),
      mkMovie("qa-1292215", { title_primary: "大话西游之大圣娶亲", user_rating: 5, watched_date: "2023-01-08", release_year: 1995, director: "刘镇伟", country: "中国香港", language: "粤语", duration_minutes: 95, genres: "喜剧 / 爱情 / 奇幻" }, now),
      mkMovie("qa-1291858", { title_primary: "鬼子来了", user_rating: 5, watched_date: "2022-12-25", release_year: 2000, director: "姜文", country: "中国大陆", language: "汉语普通话", duration_minutes: 139, genres: "剧情 / 喜剧 / 战争" }, now),
      mkMovie("qa-1293182", { title_primary: "控方证人", title_alt: "Witness for the Prosecution", user_rating: 5, watched_date: "2022-11-11", release_year: 1957, director: "比利·怀尔德", country: "美国", language: "英语", duration_minutes: 116, genres: "剧情 / 悬疑 / 犯罪" }, now),
      mkMovie("qa-1291841", { title_primary: "教父", title_alt: "The Godfather", user_rating: 5, watched_date: "2022-10-03", release_year: 1972, director: "弗朗西斯·福特·科波拉", country: "美国", language: "英语", duration_minutes: 175, genres: "剧情 / 犯罪" }, now),
      mkMovie("qa-1851857", { title_primary: "蝙蝠侠：黑暗骑士", title_alt: "The Dark Knight", user_rating: 5, watched_date: "2022-09-17", release_year: 2008, director: "克里斯托弗·诺兰", country: "美国", language: "英语", duration_minutes: 152, genres: "剧情 / 动作 / 犯罪" }, now),
      mkMovie("qa-1291561", { title_primary: "指环王3：王者无敌", title_alt: "The Lord of the Rings: The Return of the King", user_rating: 5, watched_date: "2022-08-06", release_year: 2003, director: "彼得·杰克逊", country: "美国", language: "英语", duration_minutes: 201, genres: "剧情 / 动作 / 奇幻" }, now),
      mkMovie("qa-1291843", { title_primary: "黑客帝国", title_alt: "The Matrix", user_rating: 4, watched_date: "2022-07-22", release_year: 1999, director: "莉莉·沃卓斯基 / 拉娜·沃卓斯基", country: "美国", language: "英语", duration_minutes: 136, genres: "动作 / 科幻" }, now),
      mkMovie("qa-1292000", { title_primary: "搏击俱乐部", title_alt: "Fight Club", user_rating: 4, watched_date: "2022-06-10", release_year: 1999, director: "大卫·芬奇", country: "美国", language: "英语", duration_minutes: 139, genres: "剧情 / 动作 / 悬疑" }, now),
      mkMovie("qa-1291543", { title_primary: "活着", user_rating: 5, watched_date: "2022-05-01", release_year: 1994, director: "张艺谋", country: "中国大陆", language: "汉语普通话", duration_minutes: 132, genres: "剧情 / 家庭 / 历史" }, now),
    ],

    pd_holdings: [
      mkHolding("qa-holding-us-growth", { name: "美国成长精选基金", name_en: "US Growth Select", ticker: "USGRW", bank: "招商银行", asset_type: "fund", risk_level: 4, currency: "USD", quantity: 1, purchase_amount: 44000, current_value: 42900, updated_at: staleR4 }, now, recent),
      mkHolding("qa-holding-us-tech", { name: "纳斯达克科技ETF", name_en: "Nasdaq Tech ETF", ticker: "QQQ", bank: "花旗银行", asset_type: "etf", risk_level: 5, currency: "USD", quantity: 50, purchase_nav: 520, current_nav: 520, purchase_amount: 9000, current_value: 26000, updated_at: staleR5 }, now, recent),
      mkHolding("qa-holding-cny-bond", { name: "国债逆回购", bank: "工商银行", asset_type: "bond", risk_level: 1, currency: "CNY", purchase_amount: 20000, current_value: 20100 }, now, recent),
      mkHolding("qa-holding-us-bond", { name: "美国国债基金", name_en: "US Treasury Fund", bank: "汇丰银行", asset_type: "fund", risk_level: 2, currency: "USD", purchase_amount: 20100, current_value: 20000 }, now, recent),
      mkHolding("qa-holding-structured", { name: "结构性存款", bank: "浦发银行", asset_type: "structured_deposit", risk_level: 3, currency: "CNY", purchase_amount: 12000, current_value: 12000, coupon_rate: 3.2, maturity: "2026-12-31", updated_at: staleR3 }, now, recent),
      mkHolding("qa-holding-cny-money", { name: "货币基金", bank: "招商银行", asset_type: "fund", risk_level: 1, currency: "CNY", purchase_amount: 10000, current_value: 10000, cash_dividend: 320 }, now, recent),
      mkHolding("qa-holding-hk-etf", { name: "恒生科技ETF", ticker: "3033.HK", bank: "中信证券", asset_type: "etf", risk_level: 4, currency: "HKD", purchase_amount: 42000, current_value: 45000 }, now, recent),
      mkHolding("qa-holding-a-stock", { name: "贵州茅台", ticker: "600519", bank: "华泰证券", asset_type: "stock", risk_level: 4, currency: "CNY", quantity: 40, purchase_nav: 1400, current_nav: 135.55, purchase_amount: 5800, current_value: 5422 }, now, recent),
      mkHolding("qa-holding-cny-fund", { name: "沪深300指数基金", bank: "招商银行", asset_type: "fund", risk_level: 3, currency: "CNY", purchase_amount: 18000, current_value: 19200 }, now, recent),
      mkHolding("qa-holding-cash", { name: "活期存款", bank: "工商银行", asset_type: "bond", risk_level: 1, currency: "CNY", purchase_amount: 2000, current_value: 2000 }, now, recent),
      mkHolding("qa-holding-us-stock", { name: "苹果公司", name_en: "Apple Inc.", ticker: "AAPL", bank: "花旗银行", asset_type: "stock", risk_level: 4, currency: "USD", quantity: 100, purchase_nav: 210, current_nav: 191.55, purchase_amount: 6575, current_value: 19155, cash_dividend: 85 }, now, recent),
      mkHolding("qa-holding-cny-growth", { name: "新能源主题基金", bank: "兴业银行", asset_type: "fund", risk_level: 5, currency: "CNY", purchase_amount: 8000, current_value: 6500 }, now, recent),
    ],

    pd_snapshots: [
      { snapshot_date: "2026-04-18", total_value: 582000, total_pnl: 42000, total_dividend: 3200, total_return: 45200, created_at: now },
      { snapshot_date: "2026-04-25", total_value: 588500, total_pnl: 44500, total_dividend: 3250, total_return: 47750, created_at: now },
      { snapshot_date: "2026-05-02", total_value: 591200, total_pnl: 45800, total_dividend: 3280, total_return: 49080, created_at: now },
      { snapshot_date: "2026-05-09", total_value: 596800, total_pnl: 47200, total_dividend: 3310, total_return: 50510, created_at: now },
      { snapshot_date: "2026-05-16", total_value: 601400, total_pnl: 48600, total_dividend: 3340, total_return: 51940, created_at: now },
      { snapshot_date: "2026-05-23", total_value: 605900, total_pnl: 49800, total_dividend: 3380, total_return: 53180, created_at: now },
      { snapshot_date: "2026-05-30", total_value: 609200, total_pnl: 50800, total_dividend: 3410, total_return: 54210, created_at: now },
      { snapshot_date: "2026-06-06", total_value: 612800, total_pnl: 51800, total_dividend: 3440, total_return: 55240, created_at: now },
      { snapshot_date: "2026-06-13", total_value: 616500, total_pnl: 52800, total_dividend: 3470, total_return: 56270, created_at: now },
      { snapshot_date: "2026-06-23", total_value: 621300, total_pnl: 53800, total_dividend: 3500, total_return: 57300, created_at: now },
    ],

    pd_visits: [
      { visit_id: "qa-visit-xishuangbanna", date: "2024-02-10", province: "云南", city: "景洪", attraction: "中科院西双版纳热带植物园", type: "景点", country: "中国", rating: 5, highlights: "QA sample — tropical botanic garden.", created_at: now, updated_at: now },
      { visit_id: "qa-visit-beihai", date: "2024-03-05", province: "广西", city: "北海", attraction: "银滩", type: "景点", country: "中国", rating: 4, created_at: now, updated_at: now },
      { visit_id: "qa-visit-taipei", date: "2024-04-12", province: "台湾", city: "台北", attraction: "国立故宫博物院", type: "博物馆", country: "中国", rating: 5, created_at: now, updated_at: now },
      { visit_id: "qa-visit-shanghai", date: "2024-05-01", province: "上海", city: "上海", attraction: "外滩", type: "景点", country: "中国", rating: 4, thoughts: "Night view along the Bund.", created_at: now, updated_at: now },
      { visit_id: "qa-visit-guangzhou", date: "2024-05-18", province: "广东", city: "广州", attraction: "陈家祠", type: "景点", country: "中国", rating: 4, created_at: now, updated_at: now },
      { visit_id: "qa-visit-tokyo", date: "2023-11-20", province: "", city: "东京", attraction: "浅草寺", type: "景点", country: "日本", rating: 4, created_at: now, updated_at: now },
      { visit_id: "qa-visit-harbin", date: "2024-01-15", province: "黑龙江", city: "哈尔滨", attraction: "圣索菲亚大教堂", type: "景点", country: "中国", rating: 5, created_at: now, updated_at: now },
      { visit_id: "qa-visit-hailar", date: "2024-01-18", province: "内蒙古", city: "海拉尔", attraction: "呼伦贝尔大草原", type: "景点", country: "中国", rating: 5, highlights: "Winter grassland.", created_at: now, updated_at: now },
      { visit_id: "qa-visit-urumqi", date: "2023-09-10", province: "新疆", city: "乌鲁木齐", attraction: "新疆国际大巴扎", type: "景点", country: "中国", rating: 4, created_at: now, updated_at: now },
      { visit_id: "qa-visit-dunhuang", date: "2023-09-14", province: "甘肃", city: "敦煌", attraction: "莫高窟", type: "景点", country: "中国", rating: 5, created_at: now, updated_at: now },
      { visit_id: "qa-visit-lhasa", date: "2023-07-22", province: "西藏", city: "拉萨", attraction: "布达拉宫", type: "景点", country: "中国", rating: 5, created_at: now, updated_at: now },
      { visit_id: "qa-visit-xian", date: "2023-12-03", province: "陕西", city: "西安", attraction: "兵马俑", type: "景点", country: "中国", rating: 5, created_at: now, updated_at: now },
      { visit_id: "qa-visit-chengdu", date: "2023-12-06", province: "四川", city: "成都", attraction: "大熊猫繁育研究基地", type: "景点", country: "中国", rating: 5, created_at: now, updated_at: now },
      { visit_id: "qa-visit-beijing", date: "2024-06-08", province: "北京", city: "北京", attraction: "故宫博物院", type: "博物馆", country: "中国", rating: 5, created_at: now, updated_at: now },
    ],

    pd_flights: [
      { flight_id: "qa-flight-sh-km", flight_date: "2024-05-20", airline: "东方航空", flight_number: "MU5804", departure_city: "上海虹桥", departure_time: "08:00", arrival_city: "昆明长水", arrival_time: "11:20", distance_km: 2260, status: "completed", created_at: now },
      { flight_id: "qa-flight-xsb-km", flight_date: "2024-02-09", airline: "东方航空", flight_number: "MU5914", departure_city: "西双版纳嘎洒", arrival_city: "昆明长水", distance_km: 390, status: "completed", created_at: now },
      { flight_id: "qa-flight-tpe-pvg", flight_date: "2024-04-11", airline: "南方航空", flight_number: "CZ3096", departure_city: "中国台北桃园", arrival_city: "上海浦东", distance_km: 680, status: "completed", created_at: now },
      { flight_id: "qa-flight-kwl-tpe", flight_date: "2024-03-15", airline: "南方航空", flight_number: "CZ3019", departure_city: "桂林两江", arrival_city: "中国台北桃园", distance_km: 920, status: "completed", created_at: now },
      { flight_id: "qa-flight-bh", flight_date: "2024-03-04", airline: "东方航空", flight_number: "MU6399", departure_city: "上海浦东", arrival_city: "北海福成", distance_km: 1800, status: "completed", created_at: now },
      { flight_id: "qa-flight-sy", flight_date: "2024-01-08", airline: "东方航空", flight_number: "MU5468", departure_city: "上海浦东", arrival_city: "三亚凤凰", distance_km: 2050, status: "completed", created_at: now },
      { flight_id: "qa-flight-intl", flight_date: "2023-11-19", airline: "东方航空", flight_number: "MU521", departure_city: "上海浦东", arrival_city: "东京成田", distance_km: 1780, status: "completed", created_at: now },
      { flight_id: "qa-flight-sh-hrb", flight_date: "2024-01-14", airline: "南方航空", flight_number: "CZ6218", departure_city: "上海浦东", arrival_city: "哈尔滨太平", distance_km: 1680, status: "completed", created_at: now },
      { flight_id: "qa-flight-hrb-hld", flight_date: "2024-01-17", airline: "中国国航", flight_number: "CA1247", departure_city: "哈尔滨太平", arrival_city: "呼伦贝尔海拉尔", distance_km: 520, status: "completed", created_at: now },
      { flight_id: "qa-flight-sh-urc", flight_date: "2023-09-09", airline: "东方航空", flight_number: "MU5633", departure_city: "上海浦东", arrival_city: "乌鲁木齐地窝堡", distance_km: 3640, status: "completed", created_at: now },
      { flight_id: "qa-flight-urc-dnh", flight_date: "2023-09-13", airline: "南方航空", flight_number: "CZ6951", departure_city: "乌鲁木齐地窝堡", arrival_city: "敦煌莫高", distance_km: 980, status: "completed", created_at: now },
      { flight_id: "qa-flight-xiy-dnh", flight_date: "2023-09-12", airline: "东方航空", flight_number: "MU2157", departure_city: "西安咸阳", arrival_city: "敦煌莫高", distance_km: 1100, status: "completed", created_at: now },
      { flight_id: "qa-flight-ctu-lxa", flight_date: "2023-07-21", airline: "四川航空", flight_number: "3U8693", departure_city: "成都双流", arrival_city: "拉萨贡嘎", distance_km: 1280, status: "completed", created_at: now },
      { flight_id: "qa-flight-pek-xiy", flight_date: "2023-12-02", airline: "中国国航", flight_number: "CA1201", departure_city: "北京首都", arrival_city: "西安咸阳", distance_km: 934, status: "completed", created_at: now },
      { flight_id: "qa-flight-xiy-ctu", flight_date: "2023-12-05", airline: "四川航空", flight_number: "3U8618", departure_city: "西安咸阳", arrival_city: "成都双流", distance_km: 635, status: "completed", created_at: now },
      { flight_id: "qa-flight-can-xiy", flight_date: "2024-05-17", airline: "南方航空", flight_number: "CZ3215", departure_city: "广州白云", arrival_city: "西安咸阳", distance_km: 1300, status: "completed", created_at: now },
    ],

    pd_trains: [
      { train_id: "qa-train-beihai", train_date: "2024-03-05", train_type: "动车", train_number: "D3926", departure_station: "北海", departure_time: "09:30", arrival_station: "南宁", arrival_time: "10:45", duration_minutes: 75, status: "completed", created_at: now },
      { train_id: "qa-train-gz-hk", train_date: "2024-05-19", train_type: "高铁", train_number: "G653", departure_station: "广州南", departure_time: "14:00", arrival_station: "香港西九龙", arrival_time: "14:45", duration_minutes: 45, status: "completed", created_at: now },
      { train_id: "qa-train-sh-hz", train_date: "2024-05-02", train_type: "高铁", train_number: "G7311", departure_station: "上海虹桥", departure_time: "10:00", arrival_station: "杭州东", arrival_time: "10:45", duration_minutes: 45, status: "completed", created_at: now },
      { train_id: "qa-train-bj-hrb", train_date: "2024-01-14", train_type: "高铁", train_number: "G1201", departure_station: "北京", departure_time: "08:00", arrival_station: "哈尔滨", arrival_time: "14:30", duration_minutes: 390, status: "completed", created_at: now },
      { train_id: "qa-train-lz-dnh", train_date: "2023-09-13", train_type: "动车", train_number: "D2749", departure_station: "兰州", departure_time: "07:30", arrival_station: "敦煌", arrival_time: "12:15", duration_minutes: 285, status: "completed", created_at: now },
      { train_id: "qa-train-urc-lz", train_date: "2023-09-11", train_type: "高铁", train_number: "G8152", departure_station: "乌鲁木齐", departure_time: "09:00", arrival_station: "兰州", arrival_time: "16:40", duration_minutes: 460, status: "completed", created_at: now },
      { train_id: "qa-train-xa-cd", train_date: "2023-12-05", train_type: "高铁", train_number: "D1921", departure_station: "西安", departure_time: "13:00", arrival_station: "成都", arrival_time: "16:30", duration_minutes: 210, status: "completed", created_at: now },
      { train_id: "qa-train-gz-wh", train_date: "2024-05-16", train_type: "高铁", train_number: "G1102", departure_station: "广州", departure_time: "11:00", arrival_station: "武汉", arrival_time: "15:20", duration_minutes: 260, status: "completed", created_at: now },
    ],

    pd_visit_images: [],
  };
}
