import bcrypt from "bcryptjs";
import { getDb } from "./db";
import { users, trainers, trainerSettings, members, ptPackages } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function seed() {
  const db = getDb();
  if (!db) {
    console.error("DB 연결 실패.");
    process.exit(1);
  }

  console.log("🌱 시드 데이터 생성 시작...");

  // ─── 관리자 계정 ──────────────────────────────────────────────────────────
  const existing = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, "admin"))
    .all();

  if (!existing[0]) {
    const adminPw = await bcrypt.hash("admin123", 10);
    db.insert(users).values({
      username: "admin",
      password: adminPw,
      role: "admin",
    }).run();
    console.log("✅ 관리자 계정 생성: admin / admin123");
  } else {
    console.log("ℹ️  관리자 계정이 이미 존재합니다.");
  }

  // ─── 트레이너 계정 1 ──────────────────────────────────────────────────────
  const existingTrainer1 = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, "trainer1"))
    .all();

  let trainer1Id: number | undefined;

  if (!existingTrainer1[0]) {
    const trainerPw = await bcrypt.hash("trainer123", 10);

    const [userRow] = db.insert(users).values({
      username: "trainer1",
      password: trainerPw,
      role: "trainer",
    }).returning({ id: users.id }).all();
    const userId = userRow.id;

    const [trainerRow] = db.insert(trainers).values({
      userId,
      trainerName: "김트레이너",
      phone: "010-1234-5678",
      email: "trainer1@example.com",
    }).returning({ id: trainers.id }).all();
    trainer1Id = trainerRow.id;

    db.insert(trainerSettings).values({
      trainerId: trainer1Id,
      settlementRate: 60,
    }).run();

    console.log("✅ 트레이너 계정 생성: trainer1 / trainer123 (정산 60%)");
  } else {
    const trainerResult = db
      .select({ id: trainers.id })
      .from(trainers)
      .where(eq(trainers.userId, existingTrainer1[0].id))
      .all();
    trainer1Id = trainerResult[0]?.id;
    console.log("ℹ️  트레이너1 계정이 이미 존재합니다.");
  }

  // ─── 샘플 회원 데이터 ─────────────────────────────────────────────────────
  if (trainer1Id) {
    const existingMembers = db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.trainerId, trainer1Id))
      .all();

    if (existingMembers.length === 0) {
      const today = new Date();
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

      // 회원 1: 활성, 만료 임박
      const [m1] = db.insert(members).values({
        trainerId: trainer1Id,
        name: "홍길동",
        phone: "010-1111-2222",
        gender: "male",
        grade: "premium",
        status: "active",
        membershipStart: fmt(today),
        membershipEnd: fmt(addDays(today, 5)),
        profileNote: "무릎 부상 주의",
      }).returning({ id: members.id }).all();

      db.insert(ptPackages).values({
        memberId: m1.id,
        trainerId: trainer1Id,
        totalSessions: 20,
        usedSessions: 15,
        packageName: "웨이트피티",
        startDate: fmt(today),
        expiryDate: fmt(addDays(today, 5)),
        pricePerSession: 50000,
        paymentAmount: 1000000,
        paymentMethod: "카드",
      }).run();

      // 회원 2: 활성, 미수금 있음
      const [m2] = db.insert(members).values({
        trainerId: trainer1Id,
        name: "이영희",
        phone: "010-3333-4444",
        gender: "female",
        grade: "basic",
        status: "active",
        membershipStart: fmt(addDays(today, -30)),
        membershipEnd: fmt(addDays(today, 60)),
      }).returning({ id: members.id }).all();

      db.insert(ptPackages).values({
        memberId: m2.id,
        trainerId: trainer1Id,
        totalSessions: 10,
        usedSessions: 3,
        packageName: "케어피티",
        startDate: fmt(addDays(today, -30)),
        expiryDate: fmt(addDays(today, 60)),
        pricePerSession: 60000,
        paymentAmount: 400000,
        unpaidAmount: 200000,
        paymentMethod: "이체",
        paymentMemo: "분납 중 (2회 남음)",
      }).run();

      // 회원 3: 활성, 정상
      const [m3] = db.insert(members).values({
        trainerId: trainer1Id,
        name: "박민준",
        phone: "010-5555-6666",
        gender: "male",
        grade: "vip",
        status: "active",
        membershipStart: fmt(addDays(today, -60)),
        membershipEnd: fmt(addDays(today, 90)),
      }).returning({ id: members.id }).all();

      db.insert(ptPackages).values({
        memberId: m3.id,
        trainerId: trainer1Id,
        totalSessions: 30,
        usedSessions: 10,
        packageName: "필라테스",
        startDate: fmt(addDays(today, -60)),
        expiryDate: fmt(addDays(today, 90)),
        pricePerSession: 70000,
        paymentAmount: 2100000,
        paymentMethod: "현금영수증",
      }).run();

      console.log("✅ 샘플 회원 3명 생성 완료 (홍길동, 이영희, 박민준)");
    } else {
      console.log("ℹ️  샘플 회원이 이미 존재합니다.");
    }
  }

  console.log("\n✨ 시드 완료!");
  console.log("─────────────────────────────");
  console.log("관리자  : admin / admin123");
  console.log("트레이너: trainer1 / trainer123");
  console.log("─────────────────────────────\n");
  process.exit(0);
}

seed().catch((err) => {
  console.error("시드 실패:", err);
  process.exit(1);
});
