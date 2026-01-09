CREATE TABLE "chat_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"start_turn" integer NOT NULL,
	"end_turn" integer NOT NULL,
	"total_tokens" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_summaries" ADD CONSTRAINT "chat_summaries_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;