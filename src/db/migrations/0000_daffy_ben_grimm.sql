CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`entidade` text NOT NULL,
	`operacao` text NOT NULL,
	`payload` text NOT NULL,
	`tentativas` integer DEFAULT 0 NOT NULL,
	`criado_em` text NOT NULL,
	`ultimo_erro` text
);
--> statement-breakpoint
CREATE TABLE `rota` (
	`id` text PRIMARY KEY NOT NULL,
	`cidade_origem` text NOT NULL,
	`cidade_destino` text NOT NULL,
	`uf_origem` text NOT NULL,
	`uf_destino` text NOT NULL,
	`distancia_estimada_km` real NOT NULL,
	`ativa` integer DEFAULT true NOT NULL,
	`data_inclusao` text NOT NULL,
	`data_atualizacao` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `veiculo` (
	`id` text PRIMARY KEY NOT NULL,
	`placa` text NOT NULL,
	`marca` text NOT NULL,
	`modelo` text NOT NULL,
	`capacidade_carga` real NOT NULL,
	`status` text DEFAULT 'Disponivel' NOT NULL,
	`ano_fabricacao` integer,
	`data_inclusao` text NOT NULL,
	`data_atualizacao` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `veiculo_placa_unique` ON `veiculo` (`placa`);--> statement-breakpoint
CREATE TABLE `viagem` (
	`id` text PRIMARY KEY NOT NULL,
	`veiculo_id` text NOT NULL,
	`rota_id` text NOT NULL,
	`motorista_id` text NOT NULL,
	`hodometro_inicial` real NOT NULL,
	`hodometro_final` real,
	`data_inicio` text,
	`data_fim` text,
	`status` text DEFAULT 'EmAndamento' NOT NULL,
	`km_rodado` real,
	`data_inclusao` text NOT NULL,
	`data_atualizacao` text NOT NULL,
	FOREIGN KEY (`veiculo_id`) REFERENCES `veiculo`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rota_id`) REFERENCES `rota`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `viagem_um_andamento_por_veiculo` ON `viagem` (`veiculo_id`) WHERE "viagem"."status" = 'EmAndamento';