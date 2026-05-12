import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const now = sql`now()::text`;

// 지점
export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("createdAt").default(now).notNull(),
});

// 사용자 (관리자 / 트레이너)
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
  branchId: integer("branchId"),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

// 트레이너-지점 다대다
export const trainerBranches = pgTable("trainer_branches", {
  id: serial("id").primaryKey(),
  trainerId: integer("trainerId").notNull(),
  branchId: integer("branchId").notNull(),
});

// 트레이너 설정
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
  branchId: integer("branchId"),
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

// PT 패키지
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

// PT 세션 로그
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

// ─── 통합 운영 시스템 ─────────────────────────────────────────────────────────

// 유입 채널 (마케팅 채널)
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").default("online").notNull(),
  description: text("description"),
  isActive: integer("isActive").default(1).notNull(),
  createdAt: text("createdAt").default(now).notNull(),
});

// 리드 (상담 문의)
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  gender: text("gender"),
  ageGroup: text("ageGroup"),
  channelId: integer("channelId"),
  branchId: integer("branchId"),
  status: text("status").default("pending").notNull(),
  assignedTrainerId: integer("assignedTrainerId"),
  assignedConsultantId: integer("assignedConsultantId"),
  consultationDate: text("consultationDate"),
  consultationType: text("consultationType"),
  consultationSubTypes: text("consultationSubTypes"),
  consultationNote: text("consultationNote"),
  registeredMemberId: integer("registeredMemberId"),
  interestType: text("interestType"),
  exercisePurpose: text("exercisePurpose"),
  memo: text("memo"),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

// 매출 장부
export const revenueEntries = pgTable("revenue_entries", {
  id: serial("id").primaryKey(),
  memberId: integer("memberId"),
  leadId: integer("leadId"),
  trainerId: integer("trainerId"),
  consultantId: integer("consultantId"),
  branchId: integer("branchId"),
  channelId: integer("channelId"),
  createdBy: integer("createdBy"),
  customerName: text("customerName"),
  phone: text("phone"),
  programDetail: text("programDetail"),
  sessions: integer("sessions"),
  duration: integer("duration"),
  type: text("type").notNull(),
  subType: text("subType").notNull(),
  amount: integer("amount").notNull(),
  discountAmount: integer("discountAmount").default(0).notNull(),
  paidAmount: integer("paidAmount").notNull(),
  unpaidAmount: integer("unpaidAmount").default(0).notNull(),
  refundAmount: integer("refundAmount").default(0).notNull(),
  paymentMethod: text("paymentMethod"),
  paymentDate: text("paymentDate").notNull(),
  startDate: text("startDate"),
  installments: integer("installments").default(1).notNull(),
  memo: text("memo"),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

// 지출 장부
export const expenseEntries = pgTable("expense_entries", {
  id: serial("id").primaryKey(),
  branchId: integer("branchId"),
  category: text("category").notNull(),
  subCategory: text("subCategory"),
  amount: integer("amount").notNull(),
  paymentMethod: text("paymentMethod"),
  vendor: text("vendor"),
  expenseDate: text("expenseDate").notNull(),
  memo: text("memo"),
  createdAt: text("createdAt").default(now).notNull(),
});

// 매출 목표
export const revenueTargets = pgTable("revenue_targets", {
  id: serial("id").primaryKey(),
  branchId: integer("branchId"),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  targetAmount: integer("targetAmount").notNull(),
  createdAt: text("createdAt").default(now).notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────

// 구글시트 자동 동기화 설정
export const sheetSyncConfig = pgTable("sheet_sync_config", {
  id: serial("id").primaryKey(),
  sheetUrl: text("sheetUrl").notNull(),
  columnOffset: integer("columnOffset").default(1).notNull(),
  lastSyncedCount: integer("lastSyncedCount").default(0).notNull(),
  mappingJson: text("mappingJson").notNull().default("{}"),
  enabled: integer("enabled").default(1).notNull(),
  syncedAt: text("syncedAt"),
  createdAt: text("createdAt").default(now).notNull(),
});

// 시트에서 가져온 미배정 회원
export const sheetPendingMembers = pgTable("sheet_pending_members", {
  id: serial("id").primaryKey(),
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

// ─── 나의 업무 ────────────────────────────────────────────────────────────────

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").default("기타").notNull(),
  priority: text("priority").default("normal").notNull(),
  status: text("status").default("pending").notNull(),
  assigneeId: integer("assigneeId").notNull(),
  assignedById: integer("assignedById"),
  taskType: text("taskType").default("daily").notNull(),
  taskDate: text("taskDate"),
  dayOfWeek: integer("dayOfWeek"),
  dayOfMonth: integer("dayOfMonth"),
  dueTime: text("dueTime"),
  isRecurring: integer("isRecurring").default(0).notNull(),
  completedAt: text("completedAt"),
  completedMemo: text("completedMemo"),
  createdAt: text("createdAt").default(now).notNull(),
  updatedAt: text("updatedAt").default(now).notNull(),
});

export const notices = pgTable("notices", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: integer("authorId").notNull(),
  targetRole: text("targetRole").default("all").notNull(),
  priority: text("priority").default("normal").notNull(),
  createdAt: text("createdAt").default(now).notNull(),
});

export const noticeReads = pgTable("notice_reads", {
  id: serial("id").primaryKey(),
  noticeId: integer("noticeId").notNull(),
  userId: integer("userId").notNull(),
  readAt: text("readAt").default(now).notNull(),
});

// ─── ZIANTGYM+ 회원앱 ─────────────────────────────────────────────────────────

export const gymPlusMembers = pgTable("gym_plus_members", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
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

export const gymPlusVideoCategories = pgTable("gym_plus_video_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: text("createdAt").default(now).notNull(),
});

export const gymPlusVideos = pgTable("gym_plus_videos", {
  id: serial("id").primaryKey(),
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

export const gymPlusEvents = pgTable("gym_plus_events", {
  id: serial("id").primaryKey(),
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

export const gymPlusWorkoutLogs = pgTable("gym_plus_workout_logs", {
  id: serial("id").primaryKey(),
  gymPlusMemberId: integer("gymPlusMemberId").notNull(),
  logDate: text("logDate").notNull(),
  title: text("title").notNull(),
  exercisesJson: text("exercisesJson"),   // [{name, sets:[{reps,weight}]}]
  bodyPartsJson: text("bodyPartsJson"),   // ["등","가슴",...]
  conditionScore: integer("conditionScore"), // 1~5
  sleepHours: text("sleepHours"),         // "4h↓","5h",...,"9h+"
  energyLevel: text("energyLevel"),       // "높음","보통","낮음"
  durationMinutes: integer("durationMinutes"),
  caloriesBurned: integer("caloriesBurned"),
  bodyWeight: text("bodyWeight"),
  notes: text("notes"),
  mood: text("mood"),                     // legacy
  createdAt: text("createdAt").default(now).notNull(),
});
