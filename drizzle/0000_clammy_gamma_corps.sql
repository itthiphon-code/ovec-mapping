CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`level` text NOT NULL,
	`category` text NOT NULL,
	`department` text NOT NULL,
	`payload` text NOT NULL,
	`detail` text,
	`source_url` text NOT NULL,
	`fetched_at` text NOT NULL,
	`hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `catalog_search` ON `catalog` (`kind`,`level`);--> statement-breakpoint
CREATE INDEX `catalog_code` ON `catalog` (`code`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`hash` text NOT NULL,
	`storage_key` text NOT NULL,
	`status` text DEFAULT 'UPLOADED' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`course_id` text NOT NULL,
	`standard_id` text NOT NULL,
	`owner` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`payload` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mapping_status` ON `mappings` (`status`);--> statement-breakpoint
CREATE INDEX `mapping_owner` ON `mappings` (`owner`);--> statement-breakpoint
CREATE TABLE `members` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`scope` text DEFAULT '' NOT NULL,
	`valid_until` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`mapping_id` text NOT NULL,
	`revision` integer NOT NULL,
	`reviewer` text NOT NULL,
	`role` text NOT NULL,
	`verdict` text NOT NULL,
	`comment` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_once` ON `reviews` (`mapping_id`,`revision`,`reviewer`);--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`mapping_id` text NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL,
	`hash` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `revision_unique` ON `revisions` (`mapping_id`,`revision`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`kind` text NOT NULL,
	`count` integer NOT NULL,
	`status` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
