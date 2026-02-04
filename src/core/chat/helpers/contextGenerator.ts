import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { DatabaseService } from 'src/database/database.service';
import { chatMessages, chatSummaries } from 'src/database/schema';
import { desc, eq } from 'drizzle-orm';
import { Collection } from 'chromadb';

@Injectable()
export class ContextGeneratorService {
	constructor(private databaseService: DatabaseService) {}

	formatRecentHistory(
		messages: Array<{ turn: { user: string; assistant: string } }>
	): string {
		const recentMessages = messages.slice(-4);
		return recentMessages
			.map((m) => `User: ${m.turn.user}\nAssistant: ${m.turn.assistant}`)
			.join('\n\n');
	}

	async generateSummary(
		openai: OpenAI,
		chatId: string,
		count: number,
		messages: Array<{ turn: { user: string; assistant: string } }>,
		model: string
	): Promise<void> {
		if (count % 6 !== 1 || messages.length <= 4) {
			return;
		}

		const messagesToSummarize = messages.slice(0, -4);
		const historyToSummarize = messagesToSummarize
			.map((m) => `User: ${m.turn.user}\nAssistant: ${m.turn.assistant}`)
			.join('\n\n');

		const memGenerationPrompt = `
You are a memory compression engine for an AI tutor.

Your task is to summarize a sequence of chat turns into a compact, 
loss-minimized memory that will be reused as context in future conversations.

Rules:
- Preserve facts, definitions, decisions, constraints, and conclusions.
- Preserve the user's goals, misunderstandings, and corrections.
- Preserve unresolved questions or tasks.
- Remove greetings, filler, repetition, and stylistic phrasing.
- Do NOT invent information.
- Do NOT explain; only summarize.
- Be concise and information-dense.
- Write in neutral third-person form.

chat history:
${historyToSummarize}
		`;

		const summaryAICompletion = await openai.chat.completions.create({
			model: 'gpt-5-nano',
			messages: [
				{
					role: 'user',
					content: memGenerationPrompt,
				},
			],
			temperature: 0.3,
			max_completion_tokens: 700,
		});

		const summaryAIResponse =
			summaryAICompletion?.choices[0]?.message?.content;

		const existingSummaries = await this.databaseService.db
			.select()
			.from(chatSummaries)
			.where(eq(chatSummaries.chatId, chatId))
			.orderBy(desc(chatSummaries.createdAt));

		const startTurn =
			existingSummaries.length > 0 ? existingSummaries[0].endTurn + 1 : 1;

		await this.databaseService.db.insert(chatSummaries).values({
			chatId,
			summary: summaryAIResponse || 'No summary generated',
			startTurn,
			endTurn: count - 4,
			totalTokens: summaryAICompletion?.usage?.total_tokens || 0,
		});
	}

	async getLatestSummary(chatId: string): Promise<string> {
		const latestSummary =
			await this.databaseService.db.query.chatSummaries.findFirst({
				where: eq(chatSummaries.chatId, chatId),
				orderBy: desc(chatSummaries.createdAt),
			});

		return latestSummary?.summary || '';
	}

	async rewriteQuery(
		openai: OpenAI,
		message: string,
		messages: Array<{ turn: { user: string; assistant: string } }>
	): Promise<string> {
		// Get last 2 turns for context
		const lastTwoTurns = messages.slice(-2);

		if (lastTwoTurns.length === 0) {
			// No context, return original query
			return message;
		}

		const conversationContext = lastTwoTurns
			.map((m) => `User: ${m.turn.user}\nAssistant: ${m.turn.assistant}`)
			.join('\n\n');

		const rewritePrompt = `Given the following conversation context and a new user query, rewrite the query to be more specific and contextually relevant for document retrieval.

Conversation context:
${conversationContext}

New user query: ${message}

Rewrite the query to include relevant context from the conversation that would help retrieve the most relevant documents. If the query is already clear and specific, you may return it as is. Only return the rewritten query, nothing else.`;

		try {
			const completion = await openai.chat.completions.create({
				model: 'gpt-5-nano',
				messages: [
					{
						role: 'user',
						content: rewritePrompt,
					},
				],
				temperature: 0.3,
				max_completion_tokens: 300,
			});

			const rewrittenQuery =
				completion?.choices[0]?.message?.content?.trim();
			return rewrittenQuery || message;
		} catch (error) {
			console.error('Error rewriting query:', error);
			// Fallback to original message if rewriting fails
			return message;
		}
	}

	async retrieveDocumentContext(
		collection: Collection,
		generateEmbeddings: (texts: string[]) => Promise<number[][]>,
		message: string,
		chatId: string,
		userId: string,
		selectedDocumentIds: string[],
		openai: OpenAI,
		messages: Array<{ turn: { user: string; assistant: string } }>
	): Promise<{
		context: string;
		retrievedMetadatas: any[];
		retrievedDocs: any[];
	}> {
		// Skip query rewriting if no conversation history (saves 50-200ms)
		// Use original query directly for first message or when no context available
		let queryToUse = message;

		// 4 because 4 turns are always in memory / recent history
		if (messages.length > 4) {
			// Only rewrite query if there's conversation history to leverage
			queryToUse = await this.rewriteQuery(openai, message, messages);
		}

		const [queryEmbedding] = await generateEmbeddings([queryToUse]);

		const whereFilter: Record<string, any> = {
			$and: [
				{ chatId: String(chatId) },
				{ userId: String(userId) },
				{ documentId: { $in: selectedDocumentIds } },
			],
		};

		const queryResult = await collection.query({
			queryEmbeddings: [queryEmbedding],
			nResults: 4,
			where: whereFilter,
		});

		const retrievedDocs = queryResult.documents[0] || [];
		const retrievedMetadatas = queryResult.metadatas[0] || [];

		const context = retrievedDocs
			.map((doc, idx) => {
				const metadata = retrievedMetadatas[idx];
				return `[Page ${metadata?.page || 'N/A'} - ${
					metadata?.fileName || 'Unknown'
				}]\n${doc}`;
			})
			.join('\n\n');

		return { context, retrievedMetadatas, retrievedDocs };
	}

	buildPrompt(
		userEducationLevel: string | null | undefined,
		recentHistory: string,
		olderSummaryText: string,
		documentContext: string,
		message: string,
		pageNumber?: number,
		pageContent?: string
	): string {
		let prompt = `
User education level: ${userEducationLevel}

recent chat history:
${recentHistory || 'No recent history yet'}

older chat summary:
${olderSummaryText || 'No prior summary available'}
		`;

		if (documentContext) {
			prompt = `
${prompt}

Extracted context from user uploaded document(s):
${documentContext}
			`;
		}

		if (pageNumber && pageContent) {
			prompt += `\n\nUser is currently viewing page ${pageNumber} which contains the following content:\n${pageContent}`;
		}

		prompt += `\n\nUser Query: ${message}`;

		return prompt;
	}
}
