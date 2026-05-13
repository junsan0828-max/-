import { Router } from "express";
import { eq, and, or, like, desc } from "drizzle-orm";
import { db } from "./db";
import {
  members,
  ptPackages,
  attendances,
  kioskFaceData,
  kioskLockers,
  kioskMemberships,
  kioskMemberInfo,
} from "../drizzle/schema";

export const kioskRouter = Router();

// ─── helpers ─────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split("T")[0];
}

async function buildMemberPayload(memberId: number) {
  const [member] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
  if (!member) return null;

  const [kioskInfo] = await db
    .select()
    .from(kioskMemberInfo)
    .where(eq(kioskMemberInfo.memberId, memberId))
    .limit(1);

  const [faceData] = await db
    .select()
    .from(kioskFaceData)
    .where(eq(kioskFaceData.memberId, memberId))
    .limit(1);

  const lockers = await db
    .select()
    .from(kioskLockers)
    .where(eq(kioskLockers.memberId, memberId));

  const kioskMems = await db
    .select()
    .from(kioskMemberships)
    .where(eq(kioskMemberships.memberId, memberId));

  // Active PT packages for class info
  const ptPkgs = await db
    .select()
    .from(ptPackages)
    .where(and(eq(ptPackages.memberId, memberId), eq(ptPackages.status, "active")));

  // Determine main health membership
  const todayStr = today();
  const healthMem = kioskMems.find((m) => m.membershipType === "헬스") ?? null;
  const classMem = kioskMems.find((m) => m.membershipType === "수강") ?? null;

  // Fallback to members table if no kiosk membership
  const membershipEnd = healthMem?.endDate ?? member.membershipEnd ?? null;
  const membershipStart = healthMem?.startDate ?? member.membershipStart ?? null;
  const membershipExpired =
    membershipEnd ? membershipEnd < todayStr : member.status === "inactive";

  // Active PT package for class display
  const activePt = ptPkgs[0] ?? null;

  return {
    id: member.id,
    name: member.name,
    phone: member.phone,
    photoBase64: faceData?.photoBase64 ?? null,
    mileagePoints: kioskInfo?.mileagePoints ?? 0,
    attendanceNumber: kioskInfo?.attendanceNumber ?? null,
    membership: {
      productName: healthMem?.productName ?? "헬스",
      status: membershipExpired ? "expired" : "active",
      startDate: membershipStart,
      endDate: membershipEnd,
      unlimitedEntry: healthMem?.unlimitedEntry ?? 1,
      remainingSessions: healthMem?.remainingSessions ?? null,
    },
    classMembership: classMem
      ? {
          productName: classMem.productName,
          endDate: classMem.endDate,
          remainingSessions: classMem.remainingSessions,
        }
      : activePt
      ? {
          productName: activePt.packageName ?? "수강권",
          endDate: activePt.expiryDate,
          remainingSessions: (activePt.totalSessions ?? 0) - (activePt.usedSessions ?? 0),
        }
      : null,
    lockers: lockers.map((l) => ({
      lockerNumber: l.lockerNumber,
      lockerType: l.lockerType,
      status: l.status,
      expiryType: l.expiryType,
      expiryDate: l.expiryDate,
    })),
  };
}

// ─── Public endpoints (no auth required for kiosk) ───────────────────────────

/** GET /api/kiosk/faces — returns all face descriptors for client-side matching */
kioskRouter.get("/faces", async (_req, res) => {
  try {
    const rows = await db
      .select({
        memberId: kioskFaceData.memberId,
        faceDescriptor: kioskFaceData.faceDescriptor,
      })
      .from(kioskFaceData)
      .where(eq(kioskFaceData.faceDescriptor, kioskFaceData.faceDescriptor)); // filter non-null
    // Only return rows that actually have a descriptor
    const valid = rows.filter((r) => r.faceDescriptor);
    // Also grab names for FaceMatcher labels
    const memberIds = valid.map((r) => r.memberId);
    const nameMap: Record<number, string> = {};
    if (memberIds.length > 0) {
      const names = await db
        .select({ id: members.id, name: members.name })
        .from(members)
        .where(
          memberIds.length === 1
            ? eq(members.id, memberIds[0])
            : or(...memberIds.map((id) => eq(members.id, id)))!
        );
      names.forEach((n) => { nameMap[n.id] = n.name; });
    }
    res.json(
      valid.map((r) => ({
        memberId: r.memberId,
        name: nameMap[r.memberId] ?? "Unknown",
        faceDescriptor: JSON.parse(r.faceDescriptor!),
      }))
    );
  } catch (err) {
    console.error("[kiosk/faces]", err);
    res.status(500).json({ error: "서버 오류" });
  }
});

/** POST /api/kiosk/lookup/phone — find member by phone number */
kioskRouter.post("/lookup/phone", async (req, res) => {
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone) return res.status(400).json({ error: "번호를 입력하세요" });
    const cleaned = phone.replace(/\D/g, "");
    // Match full number OR last 4 digits
    const [found] = await db
      .select()
      .from(members)
      .where(
        or(
          like(members.phone, `%${cleaned}`),
          eq(members.phone, cleaned)
        )!
      )
      .limit(1);
    if (!found) return res.status(404).json({ error: "회원을 찾을 수 없습니다" });
    const payload = await buildMemberPayload(found.id);
    res.json(payload);
  } catch (err) {
    console.error("[kiosk/lookup/phone]", err);
    res.status(500).json({ error: "서버 오류" });
  }
});

/** POST /api/kiosk/lookup/number — find member by attendance number */
kioskRouter.post("/lookup/number", async (req, res) => {
  try {
    const { number } = req.body as { number?: string };
    if (!number) return res.status(400).json({ error: "번호를 입력하세요" });
    const [kioskInfo] = await db
      .select()
      .from(kioskMemberInfo)
      .where(eq(kioskMemberInfo.attendanceNumber, number))
      .limit(1);
    if (!kioskInfo) return res.status(404).json({ error: "회원을 찾을 수 없습니다" });
    const payload = await buildMemberPayload(kioskInfo.memberId);
    res.json(payload);
  } catch (err) {
    console.error("[kiosk/lookup/number]", err);
    res.status(500).json({ error: "서버 오류" });
  }
});

/** POST /api/kiosk/lookup/face — lookup by memberId after client-side face match */
kioskRouter.post("/lookup/face", async (req, res) => {
  try {
    const { memberId } = req.body as { memberId?: number };
    if (!memberId) return res.status(400).json({ error: "memberId 필요" });
    const payload = await buildMemberPayload(memberId);
    if (!payload) return res.status(404).json({ error: "회원을 찾을 수 없습니다" });
    res.json(payload);
  } catch (err) {
    console.error("[kiosk/lookup/face]", err);
    res.status(500).json({ error: "서버 오류" });
  }
});

/** POST /api/kiosk/checkin — record attendance */
kioskRouter.post("/checkin", async (req, res) => {
  try {
    const { memberId } = req.body as { memberId?: number };
    if (!memberId) return res.status(400).json({ error: "memberId 필요" });
    const [member] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
    if (!member) return res.status(404).json({ error: "회원 없음" });

    // Prevent duplicate check-in within same day
    const todayStr = today();
    const existing = await db
      .select()
      .from(attendances)
      .where(
        and(
          eq(attendances.memberId, memberId),
          eq(attendances.attendDate, todayStr)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(attendances).values({
        memberId,
        trainerId: member.trainerId,
        attendDate: todayStr,
        status: "attended",
      });
    }

    res.json({ success: true, alreadyCheckedIn: existing.length > 0 });
  } catch (err) {
    console.error("[kiosk/checkin]", err);
    res.status(500).json({ error: "서버 오류" });
  }
});

// ─── Admin endpoints (require auth) ──────────────────────────────────────────

/** POST /api/kiosk/admin/enroll-face — save face descriptor for a member */
kioskRouter.post("/admin/enroll-face", async (req, res) => {
  try {
    const { memberId, faceDescriptor, photoBase64 } = req.body as {
      memberId?: number;
      faceDescriptor?: number[];
      photoBase64?: string;
    };
    if (!memberId || !faceDescriptor) return res.status(400).json({ error: "필드 누락" });

    const existing = await db
      .select()
      .from(kioskFaceData)
      .where(eq(kioskFaceData.memberId, memberId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(kioskFaceData)
        .set({ faceDescriptor: JSON.stringify(faceDescriptor), photoBase64: photoBase64 ?? null })
        .where(eq(kioskFaceData.memberId, memberId));
    } else {
      await db.insert(kioskFaceData).values({
        memberId,
        faceDescriptor: JSON.stringify(faceDescriptor),
        photoBase64: photoBase64 ?? null,
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[kiosk/admin/enroll-face]", err);
    res.status(500).json({ error: "서버 오류" });
  }
});

/** POST /api/kiosk/admin/locker — assign or update locker */
kioskRouter.post("/admin/locker", async (req, res) => {
  try {
    const { memberId, lockerNumber, lockerType, status, expiryType, expiryDate } = req.body;
    if (!memberId) return res.status(400).json({ error: "memberId 필요" });

    const existing = await db
      .select()
      .from(kioskLockers)
      .where(and(eq(kioskLockers.memberId, memberId), eq(kioskLockers.lockerType, lockerType ?? "개인락커")))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(kioskLockers)
        .set({ lockerNumber, status, expiryType, expiryDate })
        .where(eq(kioskLockers.id, existing[0].id));
    } else {
      await db.insert(kioskLockers).values({
        memberId,
        lockerNumber,
        lockerType: lockerType ?? "개인락커",
        status: status ?? "사용중",
        expiryType: expiryType ?? "무제한",
        expiryDate,
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[kiosk/admin/locker]", err);
    res.status(500).json({ error: "서버 오류" });
  }
});

/** POST /api/kiosk/admin/membership — add/update kiosk membership */
kioskRouter.post("/admin/membership", async (req, res) => {
  try {
    const { memberId, productName, membershipType, startDate, endDate, totalSessions, remainingSessions, unlimitedEntry } = req.body;
    if (!memberId || !productName) return res.status(400).json({ error: "필드 누락" });

    const existing = await db
      .select()
      .from(kioskMemberships)
      .where(and(eq(kioskMemberships.memberId, memberId), eq(kioskMemberships.membershipType, membershipType ?? "헬스")))
      .limit(1);

    const data = {
      memberId,
      productName,
      membershipType: membershipType ?? "헬스",
      startDate,
      endDate,
      totalSessions,
      remainingSessions,
      unlimitedEntry: unlimitedEntry ?? 1,
      status: "active",
    };

    if (existing.length > 0) {
      await db.update(kioskMemberships).set(data).where(eq(kioskMemberships.id, existing[0].id));
    } else {
      await db.insert(kioskMemberships).values(data);
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[kiosk/admin/membership]", err);
    res.status(500).json({ error: "서버 오류" });
  }
});

/** POST /api/kiosk/admin/member-info — set attendance number and mileage */
kioskRouter.post("/admin/member-info", async (req, res) => {
  try {
    const { memberId, attendanceNumber, mileagePoints } = req.body;
    if (!memberId) return res.status(400).json({ error: "memberId 필요" });

    const existing = await db
      .select()
      .from(kioskMemberInfo)
      .where(eq(kioskMemberInfo.memberId, memberId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(kioskMemberInfo)
        .set({ attendanceNumber, mileagePoints })
        .where(eq(kioskMemberInfo.memberId, memberId));
    } else {
      await db.insert(kioskMemberInfo).values({ memberId, attendanceNumber, mileagePoints: mileagePoints ?? 0 });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[kiosk/admin/member-info]", err);
    res.status(500).json({ error: "서버 오류" });
  }
});

/** GET /api/kiosk/admin/members — list all members for admin enrollment UI */
kioskRouter.get("/admin/members", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: members.id,
        name: members.name,
        phone: members.phone,
        status: members.status,
      })
      .from(members)
      .orderBy(members.name);
    res.json(rows);
  } catch (err) {
    console.error("[kiosk/admin/members]", err);
    res.status(500).json({ error: "서버 오류" });
  }
});
