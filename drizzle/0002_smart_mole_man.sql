CREATE TABLE `bulk_courses` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`course_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`department` text NOT NULL,
	`category` text NOT NULL,
	`level` text NOT NULL,
	`status` text NOT NULL,
	`basis` text NOT NULL,
	`score` integer,
	`standard_title` text NOT NULL,
	`pair_count` integer NOT NULL,
	`result_path` text NOT NULL,
	`result_hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bulk_course_search` ON `bulk_courses` (`run_id`,`status`,`level`);--> statement-breakpoint
CREATE INDEX `bulk_course_score` ON `bulk_courses` (`run_id`,`score`);--> statement-breakpoint
CREATE TABLE `bulk_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`manifest` text NOT NULL
);
