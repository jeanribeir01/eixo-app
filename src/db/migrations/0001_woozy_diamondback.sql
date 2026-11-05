CREATE TABLE `sync_meta` (
	`chave` text PRIMARY KEY NOT NULL,
	`valor` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usuario_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`email` text,
	`status` text NOT NULL,
	`perfil` text NOT NULL,
	`data_atualizacao` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `outbox` ADD `usuario_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `outbox` ADD `status` text DEFAULT 'pendente' NOT NULL;--> statement-breakpoint
ALTER TABLE `outbox` ADD `proxima_tentativa_em` text;--> statement-breakpoint
ALTER TABLE `outbox` ADD `codigo_erro` text;--> statement-breakpoint
ALTER TABLE `viagem` ADD `em_revisao` integer DEFAULT false NOT NULL;