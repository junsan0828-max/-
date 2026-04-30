-- 자이언트짐+ 테이블 생성

CREATE TABLE IF NOT EXISTS "gym_plus_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "username" text NOT NULL UNIQUE,
  "password" text NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "email" text,
  "memberId" integer,
  "membershipType" text DEFAULT 'general' NOT NULL,
  "membershipStart" text,
  "membershipEnd" text,
  "isActive" integer DEFAULT 1 NOT NULL,
  "createdAt" text DEFAULT now()::text NOT NULL,
  "updatedAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "gym_plus_video_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "createdAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "gym_plus_videos" (
  "id" serial PRIMARY KEY NOT NULL,
  "categoryId" integer,
  "title" text NOT NULL,
  "description" text,
  "videoUrl" text NOT NULL,
  "thumbnailUrl" text,
  "duration" text,
  "level" text DEFAULT 'beginner' NOT NULL,
  "bodyPart" text,
  "isPublished" integer DEFAULT 1 NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "createdAt" text DEFAULT now()::text NOT NULL,
  "updatedAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "gym_plus_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "imageUrl" text,
  "eventType" text DEFAULT 'notice' NOT NULL,
  "startDate" text,
  "endDate" text,
  "isPublished" integer DEFAULT 1 NOT NULL,
  "isPinned" integer DEFAULT 0 NOT NULL,
  "createdAt" text DEFAULT now()::text NOT NULL,
  "updatedAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "gym_plus_workout_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "gymPlusMemberId" integer NOT NULL,
  "logDate" text NOT NULL,
  "title" text,
  "exercisesJson" text,
  "durationMinutes" integer,
  "caloriesBurned" integer,
  "bodyWeight" text,
  "notes" text,
  "mood" text,
  "createdAt" text DEFAULT now()::text NOT NULL,
  "updatedAt" text DEFAULT now()::text NOT NULL
);
