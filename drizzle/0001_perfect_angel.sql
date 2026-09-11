CREATE TABLE `mapping_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`mapping_id` text NOT NULL,
	`revision` integer NOT NULL,
	`input_hash` text NOT NULL,
	`engine` text NOT NULL,
	`actor` text NOT NULL,
	`result` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analysis_mapping` ON `mapping_analyses` (`mapping_id`,`created_at`);