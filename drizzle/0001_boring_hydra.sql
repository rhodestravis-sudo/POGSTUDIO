CREATE TABLE `beta_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_key` text NOT NULL,
	`user_email` text NOT NULL,
	`event_type` text NOT NULL,
	`action` text NOT NULL,
	`outcome` text NOT NULL,
	`details` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_beta_event_created_at` ON `beta_event` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_beta_event_user_created` ON `beta_event` (`user_key`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_beta_event_type_created` ON `beta_event` (`event_type`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_workspace_state` (
	`user_key` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL
);
