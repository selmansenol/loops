CREATE TYPE "public"."priority_bucket" AS ENUM('now', 'next', 'later');--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "priority_bucket" "priority_bucket";