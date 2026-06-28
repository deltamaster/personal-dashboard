/** Map @svg-maps/china English labels to short Chinese names used in visit data. */
export const SVG_NAME_TO_PROVINCE: Record<string, string> = {
  Anhui: "安徽",
  Beijing: "北京",
  Chongqing: "重庆",
  Fujian: "福建",
  Gansu: "甘肃",
  Guangdong: "广东",
  "Guangxi Zhuang": "广西",
  Guizhou: "贵州",
  Hainan: "海南",
  Hebei: "河北",
  Heilongjiang: "黑龙江",
  Henan: "河南",
  "Hong Kong": "香港",
  Hubei: "湖北",
  Hunan: "湖南",
  Jiangsu: "江苏",
  Jiangxi: "江西",
  Jilin: "吉林",
  Liaoning: "辽宁",
  Macau: "澳门",
  "Nei Mongol": "内蒙古",
  "Ningxia Hui": "宁夏",
  Quinghai: "青海",
  Shaanxi: "陕西",
  Shandong: "山东",
  Shanghai: "上海",
  Shanxi: "山西",
  Sichuan: "四川",
  Tianjin: "天津",
  "Xinjiang Uygur": "新疆",
  "Xizang (Tibet)": "西藏",
  "Xizang (Tibet) ": "西藏",
  Yunnan: "云南",
  Zhejiang: "浙江",
  Taiwan: "台湾",
};

export const CHINA_PROVINCE_NAMES = new Set(Object.values(SVG_NAME_TO_PROVINCE));

const PROVINCE_ALIASES: Record<string, string> = {
  内蒙古自治区: "内蒙古",
  广西壮族自治区: "广西",
  西藏自治区: "西藏",
  宁夏回族自治区: "宁夏",
  新疆维吾尔自治区: "新疆",
  香港特别行政区: "香港",
  澳门特别行政区: "澳门",
  台湾省: "台湾",
  台湾地区: "台湾",
  台湾: "台湾",
  北京市: "北京",
  天津市: "天津",
  上海市: "上海",
  重庆市: "重庆",
};

export function normalizeProvince(name: string): string {
  const trimmed = name.trim();
  if (PROVINCE_ALIASES[trimmed]) return PROVINCE_ALIASES[trimmed];
  return trimmed
    .replace(/(壮族|回族|维吾尔)?自治区/g, "")
    .replace(/特别行政区/g, "")
    .replace(/省|市/g, "")
    .trim();
}

export function svgLabelToProvince(label: string): string | undefined {
  return SVG_NAME_TO_PROVINCE[label] ?? SVG_NAME_TO_PROVINCE[label.trim()];
}
