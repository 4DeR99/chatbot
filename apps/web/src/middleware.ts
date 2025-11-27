import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
	const sessionToken =
		request.cookies.get("better-auth.session_token")?.value ||
		request.cookies.get("__Secure-better-auth.session_token")?.value;

	const isAuthPage =
		request.nextUrl.pathname === "/login" ||
		request.nextUrl.pathname === "/register";

	// If user is on auth page and has session, redirect to home
	if (isAuthPage && sessionToken) {
		return NextResponse.redirect(new URL("/", request.url));
	}

	// If user is not on auth page and has no session, redirect to login
	if (!isAuthPage && !sessionToken) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - api routes
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico
		 * - public folder
		 */
		"/((?!api|_next/static|_next/image|favicon.ico|public).*)",
	],
};
