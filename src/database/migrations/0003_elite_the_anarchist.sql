ALTER TABLE "auth_accounts" DROP CONSTRAINT "auth_accounts_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_chat_id_chats_id_fk";
--> statement-breakpoint
ALTER TABLE "chats" DROP CONSTRAINT "chats_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "chats" ALTER COLUMN "title" SET DATA TYPE varchar(16);--> statement-breakpoint
ALTER TABLE "chats" ALTER COLUMN "title" SET DEFAULT 'Untitled Chat';--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "turn" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "total_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "chat_messages" DROP COLUMN "content";--> statement-breakpoint
ALTER TABLE "chat_messages" DROP COLUMN "openai_message_id";--> statement-breakpoint
ALTER TABLE "chats" DROP COLUMN "thread_id";--> statement-breakpoint
ALTER TABLE "chats" DROP COLUMN "document_count";