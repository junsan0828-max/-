-- ============================================================
-- 전체 스키마 생성 SQL (Neon PostgreSQL용)
-- Neon 대시보드 → SQL Editor에서 전체 복사·붙여넣기 후 실행
-- ============================================================

CREATE TABLE IF NOT EXISTS "branches" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "createdAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "username" text NOT NULL UNIQUE,
  "password" text NOT NULL,
  "role" text DEFAULT 'trainer' NOT NULL,
  "createdAt" text DEFAULT now()::text NOT NULL,
  "updatedAt" text DEFAULT now()::text NOT NULL,
  "lastLoginAt" text
);

CREATE TABLE IF NOT EXISTS "trainers" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL UNIQUE,
  "trainerName" text NOT NULL,
  "phone" text,
  "email" text,
  "branchId" integer,
  "createdAt" text DEFAULT now()::text NOT NULL,
  "updatedAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "trainer_branches" (
  "id" serial PRIMARY KEY NOT NULL,
  "trainerId" integer NOT NULL,
  "branchId" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "trainer_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "trainerId" integer NOT NULL UNIQUE,
  "settlementRate" integer DEFAULT 50 NOT NULL,
  "createdAt" text DEFAULT now()::text NOT NULL,
  "updatedAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "members" (
  "id" serial PRIMARY KEY NOT NULL,
  "trainerId" integer NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "email" text,
  "birthDate" text,
  "gender" text,
  "grade" text DEFAULT 'basic' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "membershipStart" text,
  "membershipEnd" text,
  "profileNote" text,
  "visitRoute" text,
  "createdAt" text DEFAULT now()::text NOT NULL,
  "updatedAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "pt_packages" (
  "id" serial PRIMARY KEY NOT NULL,
  "memberId" integer NOT NULL,
  "trainerId" integer,
  "totalSessions" integer NOT NULL,
  "usedSessions" integer DEFAULT 0 NOT NULL,
  "packageName" text,
  "startDate" text,
  "expiryDate" text,
  "status" text DEFAULT 'active' NOT NULL,
  "price" integer,
  "pricePerSession" integer,
  "paymentAmount" integer,
  "unpaidAmount" integer,
  "paymentMethod" text,
  "paymentDate" text,
  "paymentMemo" text,
  "createdAt" text DEFAULT now()::text NOT NULL,
  "updatedAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "pt_pauses" (
  "id" serial PRIMARY KEY NOT NULL,
  "packageId" integer NOT NULL,
  "memberId" integer NOT NULL,
  "pauseStart" text NOT NULL,
  "pauseEnd" text,
  "reason" text,
  "createdAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "schedules" (
  "id" serial PRIMARY KEY NOT NULL,
  "memberId" integer NOT NULL,
  "trainerId" integer NOT NULL,
  "scheduledDate" text NOT NULL,
  "scheduledTime" text,
  "notes" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "createdAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "attendances" (
  "id" serial PRIMARY KEY NOT NULL,
  "memberId" integer NOT NULL,
  "trainerId" integer NOT NULL,
  "attendDate" text NOT NULL,
  "status" text DEFAULT 'attended' NOT NULL,
  "createdAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "pt_session_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "memberId" integer NOT NULL,
  "trainerId" integer NOT NULL,
  "packageId" integer,
  "sessionDate" text NOT NULL,
  "notes" text,
  "bodyPart" text,
  "exercisesJson" text,
  "goal" text,
  "feedback" text,
  "createdAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "workout_memos" (
  "id" serial PRIMARY KEY NOT NULL,
  "memberId" integer NOT NULL,
  "trainerId" integer NOT NULL,
  "memoDate" text NOT NULL,
  "content" text NOT NULL,
  "createdAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "par_q" (
  "id" serial PRIMARY KEY NOT NULL,
  "memberId" integer NOT NULL UNIQUE,
  "height" text, "weight" text, "muscleMass" text,
  "bodyFatPercent" text, "bodyFatKg" text,
  "waistCircumference" text,
  "systolicBp" text, "diastolicBp" text,
  "totalCholesterol" text, "hdlCholesterol" text,
  "ldlCholesterol" text, "triglycerides" text,
  "fastingBloodSugar" text, "postMealBloodSugar" text,
  "hba1c" text, "boneDensity" text,
  "occupation" text, "workEnvironment" text,
  "exerciseExperience" text, "visitRoute" text,
  "goal1" text, "goal2" text, "goal3" text,
  "dietIssues" text, "alcoholIssues" text,
  "sleepIssues" text, "activityIssues" text,
  "chronicDiseases" text, "musculoskeletalIssues" text,
  "posturalIssues" text,
  "createdAt" text DEFAULT now()::text NOT NULL,
  "updatedAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "attendance_checks" (
  "id" serial PRIMARY KEY NOT NULL,
  "memberId" integer NOT NULL,
  "trainerId" integer NOT NULL,
  "checkDate" text NOT NULL,
  "checkTime" text,
  "status" text DEFAULT 'attended' NOT NULL,
  "conditionScore" integer,
  "sleepHours" text,
  "energyLevel" text,
  "diet" text,
  "painLevel" integer,
  "painArea" text,
  "painSide" text,
  "notes" text,
  "createdAt" text DEFAULT now()::text NOT NULL,
  "updatedAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "report_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "token" text NOT NULL UNIQUE,
  "memberId" integer NOT NULL,
  "trainerId" integer NOT NULL,
  "createdAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "payments" (
  "id" serial PRIMARY KEY NOT NULL,
  "memberId" integer NOT NULL,
  "trainerId" integer,
  "amount" integer NOT NULL,
  "paymentDate" text,
  "paymentMethod" text,
  "memo" text,
  "createdAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "sheet_sync_config" (
  "id" serial PRIMARY KEY NOT NULL,
  "sheetUrl" text NOT NULL,
  "columnOffset" integer DEFAULT 1 NOT NULL,
  "lastSyncedCount" integer DEFAULT 0 NOT NULL,
  "mappingJson" text NOT NULL DEFAULT '{}',
  "enabled" integer DEFAULT 1 NOT NULL,
  "syncedAt" text,
  "createdAt" text DEFAULT now()::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "sheet_pending_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "email" text,
  "birthDate" text,
  "gender" text,
  "grade" text,
  "membershipStart" text,
  "membershipEnd" text,
  "profileNote" text,
  "ptProgram" text,
  "ptSessions" integer,
  "paymentAmount" integer,
  "unpaidAmount" integer,
  "paymentMethod" text,
  "sheetRowIndex" integer,
  "importedAt" text DEFAULT now()::text NOT NULL
);

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
