declare module "@svg-maps/china" {
  interface SvgMapLocation {
    name: string;
    id: string;
    path: string;
  }

  interface SvgMap {
    label: string;
    viewBox: string;
    locations: SvgMapLocation[];
  }

  const map: SvgMap;
  export default map;
}
