#!/usr/bin/env node
/**
 * Threads Reply Assistant (Saju & Engagement Domain)
 * 
 * High-precision domain rule engine + AI assistant for Threads engagement
 * 
 * Usage:
 *   node scripts/reply-assistant.mjs [--dry-run] [--post-id=<id>] [--interactive] [--auto-post]
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';

// An empty --post-id (e.g. `--post-id=$(lookup)` before the post is published) must not fall back to scanning every recent post.
const postIdFlag = process.argv.find((a) => a.startsWith('--post-id='));
if (postIdFlag !== undefined && !postIdFlag.slice('--post-id='.length).trim()) {
  console.error('❌ --post-id is empty: the post has no threadsId yet (not published?). Refusing to scan all recent posts.');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const REPLIED_CACHE_FILE = path.join(projectRoot, '.data', 'replied_comments.json');

function loadEnv() {
  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const THREADS_API_BASE = 'https://graph.threads.net/v1.0';
// Free /start link for the "회사 체질 vs 독립 체질" post; utm_content is that post's DB id so /ops/growth attributes it.
const CAREER_TYPE_LINK = 'https://www.cosmicpath.app/start?context=career&question=%ED%9A%8C%EC%82%AC%EC%97%90+%EA%B3%84%EC%86%8D+%EB%82%A8%EC%9D%84%EC%A7%80%2C+%EB%82%98%EC%99%80%EC%84%9C+%EB%82%B4+%EC%9D%BC%EC%9D%84+%ED%95%A0%EC%A7%80+%EC%A0%95%ED%95%98%EA%B3%A0+%EC%8B%B6%EC%96%B4%EC%9A%94&utm_source=threads&utm_medium=social&utm_campaign=threads_reply&utm_content=cmvrqpoxw0001epljh8yjsdfs';
const ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN;
const USER_ID = process.env.THREADS_USER_ID;

if (!ACCESS_TOKEN || !USER_ID) {
  console.error('❌ Error: THREADS_ACCESS_TOKEN and THREADS_USER_ID must be set in .env');
  process.exit(1);
}

const OWN_USERNAME = 'cosmicpath.app';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Bursts of replies a few seconds apart read as automation to Threads; keep 30-45s between publishes.
export function publishGapMs(random = Math.random) {
  return 30_000 + Math.floor(random() * 15_000);
}

// The DM itself is sent by hand (the Threads API has no DM), so these replies never auto-post.
export function needsManualDm(replyText) {
  return /DM/.test(replyText);
}

const parentIdOf = (c) => c.replied_to?.id ?? c.replied_to;
const isOwnReply = (c) => c.is_reply_owned_by_me === true || c.username === OWN_USERNAME;

/**
 * Top-level audience comments still waiting for us. Skips replies to replies (the conversation endpoint
 * returns every depth), comments we already answered in this conversation (even if posted outside this
 * script), and anyone we already talked to under this post.
 */
export function selectPendingComments(postId, comments, repliedSet) {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const answeredIds = new Set();
  const answeredUsers = new Set();
  for (const c of comments) {
    if (!isOwnReply(c)) continue;
    const parent = byId.get(parentIdOf(c));
    if (!parent) continue;
    answeredIds.add(parent.id);
    if (parent.username) answeredUsers.add(parent.username);
  }
  return comments.filter(
    (c) =>
      !isOwnReply(c) &&
      parentIdOf(c) === postId &&
      !repliedSet.has(c.id) &&
      !answeredIds.has(c.id) &&
      !answeredUsers.has(c.username)
  );
}

// Replied Cache Helpers
function getRepliedCommentIds() {
  try {
    if (fs.existsSync(REPLIED_CACHE_FILE)) {
      const raw = fs.readFileSync(REPLIED_CACHE_FILE, 'utf8');
      return new Set(JSON.parse(raw));
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveRepliedCommentId(id) {
  const set = getRepliedCommentIds();
  set.add(id);
  const dir = path.dirname(REPLIED_CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REPLIED_CACHE_FILE, JSON.stringify([...set], null, 2), 'utf8');
}

// 1. Fetch user's recent posts
async function fetchRecentUserPosts(limit = 40) {
  const fields = 'id,text,timestamp,permalink,has_replies';
  const url = `${THREADS_API_BASE}/${USER_ID}/threads?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
  
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to fetch user posts: ${err.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return Array.isArray(data.data) ? data.data : [];
}

// 1-1. Fetch a single post details
async function fetchPostDetails(mediaId) {
  const fields = 'id,text,timestamp,permalink,has_replies,username';
  const url = `${THREADS_API_BASE}/${mediaId}?fields=${fields}&access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
  const res = await fetch(url);
  if (!res.ok) {
    return { id: mediaId, text: '' };
  }
  return await res.json();
}

// 2. Fetch replies for a given post
async function fetchPostReplies(mediaId) {
  const fields = 'id,text,timestamp,username,permalink,replied_to,is_reply_owned_by_me';
  let url = `${THREADS_API_BASE}/${mediaId}/conversation?fields=${fields}&access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
  let res = await fetch(url);

  if (!res.ok) {
    url = `${THREADS_API_BASE}/${mediaId}/replies?fields=${fields}&access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
    res = await fetch(url);
  }

  if (!res.ok) {
    const err = await res.json();
    console.warn(`⚠️ Could not fetch replies for ${mediaId}: ${err.error?.message || res.statusText}`);
    return [];
  }

  const data = await res.json();
  return Array.isArray(data.data) ? data.data : [];
}

// Helper: Calculate 12-branch hour from minutes
function getSajuBranch(hours, minutes) {
  let totalMinutes = hours * 60 + minutes;
  // Adjusted minutes (-30 min)
  let adjustedTotal = (totalMinutes - 30 + 1440) % 1440;
  let adjH = Math.floor(adjustedTotal / 60);
  let adjM = adjustedTotal % 60;

  const branches = [
    { name: '자시(子時)', start: 23 * 60 + 30, end: 1 * 60 + 30, range: '23:30~01:30' },
    { name: '축시(丑時)', start: 1 * 60 + 30, end: 3 * 60 + 30, range: '01:30~03:30' },
    { name: '인시(寅時)', start: 3 * 60 + 30, end: 5 * 60 + 30, range: '03:30~05:30' },
    { name: '묘시(卯時)', start: 5 * 60 + 30, end: 7 * 60 + 30, range: '05:30~07:30' },
    { name: '진시(辰時)', start: 7 * 60 + 30, end: 9 * 60 + 30, range: '07:30~09:30' },
    { name: '사시(巳時)', start: 9 * 60 + 30, end: 11 * 60 + 30, range: '09:30~11:30' },
    { name: '오시(午時)', start: 11 * 60 + 30, end: 13 * 60 + 30, range: '11:30~13:30' },
    { name: '미시(未時)', start: 13 * 60 + 30, end: 15 * 60 + 30, range: '13:30~15:30' },
    { name: '신시(申時)', start: 15 * 60 + 30, end: 17 * 60 + 30, range: '15:30~17:30' },
    { name: '유시(酉時)', start: 17 * 60 + 30, end: 19 * 60 + 30, range: '17:30~19:30' },
    { name: '술시(戌時)', start: 19 * 60 + 30, end: 21 * 60 + 30, range: '19:30~21:30' },
    { name: '해시(亥時)', start: 21 * 60 + 30, end: 23 * 60 + 30, range: '21:30~23:30' },
  ];

  let matched = branches[0];
  for (const b of branches) {
    if (b.start > b.end) {
      // 자시 spans across midnight (23:30 to 01:30)
      if (adjustedTotal >= b.start || adjustedTotal < b.end) {
        matched = b;
        break;
      }
    } else {
      if (adjustedTotal >= b.start && adjustedTotal < b.end) {
        matched = b;
        break;
      }
    }
  }

  const pad = (n) => String(n).padStart(2, '0');
  const adjTimeStr = `${pad(adjH)}시 ${pad(adjM)}분`;

  return {
    branchName: matched.name,
    range: matched.range,
    adjustedTimeStr: adjTimeStr,
    adjH,
    adjM,
    adjustedTotal,
  };
}

// 3. Domain Expert Reply Engine
export function generateDomainReply(commentItem, parentPostText = '') {
  const text = (commentItem.text || '').trim();
  const username = commentItem.username || '독자';

  // 0. 체질 글의 '이직' 키워드 댓글 → 무료 진단 링크
  // ponytail: one post hardcoded; look the DB post up by threadsId once a second keyword post ships.
  if (parentPostText.includes('체질') && /이직/.test(text) && text.length <= 30) {
    const careerReplies = [
      `여기서 생년월일만 넣으면 무료로 볼 수 있어.\n질문은 미리 채워놨으니까 상황만 조금 고쳐 써도 돼.\n${CAREER_TYPE_LINK}`,
      `생년월일 하나면 바로 나와. 질문도 미리 넣어놨어.\n${CAREER_TYPE_LINK}`,
      `무료 진단 링크야. 체질 말고, 지금 먼저 확인할 거 하나부터 봐.\n${CAREER_TYPE_LINK}`,
    ];
    let hash = 0;
    for (let i = 0; i < commentItem.id.length; i++) hash += commentItem.id.charCodeAt(i);
    return careerReplies[hash % careerReplies.length];
  }

  // 1. 공격적이거나 냉소적인 댓글 대응 ("가르칠 수 있는 수준", "오래 살았나 보네요")
  if (/가르칠|수준|오래\s*살았|잘난/i.test(text)) {
    return `맞아, 아는 사람한텐 당연한 얘기임. 처음 보는 사람들 보라고 쓴 거야`;
  }

  // 1-1. 커리어/퇴사/버티기 고민 및 감정 토로 ("퇴사일지 버틸지..힘들어요")
  if (/퇴사.*버틸|버틸.*퇴사|이직.*버틸|힘들/i.test(text)) {
    return `홧김에 던지면 속은 시원한데 3달 뒤 카드값 보고 오열하더라. 지금 얼마나 지쳤는지부터 봐봐, 프로필 링크에 있음`;
  }

  // 2. CTA / 참여형 짧은 댓글 ("나도!", "저요", "저도요!", "나도 확인하고싶어!!", "궁금해요!", "나궁금해")
  if (/^(나도!*|저요!*|저도!*|저도요!*|저두요!*|나~*|궁금해요!*|나\s*궁금해!*|나도\s*확인.*|확인하고.*|부탁드립니다!*)$/i.test(text) || (text.length <= 15 && /나도|저요|저도|저두|궁금|확인|부탁/i.test(text))) {
    // Generic "sent you a link + coupon" replies match scam-template patterns Threads auto-removes, so each one names what the link does.
    const dmVariations = [
      `생년월일만 넣으면 바로 나오는 진단 링크, DM으로 보내줄게. 메시지 요청함도 한 번 봐줘`,
      `DM으로 진단 링크 보낼게. 생년월일이랑 태어난 시간 넣으면 바로 나와`,
      `링크는 DM으로 따로 줄게. 안 보이면 메시지 요청함에 들어가 있을 거야`,
    ];
    // Pick deterministic variation by hash of comment id or username
    let hash = 0;
    for (let i = 0; i < commentItem.id.length; i++) hash += commentItem.id.charCodeAt(i);
    return dmVariations[hash % dmVariations.length];
  }

  // 3. 균시차 / 천문 관련 질문
  if (/균시차|태양시|공전|이심률/i.test(text) && !/살아온|되짚어/i.test(text)) {
    return `오 균시차까지 아네. 근데 제일 크게 어긋나는 건 표준시 30분 쪽이라 그거부터 맞추는 게 먼저야`;
  }

  // 4. 임상 경험 / 살아온 역사 피드백 ("살아온 역사 되짚어보면 표준시 사주가 더 잘맞더라구요")
  if (/살아온|되짚|임상.*맞|경험/i.test(text)) {
    return `결국 내 인생이랑 맞는 기준이 정답이지. 자시 근처는 학파마다 갈려서 더 그럼`;
  }

  // 5. 헷갈려요 / 혼란 불평 ("이 말이 더 헷갈려요 ㅡㅡ;;;")
  if (/더\s*헷갈|더\s*혼란|어려워/i.test(text)) {
    return `병원 기록 시간에서 30분만 빼고 만세력에 넣으면 끝이야. 몇 시 몇 분생인지 남겨주면 계산해줄게`;
  }

  // 6. "네바뀌엇네용" / 바뀜 확인 재대댓글
  if (/바뀌|바꼇|바꼈|달라/i.test(text) && !/똑같|안\s*바/i.test(text)) {
    return `글자 바뀌었구나. 시주 바뀌면 성향 풀이도 꽤 달라져서 다시 보면 느낌 다를 거야`;
  }

  // 7. 썸머타임 관련 질문 및 임상
  if (/썸머|서머|일광절약/i.test(text)) {
    return `87~88년생이면 썸머타임까지 껴서 1시간 30분 빼는 게 보통이야. 체감이랑 다르면 분 단위로 다시 봐봐`;
  }

  // 8. 비판/반론 (만세력 어플에 다 적용되어 있다 / 혼란 가중 등)
  if (/만세력|어플|혼란|다\s*알고/i.test(text)) {
    return `맞아, 요즘 앱은 보정 옵션 다 있음. 근데 이미 보정된 시간을 또 넣어서 두 번 빼는 경우가 꽤 많더라`;
  }

  // 9. 야자시 / 조자시 관련 질문
  if (/야자시|조자시/i.test(text)) {
    return `야자시 조자시는 진짜 끝없는 논쟁이지 ㅋㅋ 30분 빼고 둘 다 대입해보면 어느 쪽인지 감 옴`;
  }

  // 10. 외국 / 해외 출생자
  if (/외국|해외|미국|유럽|일본|중국|캐나다|호주|이민|출생국/i.test(text)) {
    return `외국에서 태어났으면 30분 빼면 안 돼. 그건 한국 표준시 얘기라서. 어느 나라 어느 도시야?`;
  }

  // 11. 구체적 시간 언급 파싱:
  let hour = null;
  let minute = 0;
  let rawTimeStr = '';

  const digitalMatch = text.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (digitalMatch) {
    hour = parseInt(digitalMatch[1], 10);
    minute = parseInt(digitalMatch[2], 10);
    rawTimeStr = digitalMatch[0];
  } else {
    const koreanMatch = text.match(/(오전|오후|새벽|밤|낮)?\s*(\d{1,2})\s*시\s*(반|\d{1,2}\s*분?)?/i);
    if (koreanMatch) {
      const period = koreanMatch[1] || '';
      hour = parseInt(koreanMatch[2], 10);
      const minPart = koreanMatch[3] || '';
      if (minPart === '반') {
        minute = 30;
      } else if (minPart) {
        minute = parseInt(minPart.replace(/[^0-9]/g, ''), 10) || 0;
      }
      if ((period === '오후' || period === '밤' || /신시|유시|술시|해시/i.test(text)) && hour < 12 && hour > 0) {
        if (!period.includes('오전') && !period.includes('새벽')) hour += 12;
      } else if ((period === '오전' || period === '새벽') && hour === 12) {
        hour = 0;
      }
      rawTimeStr = koreanMatch[0].trim();
    }
  }

  if (hour !== null && hour >= 0 && hour <= 24 && minute >= 0 && minute < 60) {
    const saju = getSajuBranch(hour, minute);

    // 특별 시간대 대응 (23:00 ~ 23:29 -> 30분 빼면 22시 후반 해시!)
    if (hour === 23 && minute < 30) {
      return `${rawTimeStr}에서 30분 빼면 ${saju.adjustedTimeStr}이라 자시 아니고 해시(21:30~23:30)야. 날짜도 전날 그대로고`;
    }

    // 특별 시간대 대응 (23:30 ~ 23:59 -> 30분 빼면 23시 초반 해시!)
    if (hour === 23 && minute >= 30 && minute <= 59 && saju.adjustedTotal < 23 * 60 + 30) {
      return `${rawTimeStr}에서 30분 빼면 ${saju.adjustedTimeStr}이라 자시 직전, 해시(21:30~23:30)야. 일진도 안 넘어감`;
    }

    // 09:10 ~ 09:20 진시 질문 ("9시10분은 진시맞지?")
    if (hour === 9 && minute <= 20) {
      return `맞아. ${rawTimeStr}에서 30분 빼도 ${saju.adjustedTimeStr}이라 ${saju.branchName}(${saju.range}) 한가운데야`;
    }

    // 09:45 사시 -> 진시 반전 케이스
    if (hour === 9 && minute >= 30 && minute <= 50) {
      return `${rawTimeStr}에서 30분 빼면 ${saju.adjustedTimeStr}이라 사시 아니고 ${saju.branchName}(${saju.range})야. ${saju.branchName.slice(0, 2)}생으로 봐야 함`;
    }

    // 아기/가족 언급
    if (/애기|아기|아들|딸|아이/i.test(text)) {
      return `${rawTimeStr}에서 30분 빼면 ${saju.adjustedTimeStr}, ${saju.branchName}(${saju.range})야. 원래 알던 시주랑 글자 바뀌었어?`;
    }

    // 역술가마다 달랐던 고민 (오후 1시 5분 등)
    if (/역술가|다르고|오시|미시/i.test(text)) {
      return `${rawTimeStr}에서 30분 빼면 ${saju.adjustedTimeStr}이라 ${saju.branchName}(${saju.range})가 맞아. 보정 안 하고 본 데서 다르게 나왔을 거야`;
    }

    // 일반 시간 질문
    return `${rawTimeStr}에서 30분 빼면 ${saju.adjustedTimeStr}, ${saju.branchName}(${saju.range}) 구간이야`;
  }

  // 12. 사시생 / 특정 시주 언급 ("헐 나 여태 사시생으로 알고 있었는데")
  if (/사시생|묘시생|진시생|자시생|축시생|인시생|오시생|미시생|신시생|유시생|술시생|해시생/i.test(text)) {
    return `몇 시 몇 분생이야? 30분 빼서 글자 넘어가는지 바로 봐줄게`;
  }

  // 13. "알고 있었어 / 알고있었"
  if (/알고\s*있었/i.test(text)) {
    return `오 이미 알고 있었네. 은근 모르는 사람 많더라`;
  }

  // 14. "30분 빼도 똑같아 / 안 바뀌어 / 그대로"
  if (/똑같|그대로|안\s*바[뀌꾀]|변함\s*없/i.test(text)) {
    return `시 한가운데 태어났으면 30분 빼도 안 바뀌어. 원래 알던 게 맞는 거지`;
  }

  // 15. 서울 출생 / 지역 감안 재대댓글
  if (/서울|태어난거/i.test(text)) {
    return `서울이면 30분 빼는 게 맞아. 제대로 보고 있었네`;
  }

  // 16. 사주 조금 알아요 등 가벼운 소통
  if (/관심|조금\s*알/i.test(text)) {
    return `조금 알 때가 제일 재밌지 ㅋㅋ 요즘 뭐가 제일 궁금해?`;
  }

  let hash = 0;
  for (let i = 0; i < commentItem.id.length; i++) hash += commentItem.id.charCodeAt(i);

  // 16-1. 짧은 인사·감사 — thanks gets thanks back, not a question about their life.
  if (text.length <= 30 && /감사|고마|잘\s*봤|잘\s*보고|좋은\s*(글|정보)|유익|공감|최고/.test(text)) {
    const thanksReplies = [
      `봐줘서 고마워`,
      `오 고마워 ㅎㅎ`,
      `고마워! 도움 됐으면 됐다`,
      `댓글까지 남겨줘서 고마워`,
    ];
    return thanksReplies[hash % thanksReplies.length];
  }

  // 17. 기본 참여형 답글 — fires for every unmatched comment, so vary it.
  const defaultReplies = [
    `고마워. 궁금한 거 있으면 태어난 시간이랑 같이 남겨줘`,
    `오 반갑다. 요즘 제일 고민되는 게 뭐야?`,
    `댓글 고마워! 몇 시생인지 알려주면 30분 빼서 봐줄게`,
  ];
  return defaultReplies[hash % defaultReplies.length];
}

// 4. Publish reply to Threads
let lastPublishAt = 0;

async function fetchCommentUsername(commentId) {
  const res = await fetch(`${THREADS_API_BASE}/${commentId}?fields=username&access_token=${encodeURIComponent(ACCESS_TOKEN)}`);
  if (!res.ok) return null;
  return (await res.json()).username ?? null;
}

async function publishReplyToComment(comment, replyText) {
  const commentId = comment.id;
  // Re-read the target right before posting so a deleted comment or a shifted list never gets someone else's reply.
  const currentAuthor = await fetchCommentUsername(commentId);
  if (!comment.username || currentAuthor !== comment.username) {
    throw new Error(`Target check failed: expected @${comment.username}, found @${currentAuthor ?? '(unreadable)'}`);
  }

  const waitMs = lastPublishAt + publishGapMs() - Date.now();
  if (waitMs > 0) {
    console.log(`⏳ Waiting ${Math.ceil(waitMs / 1000)}s before publishing...`);
    await sleep(waitMs);
  }

  const containerParams = new URLSearchParams({
    media_type: 'TEXT',
    text: replyText,
    reply_to_id: commentId,
    access_token: ACCESS_TOKEN,
  });

  const containerRes = await fetch(`${THREADS_API_BASE}/${USER_ID}/threads?${containerParams}`, {
    method: 'POST',
  });
  const containerData = await containerRes.json();
  if (!containerRes.ok) {
    throw new Error(`Container creation failed: ${containerData.error?.message || JSON.stringify(containerData)}`);
  }

  const creationId = containerData.id;
  await sleep(2500);

  const publishParams = new URLSearchParams({
    creation_id: creationId,
    access_token: ACCESS_TOKEN,
  });

  const publishRes = await fetch(`${THREADS_API_BASE}/${USER_ID}/threads_publish?${publishParams}`, {
    method: 'POST',
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok) {
    throw new Error(`Publish failed: ${publishData.error?.message || JSON.stringify(publishData)}`);
  }

  lastPublishAt = Date.now();
  saveRepliedCommentId(commentId);
  return publishData.id;
}

// 5. Interactive prompt helper
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

// Main Routine
async function main() {
  const args = process.argv.slice(2);
  const isAutoPost = args.includes('--auto-post');
  const isInteractive = args.includes('--interactive');
  const isDryRun = args.includes('--dry-run') || (!isAutoPost && !isInteractive);
  const postIdArg = args.find((a) => a.startsWith('--post-id='))?.split('=')[1];
  const repliedSet = getRepliedCommentIds();

  console.log('🔮 ========================================');
  console.log('   Threads AI Reply Assistant (Multi-Post)');
  console.log('========================================\n');

  console.log(`⚙️ Mode: ${isDryRun ? '🔍 DRY RUN (Preview only)' : isInteractive ? '✍️ INTERACTIVE (1-by-1 confirmation)' : '🚀 AUTO POST'}`);
  console.log(`💾 Already replied count in cache: ${repliedSet.size}`);

  let postsToProcess = [];

  if (postIdArg) {
    console.log(`📌 Fetching details for Post ID: ${postIdArg}...`);
    const targetPost = await fetchPostDetails(postIdArg);
    postsToProcess.push(targetPost);
  } else {
    console.log('📡 Fetching recent posts from Threads API...');
    const recentPosts = await fetchRecentUserPosts(15);

    if (recentPosts.length === 0) {
      console.log('⚠️ No published posts found for this user.');
      return;
    }

    postsToProcess = recentPosts;
  }

  let totalPendingAcrossPosts = 0;
  const tasks = [];

  for (const post of postsToProcess) {
    const allComments = await fetchPostReplies(post.id);
    const unreplied = selectPendingComments(post.id, allComments, repliedSet);

    if (unreplied.length > 0) {
      totalPendingAcrossPosts += unreplied.length;
      tasks.push({
        post,
        unreplied,
      });
    }
  }

  console.log(`\n📊 Total Active Posts with Pending Comments: ${tasks.length} | Total Pending: ${totalPendingAcrossPosts}\n`);

  if (tasks.length === 0) {
    console.log('✨ All audience comments across all posts have already been answered! No pending comments.');
    return;
  }

  let commentCounter = 0;
  // ponytail: per-run only; persist published texts if repeats across runs start showing up.
  const usedReplies = new Set();

  for (const task of tasks) {
    console.log(`\n====================================================`);
    console.log(`📌 [포스트 ID: ${task.post.id}] "${(task.post.text || '').replace(/\n/g, ' ').slice(0, 50)}..."`);
    console.log(`   대기 댓글 수: ${task.unreplied.length}건`);
    console.log(`====================================================`);

    for (const comment of task.unreplied) {
      commentCounter++;
      console.log(`\n[댓글 #${commentCounter}] 작성자: @${comment.username || '알 수 없음'} (ID: ${comment.id})`);
      console.log(`💬 원문: "${comment.text}"`);

      const draftReply = generateDomainReply(comment, task.post.text || '');
      console.log(`🤖 [추천 답글]`);
      console.log(`"${draftReply}"\n`);

      if (isDryRun) {
        continue;
      }

      if (usedReplies.has(draftReply)) {
        console.log('⚠️ 이번 실행에서 이미 쓴 문구야. 똑같은 답글이 반복되면 대행 티가 나니까 바꿔서 보내.');
      }

      if (isInteractive) {
        const choice = await askQuestion('👉 전송하시겠습니까? [y: 전송 / e: 수정후 전송 / s: 스킵 / q: 종료]: ');
        if (choice.toLowerCase() === 'q') {
          console.log('🛑 Aborted by user.');
          return;
        }
        if (choice.toLowerCase() === 's' || choice === '') {
          console.log('⏭️ Skipped.');
          continue;
        }

        let finalReply = draftReply;
        if (choice.toLowerCase() === 'e') {
          finalReply = await askQuestion('✏️ 답글 내용을 입력하세요: ');
          if (!finalReply.trim()) {
            console.log('⚠️ Blank input, skipped.');
            continue;
          }
        }

        try {
          console.log(`🚀 Publishing reply to @${comment.username}...`);
          const publishedId = await publishReplyToComment(comment, finalReply);
          usedReplies.add(finalReply);
          console.log(`✅ Published successfully! (Reply ID: ${publishedId})`);
        } catch (err) {
          console.error(`❌ Publish error: ${err.message}`);
        }
      } else if (isAutoPost) {
        if (needsManualDm(draftReply) || usedReplies.has(draftReply)) {
          console.log('⏭️ 자동 발행 제외: DM을 직접 보내야 하는 답글이거나 이번 실행에서 이미 쓴 문구야. --interactive로 처리해.');
          continue;
        }
        try {
          console.log(`🚀 Auto-publishing reply to @${comment.username}...`);
          const publishedId = await publishReplyToComment(comment, draftReply);
          usedReplies.add(draftReply);
          console.log(`✅ Published! (Reply ID: ${publishedId})`);
        } catch (err) {
          console.error(`❌ Auto-publish error: ${err.message}`);
        }
      }
    }
  }

  console.log('\n🏁 Multi-post process completed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('\n💥 Fatal Error:', err);
    process.exit(1);
  });
}
