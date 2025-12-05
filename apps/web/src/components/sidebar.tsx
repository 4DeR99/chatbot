"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { trpc } from "@/utils/trpc";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Menu,
	Plus,
	MessageSquare,
	Trash2,
	ChevronLeft,
	ChevronRight,
	Moon,
	Sun,
	LogOut,
	User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
	user: {
		id: string;
		name: string;
		email: string;
	};
}

export function Sidebar({ user }: SidebarProps) {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);
	const pathname = usePathname();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { theme, setTheme } = useTheme();

	// Get the correct tRPC query key for the conversation list
	const listQueryKey = trpc.conversation.list.queryKey();

	const { data: conversations, isLoading } = useQuery(
		trpc.conversation.list.queryOptions(),
	);

	type ConversationListItem = {
		id: string;
		title: string;
		createdAt: string;
		updatedAt: string;
	};

	const deleteConversation = useMutation(
		trpc.conversation.delete.mutationOptions({
			onMutate: async (deletedConversation) => {
				// Cancel any outgoing refetches
				await queryClient.cancelQueries({
					queryKey: listQueryKey,
				});

				// Snapshot the previous value
				const previousConversations =
					queryClient.getQueryData<ConversationListItem[]>(listQueryKey);

				// Optimistically remove the conversation from the list
				queryClient.setQueryData<ConversationListItem[]>(
					listQueryKey,
					(old) =>
						old?.filter((conv) => conv.id !== deletedConversation.id) || [],
				);

				return { previousConversations };
			},
			onError: (_err, _deletedConversation, context) => {
				// Rollback on error
				if (context?.previousConversations) {
					queryClient.setQueryData(listQueryKey, context.previousConversations);
				}
			},
			onSuccess: (_data, deletedConversation) => {
				// Navigate away if we deleted the current conversation
				if (pathname === `/chat/${deletedConversation.id}`) {
					router.push("/chat");
				}
			},
		}),
	);

	const handleNewChat = () => {
		router.push("/chat");
		setMobileOpen(false);
	};

	const handleDelete = (e: React.MouseEvent, id: string) => {
		e.preventDefault();
		e.stopPropagation();
		deleteConversation.mutate({ id });
	};

	const handleSignOut = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					router.push("/login");
				},
			},
		});
	};

	const toggleTheme = () => {
		setTheme(theme === "dark" ? "light" : "dark");
	};

	const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center gap-2 p-3 border-b">
				{(!isCollapsed || isMobile) && (
					<div className="flex items-center gap-2 flex-1">
						<span className="font-semibold">Chatbot</span>
					</div>
				)}
				{!isMobile && (
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setIsCollapsed(!isCollapsed)}
						className={cn(isCollapsed && "mx-auto")}
					>
						{isCollapsed ? (
							<ChevronRight className="h-4 w-4" />
						) : (
							<ChevronLeft className="h-4 w-4" />
						)}
					</Button>
				)}
			</div>

			{/* New Chat Button */}
			<div className="p-3">
				<TooltipProvider delayDuration={0}>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								onClick={handleNewChat}
								className={cn(
									"w-full gap-2",
									isCollapsed && !isMobile
										? "justify-center px-2"
										: "justify-start",
								)}
								variant="outline"
							>
								<Plus className="h-4 w-4" />
								{(!isCollapsed || isMobile) && "Nouvelle Conversation"}
							</Button>
						</TooltipTrigger>
						{isCollapsed && !isMobile && (
							<TooltipContent side="right">
								Nouvelle Conversation
							</TooltipContent>
						)}
					</Tooltip>
				</TooltipProvider>
			</div>

			{/* Conversation List */}
			<ScrollArea className="flex-1 px-3 overflow-y-auto">
				<div className="space-y-1 pb-4">
					{isLoading ? (
						<div className="space-y-2">
							{[...Array(5)].map((_, i) => (
								<div
									key={i}
									className="h-10 bg-muted/50 rounded-md animate-pulse"
								/>
							))}
						</div>
					) : conversations?.length === 0 ? (
						(!isCollapsed || isMobile) && (
							<p className="text-sm text-muted-foreground px-2 py-4">
								Aucune conversation pour le moment
							</p>
						)
					) : (
						conversations?.map((conv) => {
							const isActive = pathname === `/chat/${conv.id}`;
							return (
								<TooltipProvider key={conv.id} delayDuration={0}>
									<Tooltip>
										<TooltipTrigger asChild>
											<Link
												href={`/chat/${conv.id}`}
												onClick={() => setMobileOpen(false)}
												className={cn(
													"flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent group min-w-0",
													isActive && "bg-accent",
													isCollapsed && !isMobile && "justify-center",
												)}
											>
												<MessageSquare className="h-4 w-4 shrink-0" />
												{(!isCollapsed || isMobile) && (
													<>
														<span className="flex-1 truncate min-w-0">
															{conv.title}
														</span>
														<Button
															variant="ghost"
															size="icon"
															className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
															onClick={(e) => handleDelete(e, conv.id)}
														>
															<Trash2 className="h-3 w-3" />
														</Button>
													</>
												)}
											</Link>
										</TooltipTrigger>
										{isCollapsed && !isMobile && (
											<TooltipContent side="right">{conv.title}</TooltipContent>
										)}
									</Tooltip>
								</TooltipProvider>
							);
						})
					)}
				</div>
			</ScrollArea>

			{/* Bottom Section - User Menu & Theme Toggle */}
			<div className="border-t p-3">
				<div
					className={cn(
						"flex items-center gap-2",
						isCollapsed && !isMobile && "flex-col",
					)}
				>
					{/* User Menu */}
					<DropdownMenu>
						{isCollapsed && !isMobile ? (
							<TooltipProvider delayDuration={0}>
								<Tooltip>
									<DropdownMenuTrigger asChild>
										<TooltipTrigger asChild>
											<Button variant="ghost" size="icon">
												<User className="h-4 w-4" />
											</Button>
										</TooltipTrigger>
									</DropdownMenuTrigger>
									<TooltipContent side="right">{user.name}</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						) : (
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									className="flex-1 justify-start gap-2 min-w-0"
								>
									<User className="h-4 w-4 shrink-0" />
									<span className="truncate">{user.name}</span>
								</Button>
							</DropdownMenuTrigger>
						)}
						<DropdownMenuContent side="top" align="start" className="w-56">
							<DropdownMenuLabel>{user.name}</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem className="text-muted-foreground">
								{user.email}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={handleSignOut}
								className="text-destructive"
							>
								<LogOut className="h-4 w-4 mr-2" />
								Se déconnecter
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Theme Toggle */}
					<TooltipProvider delayDuration={0}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									onClick={toggleTheme}
									className="shrink-0"
								>
									<Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
									<Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side={isCollapsed && !isMobile ? "right" : "top"}>
								Changer le thème
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			</div>
		</div>
	);

	return (
		<>
			{/* Mobile Sidebar */}
			<div className="md:hidden">
				<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
					<SheetTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="fixed left-4 top-4 z-40"
						>
							<Menu className="h-5 w-5" />
						</Button>
					</SheetTrigger>
					<SheetContent side="left" className="w-72 p-0">
						<SidebarContent isMobile />
					</SheetContent>
				</Sheet>
			</div>

			{/* Desktop Sidebar */}
			<aside
				className={cn(
					"hidden md:flex flex-col border-r bg-card transition-all duration-300",
					isCollapsed ? "w-16" : "w-64",
				)}
			>
				<SidebarContent />
			</aside>
		</>
	);
}
