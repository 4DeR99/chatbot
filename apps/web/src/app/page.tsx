"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, MessageSquare, Zap } from "lucide-react";

export default function LandingPage() {
	return (
		<div className="min-h-screen w-full bg-black relative overflow-hidden">
			{/* Dark Noise Colored Background */}
			<div
				className="absolute inset-0 z-0"
				style={{
					background: "#000000",
					backgroundImage: `
						radial-gradient(circle at 1px 1px, rgba(139, 92, 246, 0.2) 1px, transparent 0),
						radial-gradient(circle at 1px 1px, rgba(59, 130, 246, 0.18) 1px, transparent 0),
						radial-gradient(circle at 1px 1px, rgba(236, 72, 153, 0.15) 1px, transparent 0)
					`,
					backgroundSize: "20px 20px, 30px 30px, 25px 25px",
					backgroundPosition: "0 0, 10px 10px, 15px 5px",
				}}
			/>

			{/* Content */}
			<div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-16">
				<div className="w-full max-w-4xl mx-auto text-center space-y-12">
					{/* Hero Section */}
					<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
						<h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white">
							Votre Assistant de
							<br />
							<span className="bg-linear-to-r from-purple-400 via-blue-400 to-pink-400 bg-clip-text text-transparent">
								Gestion des
							</span>
							<br />
							Connaissances
						</h1>

						<p className="text-xl md:text-2xl text-white/70 max-w-2xl mx-auto leading-relaxed">
							Transformez votre façon d'interagir avec l'information. Obtenez
							des réponses instantanées, des insights et une assistance quand
							vous en avez besoin.
						</p>

						<div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
							<Button
								asChild
								size="lg"
								className="bg-white text-black hover:bg-white/90 text-lg px-8 py-6 group"
							>
								<Link href="/chat">
									Commencer
									<ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
								</Link>
							</Button>
						</div>
					</div>

					{/* Features Grid */}
					<div className="grid md:grid-cols-3 gap-6 pt-16 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
						<div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
							<div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-purple-500/20 mb-4">
								<MessageSquare className="h-6 w-6 text-purple-400" />
							</div>
							<h3 className="text-xl font-semibold text-white mb-2">
								Conversations Naturelles
							</h3>
							<p className="text-white/60 leading-relaxed">
								Discutez naturellement et obtenez des réponses contextuelles qui
								comprennent vos besoins et vos intentions.
							</p>
						</div>

						<div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
							<div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-500/20 mb-4">
								<Zap className="h-6 w-6 text-blue-400" />
							</div>
							<h3 className="text-xl font-semibold text-white mb-2">
								Ultra Rapide
							</h3>
							<p className="text-white/60 leading-relaxed">
								Obtenez des réponses instantanées avec notre infrastructure
								optimisée conçue pour la vitesse et la fiabilité.
							</p>
						</div>

						<div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
							<div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-pink-500/20 mb-4">
								<Sparkles className="h-6 w-6 text-pink-400" />
							</div>
							<h3 className="text-xl font-semibold text-white mb-2">
								Intelligent et Contextuel
							</h3>
							<p className="text-white/60 leading-relaxed">
								Maintenez le contexte à travers les conversations et obtenez une
								assistance personnalisée qui apprend de vos interactions.
							</p>
						</div>
					</div>
				</div>

				{/* Bottom CTA */}
				<div className="mt-20 text-center animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
					<p className="text-white/50 text-sm">
						Vous avez déjà un compte ?{" "}
						<Link
							href="/login"
							className="text-white hover:text-white/80 underline underline-offset-4 transition-colors"
						>
							Se connecter
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
