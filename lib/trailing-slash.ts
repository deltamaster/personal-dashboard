/** True for app routes like /travel that must end with / on static OSS hosting. */
export function pathnameNeedsTrailingSlash(pathname: string): boolean {
  if (!pathname || pathname === "/") return false;
  if (pathname.startsWith("/api")) return false;
  if (pathname.endsWith("/")) return false;
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  if (lastSegment.includes(".")) return false;
  return true;
}

export function withTrailingSlash(pathname: string): string {
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}
