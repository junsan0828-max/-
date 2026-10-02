import { Router } from "express";
import { pool } from "./db";

const router = Router();

async function initTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS community_sequence_authors (
    id SERIAL PRIMARY KEY,
    kakao_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    thumbnail TEXT,
    created_at TEXT NOT NULL DEFAULT now()::text
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS community_sequences (
    id SERIAL PRIMARY KEY,
    author_id INTEGER NOT NULL REFERENCES community_sequence_authors(id),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    body_parts TEXT,
    target_audience TEXT,
    difficulty TEXT,
    estimated_minutes TEXT,
    equipment TEXT,
    class_goal TEXT,
    coaching_notes TEXT,
    exercises_json TEXT NOT NULL DEFAULT '[]',
    is_public BOOLEAN NOT NULL DEFAULT false,
    price INTEGER NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0,
    like_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT now()::text,
    updated_at TEXT NOT NULL DEFAULT now()::text
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS community_sequence_likes (
    id SERIAL PRIMARY KEY,
    sequence_id INTEGER NOT NULL REFERENCES community_sequences(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES community_sequence_authors(id),
    UNIQUE(sequence_id, author_id)
  )`);
}

initTables().catch(console.error);

async function upsertAuthor(accessToken: string) {
  const res = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("카카오 토큰 검증 실패");
  const data = await res.json() as any;
  const kakaoId = String(data.id);
  const name = data.kakao_account?.profile?.nickname || data.properties?.nickname || "익명";
  const thumbnail = data.kakao_account?.profile?.thumbnail_image_url || data.properties?.thumbnail_image || null;

  const existing = await pool.query("SELECT * FROM community_sequence_authors WHERE kakao_id=$1", [kakaoId]);
  if (existing.rows.length > 0) {
    await pool.query("UPDATE community_sequence_authors SET name=$1, thumbnail=$2 WHERE kakao_id=$3", [name, thumbnail, kakaoId]);
    return existing.rows[0];
  }
  const r = await pool.query(
    "INSERT INTO community_sequence_authors (kakao_id, name, thumbnail) VALUES ($1,$2,$3) RETURNING *",
    [kakaoId, name, thumbnail]
  );
  return r.rows[0];
}

// 공개 시퀀스 목록
router.get("/", async (_req, res) => {
  try {
    const rows = await pool.query(`
      SELECT s.id, s.title, s.description, s.category, s.difficulty, s.target_audience as "targetAudience",
             s.estimated_minutes as "estimatedMinutes", s.price, s.view_count as "viewCount",
             s.like_count as "likeCount", s.created_at as "createdAt",
             a.name as "authorName", a.thumbnail as "authorThumbnail"
      FROM community_sequences s
      JOIN community_sequence_authors a ON s.author_id = a.id
      WHERE s.is_public = true
      ORDER BY s.created_at DESC LIMIT 50
    `);
    res.json(rows.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 내 시퀀스 목록
router.get("/mine", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "인증 필요" });
    const author = await upsertAuthor(token);
    const rows = await pool.query(`
      SELECT id, title, description, category, body_parts as "bodyParts",
             target_audience as "targetAudience", difficulty, estimated_minutes as "estimatedMinutes",
             equipment, coaching_notes as "coachingNotes", exercises_json as "exercisesJson",
             is_public as "isPublic", created_at as "createdAt", updated_at as "updatedAt"
      FROM community_sequences WHERE author_id=$1 ORDER BY created_at DESC
    `, [author.id]);
    res.json(rows.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 시퀀스 생성
router.post("/", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "인증 필요" });
    const author = await upsertAuthor(token);
    const { title, description, category, bodyParts, targetAudience, difficulty,
            estimatedMinutes, equipment, classGoal, coachingNotes, exercises, isPublic, price } = req.body;
    const exercisesJson = JSON.stringify(exercises || []);
    const r = await pool.query(`
      INSERT INTO community_sequences
        (author_id, title, description, category, body_parts, target_audience, difficulty,
         estimated_minutes, equipment, class_goal, coaching_notes, exercises_json, is_public, price)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id
    `, [author.id, title, description, category, bodyParts, targetAudience, difficulty,
        estimatedMinutes, equipment, classGoal, coachingNotes, exercisesJson, !!isPublic, price || 0]);
    res.json({ id: r.rows[0].id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 시퀀스 수정
router.put("/:id", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "인증 필요" });
    const author = await upsertAuthor(token);
    const { title, description, category, bodyParts, targetAudience, difficulty,
            estimatedMinutes, equipment, classGoal, coachingNotes, exercises, isPublic, price } = req.body;
    const exercisesJson = JSON.stringify(exercises || []);
    await pool.query(`
      UPDATE community_sequences SET
        title=$1, description=$2, category=$3, body_parts=$4, target_audience=$5, difficulty=$6,
        estimated_minutes=$7, equipment=$8, class_goal=$9, coaching_notes=$10,
        exercises_json=$11, is_public=$12, price=$13, updated_at=now()::text
      WHERE id=$14 AND author_id=$15
    `, [title, description, category, bodyParts, targetAudience, difficulty,
        estimatedMinutes, equipment, classGoal, coachingNotes, exercisesJson,
        !!isPublic, price || 0, req.params.id, author.id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 시퀀스 삭제
router.delete("/:id", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "인증 필요" });
    const author = await upsertAuthor(token);
    await pool.query("DELETE FROM community_sequences WHERE id=$1 AND author_id=$2", [req.params.id, author.id]);
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
    const author = await upsertAuthor(token);
    const seqId = Number(req.params.id);
    const existing = await pool.query(
      "SELECT id FROM community_sequence_likes WHERE sequence_id=$1 AND author_id=$2",
      [seqId, author.id]
    );
    if (existing.rows.length > 0) {
      await pool.query("DELETE FROM community_sequence_likes WHERE sequence_id=$1 AND author_id=$2", [seqId, author.id]);
      await pool.query("UPDATE community_sequences SET like_count=GREATEST(0,like_count-1) WHERE id=$1", [seqId]);
      res.json({ liked: false });
    } else {
      await pool.query("INSERT INTO community_sequence_likes (sequence_id, author_id) VALUES ($1,$2)", [seqId, author.id]);
      await pool.query("UPDATE community_sequences SET like_count=like_count+1 WHERE id=$1", [seqId]);
      res.json({ liked: true });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 시퀀스 상세 (공개)
router.get("/:id", async (req, res) => {
  try {
    await pool.query("UPDATE community_sequences SET view_count=view_count+1 WHERE id=$1", [req.params.id]);
    const r = await pool.query(`
      SELECT s.*, s.exercises_json as "exercisesJson", s.body_parts as "bodyParts",
             s.target_audience as "targetAudience", s.estimated_minutes as "estimatedMinutes",
             s.coaching_notes as "coachingNotes", s.is_public as "isPublic",
             s.created_at as "createdAt", s.updated_at as "updatedAt",
             a.name as "authorName", a.thumbnail as "authorThumbnail"
      FROM community_sequences s JOIN community_sequence_authors a ON s.author_id=a.id
      WHERE s.id=$1
    `, [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "없음" });
    res.json(r.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
