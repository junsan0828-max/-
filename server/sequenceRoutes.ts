import { Router } from "express";
import { getDb } from "./db";
import { sequenceAuthors, sequences, sequenceLikes } from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

async function upsertAuthorFromKakao(accessToken: string) {
  const res = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("카카오 토큰 검증 실패");
  const data = await res.json() as any;
  const kakaoId = String(data.id);
  const name = data.kakao_account?.profile?.nickname || data.properties?.nickname || "익명";
  const thumbnail = data.kakao_account?.profile?.thumbnail_image_url || data.properties?.thumbnail_image || null;

  const db = await getDb();
  if (!db) throw new Error("DB 연결 실패");

  const existing = await db.select().from(sequenceAuthors).where(eq(sequenceAuthors.kakaoId, kakaoId)).limit(1);
  if (existing.length > 0) {
    await db.update(sequenceAuthors).set({ name, thumbnail }).where(eq(sequenceAuthors.kakaoId, kakaoId));
    return existing[0];
  }
  const [author] = await db.insert(sequenceAuthors).values({ kakaoId, name, thumbnail }).returning();
  return author;
}

// 카카오 로그인 → author 반환
router.post("/auth/kakao", async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: "accessToken 필요" });
    const author = await upsertAuthorFromKakao(accessToken);
    res.json(author);
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
});

// 공개 시퀀스 목록
router.get("/", async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB 연결 실패" });
    const rows = await db
      .select({
        id: sequences.id,
        title: sequences.title,
        description: sequences.description,
        category: sequences.category,
        difficulty: sequences.difficulty,
        targetAudience: sequences.targetAudience,
        estimatedMinutes: sequences.estimatedMinutes,
        price: sequences.price,
        viewCount: sequences.viewCount,
        likeCount: sequences.likeCount,
        authorId: sequences.authorId,
        authorName: sequenceAuthors.name,
        authorThumbnail: sequenceAuthors.thumbnail,
        createdAt: sequences.createdAt,
      })
      .from(sequences)
      .innerJoin(sequenceAuthors, eq(sequences.authorId, sequenceAuthors.id))
      .where(eq(sequences.isPublic, true))
      .orderBy(desc(sequences.createdAt))
      .limit(50);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 내 시퀀스 목록
router.get("/mine", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "인증 필요" });
    const author = await upsertAuthorFromKakao(token);
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB 연결 실패" });
    const rows = await db.select().from(sequences).where(eq(sequences.authorId, author.id)).orderBy(desc(sequences.createdAt));
    res.json(rows);
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
});

// 시퀀스 단건 조회 + 조회수 증가
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB 연결 실패" });
    const rows = await db
      .select({
        id: sequences.id,
        title: sequences.title,
        description: sequences.description,
        category: sequences.category,
        bodyParts: sequences.bodyParts,
        targetAudience: sequences.targetAudience,
        difficulty: sequences.difficulty,
        estimatedMinutes: sequences.estimatedMinutes,
        equipment: sequences.equipment,
        classGoal: sequences.classGoal,
        coachingNotes: sequences.coachingNotes,
        exercisesJson: sequences.exercisesJson,
        isPublic: sequences.isPublic,
        price: sequences.price,
        viewCount: sequences.viewCount,
        likeCount: sequences.likeCount,
        authorId: sequences.authorId,
        authorName: sequenceAuthors.name,
        authorThumbnail: sequenceAuthors.thumbnail,
        createdAt: sequences.createdAt,
        updatedAt: sequences.updatedAt,
      })
      .from(sequences)
      .innerJoin(sequenceAuthors, eq(sequences.authorId, sequenceAuthors.id))
      .where(eq(sequences.id, id))
      .limit(1);
    if (!rows.length) return res.status(404).json({ error: "없음" });
    await db.update(sequences).set({ viewCount: sql`${sequences.viewCount} + 1` }).where(eq(sequences.id, id));
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 시퀀스 생성
router.post("/", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "인증 필요" });
    const author = await upsertAuthorFromKakao(token);
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB 연결 실패" });
    const { title, description, category, bodyParts, targetAudience, difficulty, estimatedMinutes, equipment, classGoal, coachingNotes, exercises, isPublic, price } = req.body;
    const [row] = await db.insert(sequences).values({
      authorId: author.id,
      title: title || "제목 없음",
      description, category, bodyParts, targetAudience,
      difficulty, estimatedMinutes, equipment, classGoal, coachingNotes,
      exercisesJson: JSON.stringify(exercises || []),
      isPublic: !!isPublic, price: price || 0,
    }).returning();
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 시퀀스 수정
router.put("/:id", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "인증 필요" });
    const author = await upsertAuthorFromKakao(token);
    const id = parseInt(req.params.id);
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB 연결 실패" });
    const own = await db.select().from(sequences).where(and(eq(sequences.id, id), eq(sequences.authorId, author.id))).limit(1);
    if (!own.length) return res.status(403).json({ error: "권한 없음" });
    const { title, description, category, bodyParts, targetAudience, difficulty, estimatedMinutes, equipment, classGoal, coachingNotes, exercises, isPublic, price } = req.body;
    const [row] = await db.update(sequences).set({
      title, description, category, bodyParts, targetAudience,
      difficulty, estimatedMinutes, equipment, classGoal, coachingNotes,
      exercisesJson: JSON.stringify(exercises || []),
      isPublic: !!isPublic, price: price || 0,
      updatedAt: sql`now()::text`,
    }).where(eq(sequences.id, id)).returning();
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 시퀀스 삭제
router.delete("/:id", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "인증 필요" });
    const author = await upsertAuthorFromKakao(token);
    const id = parseInt(req.params.id);
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB 연결 실패" });
    const own = await db.select().from(sequences).where(and(eq(sequences.id, id), eq(sequences.authorId, author.id))).limit(1);
    if (!own.length) return res.status(403).json({ error: "권한 없음" });
    await db.delete(sequenceLikes).where(eq(sequenceLikes.sequenceId, id));
    await db.delete(sequences).where(eq(sequences.id, id));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 좋아요 토글
router.post("/:id/like", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "인증 필요" });
    const author = await upsertAuthorFromKakao(token);
    const seqId = parseInt(req.params.id);
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB 연결 실패" });
    const existing = await db.select().from(sequenceLikes)
      .where(and(eq(sequenceLikes.sequenceId, seqId), eq(sequenceLikes.authorId, author.id))).limit(1);
    if (existing.length) {
      await db.delete(sequenceLikes).where(eq(sequenceLikes.id, existing[0].id));
      await db.update(sequences).set({ likeCount: sql`GREATEST(0, ${sequences.likeCount} - 1)` }).where(eq(sequences.id, seqId));
      res.json({ liked: false });
    } else {
      await db.insert(sequenceLikes).values({ sequenceId: seqId, authorId: author.id });
      await db.update(sequences).set({ likeCount: sql`${sequences.likeCount} + 1` }).where(eq(sequences.id, seqId));
      res.json({ liked: true });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
