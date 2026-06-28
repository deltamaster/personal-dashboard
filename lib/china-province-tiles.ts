/** Approximate tile positions for a simplified China province SVG map. */
export const CHINA_PROVINCE_TILES: Record<
  string,
  { x: number; y: number; w: number; h: number }
> = {
  黑龙江: { x: 760, y: 30, w: 85, h: 65 },
  吉林: { x: 745, y: 95, w: 70, h: 55 },
  辽宁: { x: 710, y: 145, w: 70, h: 55 },
  内蒙古: { x: 470, y: 55, w: 210, h: 75 },
  河北: { x: 590, y: 185, w: 75, h: 55 },
  北京: { x: 605, y: 170, w: 32, h: 28 },
  天津: { x: 640, y: 178, w: 28, h: 28 },
  山西: { x: 545, y: 195, w: 55, h: 70 },
  宁夏: { x: 455, y: 210, w: 45, h: 55 },
  甘肃: { x: 350, y: 175, w: 100, h: 90 },
  青海: { x: 300, y: 240, w: 95, h: 80 },
  新疆: { x: 80, y: 120, w: 210, h: 130 },
  西藏: { x: 120, y: 320, w: 150, h: 110 },
  四川: { x: 350, y: 320, w: 95, h: 85 },
  重庆: { x: 445, y: 340, w: 50, h: 45 },
  云南: { x: 310, y: 410, w: 95, h: 90 },
  贵州: { x: 430, y: 390, w: 70, h: 65 },
  广西: { x: 470, y: 455, w: 80, h: 65 },
  广东: { x: 545, y: 455, w: 85, h: 70 },
  海南: { x: 520, y: 560, w: 55, h: 45 },
  福建: { x: 640, y: 420, w: 55, h: 70 },
  江西: { x: 590, y: 380, w: 55, h: 65 },
  湖南: { x: 530, y: 360, w: 60, h: 60 },
  湖北: { x: 530, y: 300, w: 65, h: 55 },
  河南: { x: 560, y: 260, w: 65, h: 55 },
  山东: { x: 640, y: 230, w: 75, h: 55 },
  江苏: { x: 680, y: 285, w: 55, h: 50 },
  安徽: { x: 630, y: 310, w: 55, h: 55 },
  浙江: { x: 690, y: 360, w: 55, h: 55 },
  上海: { x: 720, y: 345, w: 28, h: 28 },
  台湾: { x: 730, y: 470, w: 40, h: 55 },
  香港: { x: 575, y: 520, w: 22, h: 22 },
  澳门: { x: 555, y: 525, w: 18, h: 18 },
};

const PROVINCE_ALIASES: Record<string, string> = {
  内蒙古自治区: "内蒙古",
  广西壮族自治区: "广西",
  西藏自治区: "西藏",
  宁夏回族自治区: "宁夏",
  新疆维吾尔自治区: "新疆",
  香港特别行政区: "香港",
  澳门特别行政区: "澳门",
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
