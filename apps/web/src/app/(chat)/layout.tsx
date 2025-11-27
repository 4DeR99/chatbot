"use client";

import { authClient } from "@/lib/auth-client";
import { Sidebar } from "@/components/sidebar";
import Loader from "@/components/loader";

export default function ChatLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader />
			</div>
		);
	}

	// Middleware handles redirect, but show loader if no session yet
	if (!session?.user) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader />
			</div>
		);
	}

	return (
		<div className="flex h-full overflow-hidden">
			<Sidebar user={session.user} />
			<main className="flex-1 overflow-hidden">{children}</main>
		</div>
	);
}
