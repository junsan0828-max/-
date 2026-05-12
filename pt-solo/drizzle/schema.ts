import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const now = sql`now()::text`;

// 사용자 (트레이너 본인)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("trainer").notNull(),
  position: text("position"),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
  lastLoginAt: text("lastLoginAt"),
});

// 트레이너 프로필
export const trainers = pgTable("trainers", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  trainerName: text("trainerName").notNull(),
  phone: text("phone"),
  email: text("email"),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

// 트레이너 설정 (정산율 등)
export const trainerSettings = pgTable("trainer_settings", {
  id: serial("id").primaryKey(),
  trainerId: integer("trainerId").notNull().unique(),
  settlementRate: integer("settlementRate").default(50).notNull(),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

// 회원
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  trainerId: integer("trainerId").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  birthDate: text("birthDate"),
  gender: text("gender"),
  grade: text("grade").default("basic").notNull(),
  status: text("status").default("active").notNull(),
  membershipStart: text("membershipStart"),
  membershipEnd: text("membershipEnd"),
  profileNote: text("profileNote"),
  visitRoute: text("visitRoute"),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

// PT 패키지 (계약)
export const ptPackages = pgTable("pt_packages", {
  id: serial("id").primaryKey(),
  memberId: integer("memberId").notNull(),
  trainerId: integer("trainerId"),
  totalSessions: integer("totalSessions").notNull(),
  usedSessions: integer("usedSessions").default(0).notNull(),
  packageName: text("packageName"),
  startDate: text("startDate"),
  expiryDate: text("expiryDate"),
  status: text("status").default("active").notNull(),
  price: integer("price"),
  pricePerSession: integer("pricePerSession"),
  paymentAmount: integer("paymentAmount"),
  unpaidAmount: integer("unpaidAmount"),
  paymentMethod: text("paymentMethod"),
  paymentDate: text("paymentDate"),
  paymentMemo: text("paymentMemo"),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

// PT 정지 내역
export const ptPauses = pgTable("pt_pauses", {
  id: serial("id").primaryKey(),
  packageId: integer("packageId").notNull(),
  memberId: integer("memberId").notNull(),
  pauseStart: text("pauseStart").notNull(),
  pauseEnd: text("pauseEnd"),
  reason: text("reason"),
  createdAt: text("createdAt").default(now).notNull(),
});

// 예약/일정
export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  memberId: integer("memberId").notNull(),
  trainerId: integer("trainerId").notNull(),
  scheduledDate: text("scheduledDate").notNull(),
  scheduledTime: text("scheduledTime"),
  notes: text("notes"),
  status: text("status").default("pending").notNull(),
  createdAt: text("createdAt").default(now).notNull(),
});

// 출석
export const attendances = pgTable("attendances", {
  id: serial("id").primaryKey(),
  memberId: integer("memberId").notNull(),
  trainerId: integer("trainerId").notNull(),
  attendDate: text("attendDate").notNull(),
  status: text("status").default("attended").notNull(),
  createdAt: text("createdAt").default(now).notNull(),
});

// PT 세션 로그 (운동기록)
export const ptSessionLogs = pgTable("pt_session_logs", {
  id: serial("id").primaryKey(),
  memberId: integer("memberId").notNull(),
  trainerId: integer("trainerId").notNull(),
  packageId: integer("packageId"),
  sessionDate: text("sessionDate").notNull(),
  notes: text("notes"),
  bodyPart: text("bodyPart"),
  exercisesJson: text("exercisesJson"),
  goal: text("goal"),
  feedback: text("feedback"),
  createdAt: text("createdAt").default(now).notNull(),
});

// 운동 메모
export const workoutMemos = pgTable("workout_memos", {
  id: serial("id").primaryKey(),
  memberId: integer("memberId").notNull(),
  trainerId: integer("trainerId").notNull(),
  memoDate: text("memoDate").notNull(),
  content: text("content").notNull(),
  createdAt: text("createdAt").default(now).notNull(),
});

// PAR-Q 사전건강검사
export const parQ = pgTable("par_q", {
  id: serial("id").primaryKey(),
  memberId: integer("memberId").notNull().unique(),
  height: text("height"), weight: text("weight"), muscleMass: text("muscleMass"),
  bodyFatPercent: text("bodyFatPercent"), bodyFatKg: text("bodyFatKg"),
  waistCircumference: text("waistCircumference"),
  systolicBp: text("systolicBp"), diastolicBp: text("diastolicBp"),
  totalCholesterol: text("totalCholesterol"), hdlCholesterol: text("hdlCholesterol"),
  ldlCholesterol: text("ldlCholesterol"), triglycerides: text("triglycerides"),
  fastingBloodSugar: text("fastingBloodSugar"), postMealBloodSugar: text("postMealBloodSugar"),
  hba1c: text("hba1c"), boneDensity: text("boneDensity"),
  occupation: text("occupation"), workEnvironment: text("workEnvironment"),
  exerciseExperience: text("exerciseExperience"), visitRoute: text("visitRoute"),
  goal1: text("goal1"), goal2: text("goal2"), goal3: text("goal3"),
  dietIssues: text("dietIssues"), alcoholIssues: text("alcoholIssues"),
  sleepIssues: text("sleepIssues"), activityIssues: text("activityIssues"),
  chronicDiseases: text("chronicDiseases"), musculoskeletalIssues: text("musculoskeletalIssues"),
  posturalIssues: text("posturalIssues"),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

// 수업 전 컨디션 체크
export const attendanceChecks = pgTable("attendance_checks", {
  id: serial("id").primaryKey(),
  memberId: integer("memberId").notNull(),
  trainerId: integer("trainerId").notNull(),
  checkDate: text("checkDate").notNull(),
  checkTime: text("checkTime"),
  status: text("status").default("attended").notNull(),
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
export const reportTokens = pgTable("report_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  memberId: integer("memberId").notNull(),
  trainerId: integer("trainerId").notNull(),
  createdAt: text("createdAt").default(now).notNull(),
});

// 결제 내역
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  memberId: integer("memberId").notNull(),
  trainerId: integer("trainerId"),
  amount: integer("amount").notNull(),
  paymentDate: text("paymentDate"),
  paymentMethod: text("paymentMethod"),
  memo: text("memo"),
  createdAt: text("createdAt").default(now).notNull(),
});

// 유입 채널
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").default("online").notNull(),
  description: text("description"),
  isActive: integer("isActive").default(1).notNull(),
  createdAt: text("createdAt").default(now).notNull(),
});

// 상담 리드 (CRM)
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  trainerId: integer("trainerId").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  gender: text("gender"),
  ageGroup: text("ageGroup"),
  channelId: integer("channelId"),
  status: text("status").default("pending").notNull(),
  consultationDate: text("consultationDate"),
  consultationType: text("consultationType"),
  consultationSubTypes: text("consultationSubTypes"),
  consultationNote: text("consultationNote"),
  interestType: text("interestType"),
  exercisePurpose: text("exercisePurpose"),
  memo: text("memo"),
  registeredMemberId: integer("registeredMemberId"),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

// FIT STEP+ 회원앱 (트레이너별 격리)
export const fitStepPlusMembers = pgTable("fit_step_plus_members", {
  id: serial("id").primaryKey(),
  trainerId: integer("trainerId").notNull(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  memberId: integer("memberId"),
  membershipType: text("membershipType").default("general").notNull(),
  membershipStart: text("membershipStart"),
  membershipEnd: text("membershipEnd"),
  isActive: integer("isActive").default(1).notNull(),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

export const fitStepPlusVideoCategories = pgTable("fit_step_plus_video_categories", {
  id: serial("id").primaryKey(),
  trainerId: integer("trainerId").notNull(),
  name: text("name").notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: text("createdAt").default(now).notNull(),
});

export const fitStepPlusVideos = pgTable("fit_step_plus_videos", {
  id: serial("id").primaryKey(),
  trainerId: integer("trainerId").notNull(),
  categoryId: integer("categoryId"),
  title: text("title").notNull(),
  description: text("description"),
  videoUrl: text("videoUrl").notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  duration: integer("duration"),
  level: text("level").default("beginner"),
  bodyPart: text("bodyPart"),
  isPublished: integer("isPublished").default(1).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: text("createdAt").default(now).notNull(),
});

export const fitStepPlusEvents = pgTable("fit_step_plus_events", {
  id: serial("id").primaryKey(),
  trainerId: integer("trainerId").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  imageUrl: text("imageUrl"),
  eventType: text("eventType").default("notice"),
  startDate: text("startDate"),
  endDate: text("endDate"),
  isPublished: integer("isPublished").default(1).notNull(),
  isPinned: integer("isPinned").default(0).notNull(),
  createdAt: text("createdAt").default(now).notNull(),
});

export const fitStepPlusWorkoutLogs = pgTable("fit_step_plus_workout_logs", {
  id: serial("id").primaryKey(),
  fitStepPlusMemberId: integer("fitStepPlusMemberId").notNull(),
  logDate: text("logDate").notNull(),
  title: text("title").notNull(),
  exercisesJson: text("exercisesJson"),
  durationMinutes: integer("durationMinutes"),
  caloriesBurned: integer("caloriesBurned"),
  bodyWeight: text("bodyWeight"),
  notes: text("notes"),
  mood: text("mood"),
  createdAt: text("createdAt").default(now).notNull(),
});
