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
  status: text("status", { enum: ["active", "completed", "expired"] }).default("active").notNull(),
  price: integer("price"),
  pricePerSession: integer("pricePerSession"),
  paymentAmount: integer("paymentAmount"),
  unpaidAmount: integer("unpaidAmount"),
  paymentMethod: text("paymentMethod", { enum: ["현금영수증", "이체", "지역화폐", "카드"] }),
  paymentMemo: text("paymentMemo"),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
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
