import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@repo/api/context";
import { appRouter } from "@repo/api/routers/index";
import { auth } from "@repo/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { streamText, type CoreMessage } from "ai";
import { createOllama } from "ai-sdk-ollama";
import type { Message } from "@repo/db";

const ollama = createOllama({
	baseURL: process.env.LLAMA_URL_ORIGIN,
});

const RAG_API_BASE_URL = process.env.RAG_API_BASE_URL || "";
const MAX_HISTORY_TOKENS = Number.parseInt(
	process.env.MAX_HISTORY_TOKENS || "2000",
	10,
);

// RAG API response types
type RAGChunk = {
	id: string;
	content: string;
	metadata: Record<string, unknown>;
	similarity: number;
};

type RAGResponse = {
	query: string;
	results: RAGChunk[];
	count: number;
};

// Fetch RAG chunks from the API
async function fetchRAGChunks(query: string): Promise<RAGChunk[]> {
	if (!RAG_API_BASE_URL) {
		console.warn("RAG_API_BASE_URL not configured, skipping RAG fetch");
		return [];
	}

	try {
		const response = await fetch(`${RAG_API_BASE_URL}/query`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query }),
		});

		if (!response.ok) {
			throw new Error(`RAG API returned ${response.status}`);
		}

		const data = (await response.json()) as RAGResponse;
		return data.results || [];
	} catch (error) {
		console.error("Error fetching RAG chunks:", error);
		return [];
	}
}

// Approximate token count (rough estimate: ~4 chars per token)
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

// Limit conversation history by token count used here since the local model doesn't have lot of room for context window
function limitHistoryByTokens(
	messages: Message[],
	maxTokens: number,
): Message[] {
	if (messages.length === 0) return [];

	// Start from the most recent messages and work backwards
	const limited: Message[] = [];
	let tokenCount = 0;

	// Process messages in reverse order (most recent first)
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (!message) continue;
		const messageTokens = estimateTokens(message.content);

		// If adding this message would exceed the limit, stop
		if (tokenCount + messageTokens > maxTokens && limited.length > 0) {
			break;
		}

		// Add message to the beginning of the array (since we're going backwards)
		limited.unshift(message);
		tokenCount += messageTokens;
	}

	return limited;
}

// Build enhanced messages with system prompt, RAG context, history, and current question
function buildEnhancedMessages(
	currentQuestion: string,
	ragChunks: RAGChunk[],
	history: Message[],
	systemPrompt = "You are a helpful assistant. Use the provided context to answer questions accurately and comprehensively.",
): CoreMessage[] {
	const messages: CoreMessage[] = [];

	// Add system prompt
	messages.push({
		role: "system",
		content: systemPrompt,
	});

	// Build RAG context string
	let ragContext = "";
	if (ragChunks.length > 0) {
		ragContext = "Relevant Context:\n";
		ragChunks.forEach((chunk, index) => {
			ragContext += `[Context ${index + 1}]\n${chunk.content}\n\n`;
		});
	}

	// Add history messages (convert to CoreMessage format)
	history.forEach((msg) => {
		messages.push({
			role: msg.role,
			content: msg.content,
		});
	});

	// Add current question with RAG context if available
	const userMessageContent = ragContext
		? `${ragContext}\nQuestion: ${currentQuestion}`
		: currentQuestion;

	messages.push({
		role: "user",
		content: userMessageContent,
	});

	return messages;
}

const app = new Hono();

app.use(logger());

app.use(
	"/*",
	cors({
		origin: process.env.CORS_ORIGIN || "",
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		createContext: (_opts, context) => {
			return createContext({ context });
		},
	}),
);

app.post("/ai", async (c) => {
	const body = await c.req.json();
	const uiMessages = body.messages || [];

	let allMessages: Message[] = [];
	let currentQuestion = "";

	// Convert UI messages to Message format
	// Handle both 'content' (string) and 'parts' (array) formats from AI SDK
	if (uiMessages.length > 0) {
		allMessages = uiMessages.map(
			(msg: {
				id?: string;
				role: string;
				content?: string;
				text?: string;
				parts?: Array<{ type: string; text?: string }>;
				createdAt?: string;
			}) => {
				let content = "";

				// Handle 'parts' format (from AI SDK)
				if (msg.parts && Array.isArray(msg.parts)) {
					content = msg.parts
						.filter((p) => p.type === "text" && p.text)
						.map((p) => p.text || "")
						.join("");
				}
				// Handle 'content' format (string)
				else if (typeof msg.content === "string") {
					content = msg.content;
				}
				// Handle 'content' format (object/other)
				else if (msg.content) {
					content = JSON.stringify(msg.content);
				}
				// Handle 'text' format (direct text property)
				else if (typeof msg.text === "string") {
					content = msg.text;
				}

				return {
					id: msg.id || crypto.randomUUID(),
					role: msg.role as "user" | "assistant",
					content,
					createdAt: msg.createdAt || new Date().toISOString(),
				};
			},
		);
	}

	// Extract current question (last user message)
	const lastUserMessageIndex = allMessages
		.map((msg, idx) => (msg.role === "user" ? idx : -1))
		.filter((idx) => idx !== -1)
		.pop();

	if (lastUserMessageIndex === undefined || lastUserMessageIndex < 0) {
		return c.json({ error: "No user message found" }, 400);
	}

	const lastUserMessage = allMessages[lastUserMessageIndex];
	if (!lastUserMessage) {
		return c.json({ error: "Invalid message index" }, 400);
	}

	currentQuestion = lastUserMessage.content;

	// Debug logging
	console.log("allMessages length:", allMessages.length);
	console.log("lastUserMessageIndex:", lastUserMessageIndex);
	console.log("lastUserMessage:", JSON.stringify(lastUserMessage, null, 2));
	console.log("currentQuestion:", currentQuestion);
	console.log(
		"uiMessages sample:",
		JSON.stringify(uiMessages.slice(-2), null, 2),
	);

	if (!currentQuestion || currentQuestion.trim() === "") {
		console.error(
			"currentQuestion is empty! All messages:",
			JSON.stringify(allMessages, null, 2),
		);
		return c.json({ error: "Current question is empty" }, 400);
	}

	// Fetch RAG chunks for the current question
	const ragChunks = await fetchRAGChunks(currentQuestion);

	// Remove the last user message and everything after it from history
	// (we'll add the question back with RAG context)
	const historyWithoutCurrent = allMessages.slice(0, lastUserMessageIndex);

	// Limit history by tokens
	const limitedHistory = limitHistoryByTokens(
		historyWithoutCurrent,
		MAX_HISTORY_TOKENS,
	);

	const systemPrompt = `Tu es **PhosExpert**, un assistant technique spécialisé dans la production d'acide phosphorique par voie humide (procédé dihydrate). Tu assistes les opérateurs et superviseurs de l'usine Maroc Phosphore située à Jorf Lasfar dans leurs tâches quotidiennes d'exploitation, de maintenance et de résolution de problèmes.

      ## Domaine d'Expertise

      Tu possèdes une expertise approfondie dans :
      - Le procédé dihydrate de Jacobs pour la production d'acide phosphorique
      - La chimie des réactions d'attaque phosphate-acide sulfurique (Ca₃(PO₄)₂ + 3H₂SO₄ + 6H₂O → 2H₃PO₄ + 3CaSO₄·2H₂O)
      - La cristallisation du gypse et le contrôle de la sursaturation
      - Les opérations de filtration, concentration et clarification
      - Les paramètres de contrôle du procédé et l'optimisation du rendement
      - Les procédures de sécurité industrielle

      ### Zones Techniques Couvertes
      1. **Zone 402A** : Épaississement de la pulpe de phosphate (53% → 65% solides)
      2. **Zone 403A** : Réaction (réacteur annulaire Jacobs à 82°C) et filtration (filtres à cellules basculantes)
      3. **Zone 413A** : Clarification et stockage à 28% P₂O₅
      4. **Zone 404** : Concentration/évaporation (28% → 54% P₂O₅), récupération FSA
      5. **Zone 414** : Clarification et stockage à 54% P₂O₅
      6. **Zone 425** : Utilités (tour de refroidissement, condensat de traitement)

      ## Règles Strictes de Comportement

      ### Validation des Connaissances (Mode Strict)

      **AVANT CHAQUE RÉPONSE**, tu dois vérifier :
      1. Le contexte récupéré est-il directement pertinent à la question ?
      2. Les informations sont-elles suffisamment détaillées pour une réponse précise ?
      3. La question relève-t-elle de ton domaine d'expertise ?

      ### Réponses en cas d'informations insuffisantes

      **Si le contexte est insuffisant ou non pertinent :**
      "Je suis désolé, mais je ne dispose pas d'informations suffisantes dans ma base de connaissances pour répondre précisément à cette question. Je préfère ne pas spéculer pour éviter de vous donner des informations incorrectes.

      Puis-je vous aider avec un autre aspect du procédé de production d'acide phosphorique ?"

      **Si la question est hors domaine :**
      "Cette question sort de mon domaine d'expertise qui se limite à la production d'acide phosphorique par voie humide et aux opérations de l'usine.

      Je peux vous assister sur :
      • La chimie du procédé (réaction, cristallisation, filtration)
      • Les paramètres de contrôle et l'optimisation
      • Les procédures opératoires et de maintenance
      • La sécurité industrielle liée à notre activité

      Avez-vous une question sur l'un de ces sujets ?"

      ## Format des Réponses

      ### Structure
      1. **Réponse directe** : Commence par répondre clairement à la question
      2. **Explications techniques** : Développe les mécanismes chimiques ou physiques
      3. **Valeurs de référence** : Cite les paramètres opératoires (températures, concentrations, débits)
      4. **Implications pratiques** : Conséquences et recommandations opérationnelles
      5. **Points de vigilance** : Risques et précautions

      ### Conventions
      - Utilise le **gras** pour les termes techniques clés
      - Formules chimiques : H₂SO₄, H₃PO₄, CaSO₄·2H₂O, SO₄²⁻, P₂O₅
      - Unités : °C, mm Hg, m³/h, kg/cm²(g), % en poids
      - Codes équipements : 403AAM01 (réacteur), 403AAS02 (filtres), etc.
      - Langue : Toujours en **français**

      ## Paramètres Critiques du Procédé

      - **Température de réaction** : 82°C (favorise le dihydrate)
      - **Flash Cooler** : Refroidissement limité à 2,5°C (évite nucléation excessive)
      - **Temps de séjour** : ~4 heures (réacteur + maturation)
      - **Acide produit** : 28% P₂O₅ (filtration), 54% P₂O₅ (concentration)
      - **Récupération P₂O₅** : ~95% (sections réaction/filtration)
      - **Solides pulpe épaissie** : 65%

      ## Rappels de Sécurité (à intégrer si pertinent)

      ### Produits Dangereux
      - **H₂SO₄ (98,5%)** : Corrosif sévère, réaction violente avec l'eau
      - **H₃PO₄** : Corrosif, irritant
      - **FSA** : Toxique, corrosif
      - **Fluorures gazeux** : Toxiques (émissions < 5 mg/Nm³)

      ### EPI Requis
      - Lunettes/écran facial, gants anti-acide, combinaison chimique, bottes sécurité

      ## Interdictions

      Tu dois TOUJOURS refuser de :
      - Inventer ou spéculer sur des informations non présentes dans le contexte
      - Répondre à des questions hors domaine (autres procédés, autres usines, sujets personnels)
      - Donner des conseils de conception ou modification d'installation
      - Fournir des informations confidentielles non documentées

      ## Instruction Finale

      Sois précis, technique mais accessible, orienté vers la pratique opérationnelle. Intègre les rappels de sécurité pertinents. Reconnais tes limites avec professionnalisme et oriente vers les ressources appropriées si nécessaire.
    `;

	// Build enhanced messages
	const enhancedMessages = buildEnhancedMessages(
		currentQuestion,
		ragChunks,
		limitedHistory,
		systemPrompt,
	);

	// Stream response
	const result = streamText({
		model: ollama("llama3.2"),
		messages: enhancedMessages,
		abortSignal: c.req.raw.signal,
	});

	return result.toUIMessageStreamResponse();
});

app.get("/", (c) => {
	return c.text("OK");
});

export default app;
