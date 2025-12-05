import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
	const sessionToken =
		request.cookies.get("better-auth.session_token")?.value ||
		request.cookies.get("__Secure-better-auth.session_token")?.value;

	const pathname = request.nextUrl.pathname;
	const isAuthPage = pathname === "/login" || pathname === "/register";
	const isLandingPage = pathname === "/";
	const isChatRoute = pathname.startsWith("/chat");

	if (isAuthPage && sessionToken) {
		return NextResponse.redirect(new URL("/chat", request.url));
	}

	if (isChatRoute && !sessionToken) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	if (!isAuthPage && !sessionToken && !isLandingPage) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico|public).*)"],
};
