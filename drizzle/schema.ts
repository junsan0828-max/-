import {
  sqliteTable,
  integer,
  text,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const now = sql`(datetime('now'))`;

// 사용자 (관리자 / 트레이너)
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "trainer"] }).default("trainer").notNull(),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

// 트레이너 프로필
export const trainers = sqliteTable("trainers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().unique(),
  trainerName: text("trainerName").notNull(),
  phone: text("phone"),
  email: text("email"),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

// 트레이너 설정
export const trainerSettings = sqliteTable("trainer_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trainerId: integer("trainerId").notNull().unique(),
  settlementRate: integer("settlementRate").default(50).notNull(),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

// 회원
export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trainerId: integer("trainerId").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  birthDate: text("birthDate"),
  gender: text("gender", { enum: ["male", "female", "other"] }),
  grade: text("grade", { enum: ["basic", "premium", "vip"] }).default("basic").notNull(),
  status: text("status", { enum: ["active", "paused"] }).default("active").notNull(),
  membershipStart: text("membershipStart"),
  membershipEnd: text("membershipEnd"),
  profileNote: text("profileNote"),
  visitRoute: text("visitRoute"),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

// PT 패키지
export const ptPackages = sqliteTable("pt_packages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("memberId").notNull(),
  trainerId: integer("trainerId"),
  totalSessions: integer("totalSessions").notNull(),
  usedSessions: integer("usedSessions").default(0).notNull(),
  packageName: text("packageName"),
  startDate: text("startDate"),
  expiryDate: text("expiryDate"),
  status: text("status", { enum: ["active", "paused", "completed", "expired", "refunded"] }).default("active").notNull(),
  price: integer("price"),
  pricePerSession: integer("pricePerSession"),
  paymentAmount: integer("paymentAmount"),
  unpaidAmount: integer("unpaidAmount"),
  paymentMethod: text("paymentMethod", { enum: ["현금영수증", "이체", "지역화폐", "카드"] }),
  paymentDate: text("paymentDate"),
  paymentMemo: text("paymentMemo"),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

// PT 정지 내역
export const ptPauses = sqliteTable("pt_pauses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  packageId: integer("packageId").notNull(),
  memberId: integer("memberId").notNull(),
  pauseStart: text("pauseStart").notNull(),
  pauseEnd: text("pauseEnd"),
  reason: text("reason"),
  createdAt: text("createdAt").default(now).notNull(),
});

// 예약/일정
export const schedules = sqliteTable("schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("memberId").notNull(),
  trainerId: integer("trainerId").notNull(),
  scheduledDate: text("scheduledDate").notNull(),
  scheduledTime: text("scheduledTime"),
  notes: text("notes"),
  status: text("status", { enum: ["pending", "done", "cancelled"] }).default("pending").notNull(),
  createdAt: text("createdAt").default(now).notNull(),
});

// 출석
export const attendances = sqliteTable("attendances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("memberId").notNull(),
  trainerId: integer("trainerId").notNull(),
  attendDate: text("attendDate").notNull(),
  status: text("status", { enum: ["attended", "absent", "noshow"] }).default("attended").notNull(),
  createdAt: text("createdAt").default(now).notNull(),
});

// PT 세션 로그
export const ptSessionLogs = sqliteTable("pt_session_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("memberId").notNull(),
  trainerId: integer("trainerId").notNull(),
  packageId: integer("packageId"),
  sessionDate: text("sessionDate").notNull(),
  notes: text("notes"),
  bodyPart: text("bodyPart"),
  exercisesJson: text("exercisesJson"),
  createdAt: text("createdAt").default(now).notNull(),
});

// 운동 메모
export const workoutMemos = sqliteTable("workout_memos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("memberId").notNull(),
  trainerId: integer("trainerId").notNull(),
  memoDate: text("memoDate").notNull(),
  content: text("content").notNull(),
  createdAt: text("createdAt").default(now).notNull(),
});

// PAR-Q 사전건강검사
export const parQ = sqliteTable("par_q", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("memberId").notNull().unique(),
  // 신체 정보
  height: text("height"),
  weight: text("weight"),
  muscleMass: text("muscleMass"),
  bodyFatPercent: text("bodyFatPercent"),
  bodyFatKg: text("bodyFatKg"),
  waistCircumference: text("waistCircumference"),
  // 건강 정보
  systolicBp: text("systolicBp"),
  diastolicBp: text("diastolicBp"),
  totalCholesterol: text("totalCholesterol"),
  hdlCholesterol: text("hdlCholesterol"),
  ldlCholesterol: text("ldlCholesterol"),
  triglycerides: text("triglycerides"),
  fastingBloodSugar: text("fastingBloodSugar"),
  postMealBloodSugar: text("postMealBloodSugar"),
  hba1c: text("hba1c"),
  boneDensity: text("boneDensity"),
  // 직업 및 생활
  occupation: text("occupation"),
  workEnvironment: text("workEnvironment"),
  exerciseExperience: text("exerciseExperience"),
  visitRoute: text("visitRoute"),
  // 운동 목적
  goal1: text("goal1"),
  goal2: text("goal2"),
  goal3: text("goal3"),
  // 생활 습관
  dietIssues: text("dietIssues"),
  alcoholIssues: text("alcoholIssues"),
  sleepIssues: text("sleepIssues"),
  activityIssues: text("activityIssues"),
  // 질환 정보
  chronicDiseases: text("chronicDiseases"),
  musculoskeletalIssues: text("musculoskeletalIssues"),
  posturalIssues: text("posturalIssues"),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

// 수업 전 컨디션 체크
export const attendanceChecks = sqliteTable("attendance_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("memberId").notNull(),
  trainerId: integer("trainerId").notNull(),
  checkDate: text("checkDate").notNull(),
  checkTime: text("checkTime"),
  status: text("status", { enum: ["attended", "noshow", "cancelled"] }).default("attended").notNull(),
  conditionScore: integer("conditionScore"),
  sleepHours: text("sleepHours"),
  energyLevel: text("energyLevel"),
  diet: text("diet"),
  painLevel: integer("painLevel"),
  painArea: text("painArea"),
  painSide: text("painSide"),
  notes: text("notes"),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

// 보고서 공유 토큰
export const reportTokens = sqliteTable("report_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  memberId: integer("memberId").notNull(),
  trainerId: integer("trainerId").notNull(),
  createdAt: text("createdAt").default(now).notNull(),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("memberId").notNull(),
  trainerId: integer("trainerId"),
  amount: integer("amount").notNull(),
  paymentDate: text("paymentDate"),
  paymentMethod: text("paymentMethod", { enum: ["현금영수증", "이체", "지역화폐", "카드"] }),
  memo: text("memo"),
  createdAt: text("createdAt").default(now).notNull(),
});

// 구글시트 자동 동기화 설정
export const sheetSyncConfig = sqliteTable("sheet_sync_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sheetUrl: text("sheetUrl").notNull(),
  columnOffset: integer("columnOffset").default(1).notNull(),
  lastSyncedCount: integer("lastSyncedCount").default(0).notNull(),
  mappingJson: text("mappingJson").notNull().default("{}"),
  enabled: integer("enabled").default(1).notNull(),
  syncedAt: text("syncedAt"),
  createdAt: text("createdAt").default(now).notNull(),
});

// 시트에서 가져온 미배정 회원 (트레이너 배정 대기)
export const sheetPendingMembers = sqliteTable("sheet_pending_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  birthDate: text("birthDate"),
  gender: text("gender"),
  grade: text("grade"),
  membershipStart: text("membershipStart"),
  membershipEnd: text("membershipEnd"),
  profileNote: text("profileNote"),
  ptProgram: text("ptProgram"),
  ptSessions: integer("ptSessions"),
  paymentAmount: integer("paymentAmount"),
  unpaidAmount: integer("unpaidAmount"),
  paymentMethod: text("paymentMethod"),
  sheetRowIndex: integer("sheetRowIndex"),
  importedAt: text("importedAt").default(now).notNull(),
});
