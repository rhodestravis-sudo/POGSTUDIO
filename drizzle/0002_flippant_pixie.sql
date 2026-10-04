CREATE TABLE `app_session` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_app_session_email` ON `app_session` (`email`);--> statement-breakpoint
CREATE INDEX `idx_app_session_expires_at` ON `app_session` (`expires_at`);