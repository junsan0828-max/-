import {
  mysqlTable,
  int,
  varchar,
  text,
  date,
  timestamp,
  mysqlEnum,
} from "drizzle-orm/mysql-core";

// 사용자 (관리자 / 트레이너)
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "trainer"]).default("trainer").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 트레이너 프로필
export const trainers = mysqlTable("trainers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  trainerName: varchar("trainerName", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 트레이너 설정
export const trainerSettings = mysqlTable("trainer_settings", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull().unique(),
  settlementRate: int("settlementRate").default(50).notNull(), // 정산 비율 (기본값: 50%)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 회원
export const members = mysqlTable("members", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 100 }),
  birthDate: date("birthDate"),
  gender: mysqlEnum("gender", ["male", "female", "other"]),
  grade: mysqlEnum("grade", ["basic", "premium", "vip"]).default("basic").notNull(),
  status: mysqlEnum("status", ["active", "paused"]).default("active").notNull(),
  membershipStart: date("membershipStart"),
  membershipEnd: date("membershipEnd"),
  profileNote: text("profileNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// PT 패키지
export const ptPackages = mysqlTable("pt_packages", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull(),
  trainerId: int("trainerId"),
  totalSessions: int("totalSessions").notNull(),
  usedSessions: int("usedSessions").default(0).notNull(),
  packageName: varchar("packageName", { length: 100 }),
  startDate: date("startDate"),
  expiryDate: date("expiryDate"),
  status: mysqlEnum("status", ["active", "completed", "expired"]).default("active").notNull(),
  price: int("price"),
  pricePerSession: int("pricePerSession"),

  // 결제 정보 필드
  paymentAmount: int("paymentAmount"),
  unpaidAmount: int("unpaidAmount"),
  paymentMethod: mysqlEnum("paymentMethod", ["현금영수증", "이체", "지역화폐", "카드"]),
  paymentMemo: text("paymentMemo"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 출석
export const attendances = mysqlTable("attendances", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull(),
  trainerId: int("trainerId").notNull(),
  attendDate: date("attendDate").notNull(),
  status: mysqlEnum("status", ["attended", "absent", "noshow"]).default("attended").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// PT 세션 로그
export const ptSessionLogs = mysqlTable("pt_session_logs", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull(),
  trainerId: int("trainerId").notNull(),
  packageId: int("packageId"),
  sessionDate: date("sessionDate").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// 결제 내역
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull(),
  trainerId: int("trainerId"),
  amount: int("amount").notNull(),
  paymentDate: date("paymentDate"),
  paymentMethod: mysqlEnum("paymentMethod", ["현금영수증", "이체", "지역화폐", "카드"]),
  memo: text("memo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
