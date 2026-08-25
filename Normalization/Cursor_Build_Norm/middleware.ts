import { NextRequest, NextResponse } from 'next/server';

const LOGIN_PATH = '/login';
const WORKSPACE_PATH = '/workspace';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get('offload_session')?.value);

  if (pathname.startsWith(WORKSPACE_PATH) && !hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.search = '';
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === LOGIN_PATH && hasSession) {
    const workspaceUrl = request.nextUrl.clone();
    workspaceUrl.pathname = WORKSPACE_PATH;
    workspaceUrl.search = '';
    return NextResponse.redirect(workspaceUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/workspace/:path*', '/login'],
};
