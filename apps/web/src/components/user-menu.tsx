import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UserMenu() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return <Skeleton className="h-9 w-24" />;
	}

	if (!session) {
		return (
			<Button variant="outline" asChild>
				<Link href="/login">Se connecter</Link>
			</Button>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline">{session.user.name}</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="bg-card">
				<DropdownMenuLabel>Mon compte</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem>{session.user.email}</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Button
						variant="destructive"
						className="w-full"
						onClick={() => {
							authClient.signOut({
								fetchOptions: {
									onSuccess: () => {
										router.push("/login");
									},
								},
							});
						}}
					>
						Se déconnecter
					</Button>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
