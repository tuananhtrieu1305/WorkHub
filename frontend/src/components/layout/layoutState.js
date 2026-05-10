export const isImmersiveRoomRoute = (pathname = "") =>
  /^\/(calls|meetings)\/[^/]+/.test(pathname);

export const shouldShowRightSidebar = (pathname = "") =>
  !pathname.startsWith("/messages") && !isImmersiveRoomRoute(pathname);
