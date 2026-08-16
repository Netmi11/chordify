CREATE TABLE `chordshift_libraries` (
	`id` varchar(64) NOT NULL,
	`secretHash` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chordshift_libraries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chordshift_song_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`songId` int NOT NULL,
	`position` int NOT NULL,
	`label` text,
	`chord` text NOT NULL,
	`lyric` text NOT NULL,
	`tab` text,
	CONSTRAINT `chordshift_song_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `chordshift_song_lines_song_position_unique` UNIQUE(`songId`,`position`)
);
--> statement-breakpoint
CREATE TABLE `chordshift_songs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`libraryId` varchar(64) NOT NULL,
	`clientSongId` varchar(120) NOT NULL,
	`title` text NOT NULL,
	`artist` varchar(512) NOT NULL,
	`sourceUrl` varchar(2048) NOT NULL,
	`note` text NOT NULL,
	`addedAt` bigint NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chordshift_songs_id` PRIMARY KEY(`id`),
	CONSTRAINT `chordshift_songs_library_client_unique` UNIQUE(`libraryId`,`clientSongId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `chordshift_song_lines_song_index` ON `chordshift_song_lines` (`songId`);--> statement-breakpoint
CREATE INDEX `chordshift_songs_library_index` ON `chordshift_songs` (`libraryId`);