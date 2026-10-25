CREATE TABLE `motorista` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `outbox` ADD `situacao` text DEFAULT 'pendente' NOT NULL;--> statement-breakpoint
ALTER TABLE `outbox` ADD `proxima_tentativa_em` text;