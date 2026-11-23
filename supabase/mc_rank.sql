-- ════════════════════════════════════════════════════════════════
--  모션 메카닉 · 센터 랭킹
--  Supabase → SQL Editor 에 붙여넣고 Run 하세요.
--
--  ■ 이 스크립트는 "새로 만들기"만 합니다.
--    기존 테이블·함수(dp_inc_counter 등)를 수정하거나 지우지 않습니다.
--    DROP / ALTER 문이 하나도 없는 것을 확인하실 수 있습니다.
--
--  ■ 매월 초기화
--    기록을 지우지 않고, 조회할 때 "이번 달"만 보여주는 방식입니다.
--    11월 1일이 되면 11월 기록이 없으니 순위표가 자동으로 비어 있습니다.
--    지난달 기록은 남아 있어서 나중에 "지난달 1위"를 보여줄 수도 있습니다.
--    실제로 지우고 싶으면 맨 아래 선택 항목을 쓰세요.
-- ════════════════════════════════════════════════════════════════

-- ── 1) 기록 테이블 ──────────────────────────────────────────────
create table if not exists public.mc_rank (
  id          bigserial   primary key,
  ym          text        not null,   -- 'YYYY-MM' 한국시간 기준 월
  ex          text        not null,   -- squat | lunge | press | row
  dur         smallint    not null,   -- 30 | 60
  name        text        not null,   -- 회원이 적은 이름 (최대 8자)
  reps        smallint    not null,   -- 끝까지 한 횟수
  created_at  timestamptz not null default now()
);

-- 순위 조회를 빠르게
create index if not exists mc_rank_lookup
  on public.mc_rank (ym, ex, dur, reps desc);


-- ── 2) 보안: 앱 키로는 테이블에 직접 접근 못 하게 ────────────────
-- 앱에 들어 있는 키는 브라우저에서 누구나 볼 수 있습니다.
-- RLS를 켜고 정책을 만들지 않으면, 그 키로는 읽기·쓰기·삭제가 모두 막힙니다.
-- 아래 3)의 함수를 통해서만 접근할 수 있습니다.
alter table public.mc_rank enable row level security;


-- ── 3) 기록 올리기 (검사 후 저장) ───────────────────────────────
create or replace function public.mc_rank_add(
  p_ex text, p_dur int, p_name text, p_reps int
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  -- 정해진 종목·시간이 아니면 무시
  if p_ex not in ('squat', 'lunge', 'press', 'row') then return; end if;
  if p_dur not in (30, 60) then return; end if;

  -- 비정상 기록 차단 (30초에 90회, 60초에 180회를 넘을 수 없음)
  if p_reps is null or p_reps < 1 or p_reps > p_dur * 3 then return; end if;

  -- 이름 정리: 앞뒤 공백 제거, 비어 있으면 '익명', 8자로 자름
  v_name := nullif(btrim(coalesce(p_name, '')), '');
  v_name := left(coalesce(v_name, '익명'), 8);

  insert into public.mc_rank (ym, ex, dur, name, reps)
  values (
    to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM'),
    p_ex, p_dur, v_name, p_reps
  );
end;
$$;


-- ── 4) 이번 달 순위 3위까지 읽기 ────────────────────────────────
create or replace function public.mc_rank_top(
  p_ex text, p_dur int
) returns table (name text, reps smallint, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select r.name, r.reps, r.created_at
  from public.mc_rank r
  where r.ym = to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM')
    and r.ex = p_ex
    and r.dur = p_dur
  order by r.reps desc, r.created_at asc
  limit 3;
$$;


-- ── 5) 앱이 위 두 함수만 쓸 수 있게 권한 주기 ──────────────────
grant execute on function public.mc_rank_add(text, int, text, int) to anon;
grant execute on function public.mc_rank_top(text, int)           to anon;


-- ════════════════════════════════════════════════════════════════
--  여기까지가 필수입니다. 아래는 선택 항목입니다.
-- ════════════════════════════════════════════════════════════════

-- (선택) 지난달 기록까지 실제로 지우고 싶을 때 — 언제든 수동 실행
-- delete from public.mc_rank
--  where ym < to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');

-- (선택) 잘 만들어졌는지 확인
-- select public.mc_rank_add('squat', 30, '테스트', 12);
-- select * from public.mc_rank_top('squat', 30);
-- delete from public.mc_rank where name = '테스트';
