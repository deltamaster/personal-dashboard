/** Affine fit lng/lat → @svg-maps/china viewBox (774×569). Refit: scripts/fit-map-align.mjs */
const PROJECT_X = [13.325659128422258, -0.2733074632622181, -1002.4557279859407] as const;
const PROJECT_Y = [0.9174293637216984, -14.705237865546145, 735.609567165455] as const;

export const MAP_VIEW_BOX = "0 0 774 569";

/** Only show routes with both ends inside mainland China (+ HK/Macau/Taiwan). */
const CHINA_DOMESTIC = new Set([
  "三亚",
  "上海",
  "台北",
  "澳门",
  "丽江",
  "乌鲁木齐",
  "兰州",
  "北京",
  "北海",
  "南京",
  "南宁",
  "厦门",
  "海拉尔",
  "大理",
  "大连",
  "天津",
  "威海",
  "广州",
  "成都",
  "拉萨",
  "揭阳",
  "敦煌",
  "昆明",
  "桂林",
  "武汉",
  "沈阳",
  "泉州",
  "深圳",
  "湛江",
  "甘南",
  "福州",
  "秦皇岛",
  "西双版纳",
  "西安",
  "贵阳",
  "重庆",
  "银川",
  "长春",
  "长沙",
  "青岛",
  "香港",
  "佛山",
  "哈尔滨",
  "杭州",
  "林芝",
  "海口",
  "西宁",
  "宁波",
  "徐州",
  "无锡",
  "苏州",
  "珠海",
  "番禺",
  "潮汕",
  "松山湖",
  "凤台",
  "容桂",
  "十字门",
  "福田",
  "连云港",
]);

/** [longitude, latitude] WGS84 */
const COORDS: Record<string, [number, number]> = {
  三亚: [109.5119, 18.2528],
  上海: [121.4737, 31.2304],
  东京: [139.6917, 35.6895],
  台北: [121.5654, 25.033],
  澳门: [113.5439, 22.1987],
  丽江: [100.233, 26.8721],
  乌鲁木齐: [87.6168, 43.8256],
  乔治城: [100.3327, 5.4141],
  亚的斯亚贝巴: [38.7578, 8.9806],
  仰光: [96.1951, 16.8661],
  兰州: [103.8343, 36.0611],
  北京: [116.4074, 39.9042],
  北海: [109.1193, 21.4733],
  南京: [118.7969, 32.0603],
  南宁: [108.3669, 22.817],
  厦门: [118.0894, 24.4798],
  名古屋: [136.9066, 35.1815],
  海拉尔: [119.7658, 49.2116],
  哥打京那巴鲁: [116.0735, 5.9804],
  大理: [100.2257, 25.6065],
  大连: [121.6147, 38.914],
  大阪: [135.5023, 34.6937],
  天津: [117.201, 39.0842],
  威海: [122.1204, 37.5131],
  广州: [113.2644, 23.1291],
  成都: [104.0665, 30.5723],
  拉萨: [91.1322, 29.6604],
  揭阳: [116.3557, 23.5438],
  敦煌: [94.6619, 40.1421],
  新加坡: [103.8198, 1.3521],
  旧金山: [-122.4194, 37.7749],
  昆明: [102.8329, 24.8801],
  普吉: [98.3923, 7.8804],
  曼谷: [100.5018, 13.7563],
  札幌: [141.3545, 43.0618],
  桂林: [110.299, 25.2742],
  武汉: [114.3055, 30.5928],
  沈阳: [123.4328, 41.8048],
  河内: [105.8342, 21.0278],
  泉州: [118.6759, 24.8741],
  深圳: [114.0579, 22.5431],
  湛江: [110.3594, 21.2707],
  甘南: [102.911, 34.9864],
  福州: [119.2965, 26.0745],
  科伦坡: [79.8612, 6.9271],
  秦皇岛: [119.6005, 39.9354],
  约翰内斯堡: [28.0473, -26.2041],
  纽约: [-74.006, 40.7128],
  美娜多: [124.8481, 1.4748],
  西双版纳: [100.7979, 22.0017],
  西安: [108.9398, 34.3416],
  贵阳: [106.6302, 26.6477],
  赫霍: [124.8481, 1.4748],
  迪拜: [55.2708, 25.2048],
  重庆: [106.5516, 29.563],
  金兰: [109.2196, 11.9984],
  银川: [106.2309, 38.4872],
  长春: [125.3235, 43.8171],
  长沙: [112.9388, 28.2282],
  青岛: [120.3826, 36.0671],
  香港: [114.1694, 22.3193],
  马德里: [-3.7038, 40.4168],
  佛山: [113.122, 23.0218],
  哈尔滨: [126.534, 45.8038],
  开普敦: [18.4241, -33.9249],
  曼德勒: [96.0836, 21.9588],
  杭州: [120.1551, 30.2741],
  林芝: [94.3615, 29.654],
  海口: [110.1999, 20.044],
  清迈: [98.9853, 18.7883],
  胡志明市: [106.6297, 10.8231],
  西宁: [101.7782, 36.6171],
  宁波: [121.544, 29.8683],
  徐州: [117.2841, 34.2058],
  无锡: [120.3119, 31.4912],
  苏州: [120.5853, 31.2989],
  珠海: [113.5767, 22.2707],
  番禺: [113.3841, 22.9376],
  潮汕: [116.6226, 23.6569],
  松山湖: [113.8953, 22.9574],
  凤台: [116.711, 32.709],
  容桂: [113.324, 22.764],
  十字门: [113.5767, 22.2707],
  福田: [114.055, 22.5415],
  连云港: [119.2216, 34.5967],
};

const PLACE_ALIASES: Record<string, string> = {
  三亚凤凰: "三亚",
  上海浦东: "上海",
  上海虹桥: "上海",
  上海虹桥T2: "上海",
  东京成田: "东京",
  东京羽田: "东京",
  中国台北桃园: "台北",
  中国澳门: "澳门",
  丽江三义: "丽江",
  乌鲁木齐地窝堡: "乌鲁木齐",
  亚的斯亚贝巴博莱: "亚的斯亚贝巴",
  仰光国际: "仰光",
  兰州中川: "兰州",
  北京大兴: "北京",
  北京首都: "北京",
  北京南: "北京",
  北京朝阳: "北京",
  北海福成: "北海",
  南京禄口: "南京",
  南京南: "南京",
  南宁东: "南宁",
  南宁吴圩: "南宁",
  南宁: "南宁",
  厦门高崎: "厦门",
  厦门北: "厦门",
  名古屋中部国际: "名古屋",
  呼伦贝尔海拉尔: "海拉尔",
  哥打京那巴鲁: "哥打京那巴鲁",
  大理凤仪: "大理",
  大连周水子: "大连",
  大阪关西: "大阪",
  天津滨海: "天津",
  威海大水泊: "威海",
  广州白云: "广州",
  广州白云T3: "广州",
  广州南: "广州",
  广州东: "广州",
  成都双流: "成都",
  成都天府: "成都",
  拉萨贡嘎: "拉萨",
  揭阳潮汕: "揭阳",
  敦煌莫高: "敦煌",
  新加坡樟宜: "新加坡",
  旧金山国际: "旧金山",
  昆明长水: "昆明",
  普吉国际: "普吉",
  曼谷廊曼: "曼谷",
  曼谷素万那普: "曼谷",
  札幌新千岁: "札幌",
  桂林两江: "桂林",
  武汉天河: "武汉",
  沈阳桃仙: "沈阳",
  沈阳北: "沈阳",
  河内内排国际: "河内",
  泉州晋江: "泉州",
  泉州: "泉州",
  深圳宝安: "深圳",
  湛江吴川: "湛江",
  甘南夏河: "甘南",
  福州长乐: "福州",
  福州: "福州",
  科伦坡班达拉奈克: "科伦坡",
  秦皇岛北戴河: "秦皇岛",
  约翰内斯堡国际: "约翰内斯堡",
  纽约肯尼迪国际: "纽约",
  纽约纽瓦克国际: "纽约",
  美娜多: "美娜多",
  西双版纳嘎洒: "西双版纳",
  西安咸阳: "西安",
  贵阳龙洞堡: "贵阳",
  赫霍机场: "赫霍",
  迪拜国际: "迪拜",
  重庆江北: "重庆",
  金兰国际: "金兰",
  银川河东: "银川",
  长春龙嘉: "长春",
  长沙黄花: "长沙",
  青岛胶东: "青岛",
  香港国际: "香港",
  香港西九龙: "香港",
  马德里巴拉哈斯: "马德里",
  佛山沙堤: "佛山",
  哈尔滨太平: "哈尔滨",
  开普敦国际: "开普敦",
  杭州萧山: "杭州",
  杭州东: "杭州",
  杭州西: "杭州",
  林芝米林: "林芝",
  海口美兰: "海口",
  清迈国际: "清迈",
  曼德勒: "曼德勒",
  胡志明市新山一: "胡志明市",
  西宁曹家堡: "西宁",
  凤台南: "凤台",
  十字门: "十字门",
  容桂: "容桂",
  宁波: "宁波",
  徐州东: "徐州",
  无锡: "无锡",
  苏州: "苏州",
  珠海: "珠海",
  番禺: "番禺",
  潮汕: "潮汕",
  松山湖北: "松山湖",
  连云港: "连云港",
  福田: "福田",
  上海: "上海",
};

const STRIP_SUFFIXES = ["国际机场", "国际", "机场", "T3", "T2", "T1", "站", "火车站", "高铁站"];

function normalizePlace(name: string): string {
  let s = name.trim();
  for (const suffix of STRIP_SUFFIXES) {
    if (s.endsWith(suffix)) s = s.slice(0, -suffix.length);
  }
  return s.trim();
}

export function resolvePlaceKey(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const alias = PLACE_ALIASES[trimmed];
  if (alias && COORDS[alias]) return alias;
  if (COORDS[trimmed]) return trimmed;

  const normalized = normalizePlace(trimmed);
  if (PLACE_ALIASES[normalized] && COORDS[PLACE_ALIASES[normalized]]) {
    return PLACE_ALIASES[normalized];
  }
  if (COORDS[normalized]) return normalized;

  const byPrefix = Object.keys(COORDS)
    .sort((a, b) => b.length - a.length)
    .find((city) => trimmed.startsWith(city) || normalized.startsWith(city));
  return byPrefix ?? null;
}

export function resolvePlaceCoords(name: string): [number, number] | null {
  const key = resolvePlaceKey(name);
  return key ? COORDS[key] : null;
}

export function isDomesticPlace(name: string): boolean {
  const key = resolvePlaceKey(name);
  return key != null && CHINA_DOMESTIC.has(key);
}

export function projectLngLat([lng, lat]: [number, number]): [number, number] {
  return [
    PROJECT_X[0] * lng + PROJECT_X[1] * lat + PROJECT_X[2],
    PROJECT_Y[0] * lng + PROJECT_Y[1] * lat + PROJECT_Y[2],
  ];
}

export function resolveProjectedPoint(name: string): [number, number] | null {
  const key = resolvePlaceKey(name);
  if (!key) return null;
  return projectLngLat(COORDS[key]);
}

function routeArcControl(
  from: [number, number],
  to: [number, number],
  bulge: number
) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const lift = Math.min(len * bulge, 55);
  const control: [number, number] = [mx + (-dy / len) * lift, my + (dx / len) * lift];
  return { from, control, to };
}

export function routeArcPath(from: [number, number], to: [number, number], bulge = 0.18): string {
  const { from: p0, control, to: p2 } = routeArcControl(from, to, bulge);
  return `M ${p0[0]} ${p0[1]} Q ${control[0]} ${control[1]} ${p2[0]} ${p2[1]}`;
}

/** Mid-arc position and tangent angle (degrees) for a direction arrow. */
export function routeArcArrow(
  from: [number, number],
  to: [number, number],
  bulge = 0.18,
  t = 0.5
): { x: number; y: number; angle: number } {
  const { from: p0, control: p1, to: p2 } = routeArcControl(from, to, bulge);
  const u = 1 - t;
  const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
  const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
  const tx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
  const ty = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
  return { x, y, angle: (Math.atan2(ty, tx) * 180) / Math.PI };
}

export interface MapRoute {
  id: string;
  path: string;
  label: string;
  count: number;
  bulge: number;
  from: [number, number];
  to: [number, number];
  fromKey: string;
  toKey: string;
}

export interface MapEndpoint {
  point: [number, number];
  names: string[];
}

function aggregateRoutes(
  segments: { from: string; to: string; label: string; id: string }[],
  bulge: number,
  directed = false
): MapRoute[] {
  const groups = new Map<
    string,
    {
      from: [number, number];
      to: [number, number];
      fromKey: string;
      toKey: string;
      labels: string[];
    }
  >();

  for (const seg of segments) {
    if (!isDomesticPlace(seg.from) || !isDomesticPlace(seg.to)) continue;

    const fromKey = resolvePlaceKey(seg.from);
    const toKey = resolvePlaceKey(seg.to);
    const p1 = resolveProjectedPoint(seg.from);
    const p2 = resolveProjectedPoint(seg.to);
    if (!fromKey || !toKey || !p1 || !p2) continue;

    const key = directed
      ? `${fromKey}→${toKey}`
      : [seg.from, seg.to].sort().join("↔");
    const existing = groups.get(key);
    if (existing) {
      existing.labels.push(seg.label);
    } else {
      groups.set(key, { from: p1, to: p2, fromKey, toKey, labels: [seg.label] });
    }
  }

  return Array.from(groups.entries()).map(([key, group]) => ({
    id: key,
    path: routeArcPath(group.from, group.to, bulge),
    label: group.labels.slice(0, 3).join(" · ") + (group.labels.length > 3 ? " …" : ""),
    count: group.labels.length,
    bulge,
    from: group.from,
    to: group.to,
    fromKey: group.fromKey,
    toKey: group.toKey,
  }));
}

export function buildFlightRoutes(
  flights: {
    flight_id: string;
    flight_number: string;
    departure_city: string;
    arrival_city: string;
    airline: string;
  }[]
): MapRoute[] {
  return aggregateRoutes(
    flights.map((f) => ({
      id: f.flight_id,
      from: f.departure_city,
      to: f.arrival_city,
      label: `${f.airline}${f.flight_number}`,
    })),
    0.2,
    true
  );
}

export function buildTrainRoutes(
  trains: {
    train_id: string;
    train_number: string;
    departure_station: string;
    arrival_station: string;
    train_type?: string;
  }[]
): MapRoute[] {
  return aggregateRoutes(
    trains.map((t) => ({
      id: t.train_id,
      from: t.departure_station,
      to: t.arrival_station,
      label: `${t.train_type ?? "列车"} ${t.train_number}`,
    })),
    0.08,
    true
  );
}

function pointKey(point: [number, number]): string {
  return `${point[0]},${point[1]}`;
}

export function collectRouteEndpoints(routes: MapRoute[]): MapEndpoint[] {
  const byPoint = new Map<string, Set<string>>();
  for (const route of routes) {
    for (const [point, name] of [
      [route.from, route.fromKey],
      [route.to, route.toKey],
    ] as const) {
      const key = pointKey(point);
      const names = byPoint.get(key) ?? new Set<string>();
      names.add(name);
      byPoint.set(key, names);
    }
  }

  return Array.from(byPoint.entries()).map(([key, names]) => {
    const [x, y] = key.split(",").map(Number);
    return {
      point: [x, y] as [number, number],
      names: Array.from(names).sort((a, b) => a.localeCompare(b, "zh-Hans")),
    };
  });
}
