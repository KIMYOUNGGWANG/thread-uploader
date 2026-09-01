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
import { fileURLToPath } from 'node:url';

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
const ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN;
const USER_ID = process.env.THREADS_USER_ID;

if (!ACCESS_TOKEN || !USER_ID) {
  console.error('❌ Error: THREADS_ACCESS_TOKEN and THREADS_USER_ID must be set in .env');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  // Initialize with the 6 replied IDs from earlier
  const initial = [
    '17917963506434197',
    '18089639762388257',
    '18091302203638630',
    '18120023002920194',
    '17956680237232119',
    '17904496686482068',
  ];
  return new Set(initial);
}

function saveRepliedCommentId(id) {
  const set = getRepliedCommentIds();
  set.add(id);
  const dir = path.dirname(REPLIED_CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REPLIED_CACHE_FILE, JSON.stringify([...set], null, 2), 'utf8');
}

// 1. Fetch user's recent posts
async function fetchRecentUserPosts(limit = 10) {
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
  let url = `${THREADS_API_BASE}/${mediaId}/conversation?fields=id,text,timestamp,username,permalink&access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
  let res = await fetch(url);
  
  if (!res.ok) {
    url = `${THREADS_API_BASE}/${mediaId}/replies?fields=id,text,timestamp,username,permalink&access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
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

// 3. Domain Expert Saju Reply Engine
function generateDomainSajuReply(commentItem) {
  const text = (commentItem.text || '').trim();
  const username = commentItem.username || '독자';

  // 1. 균시차 / 천문 관련 질문
  if (/균시차|태양시|공전|이심률/i.test(text)) {
    return `맞습니다! 지구 공전 궤도 이심률에 따른 균시차(±15분)까지 보면 더 정밀해지죠 👍 다만 가장 큰 왜곡은 일본 표준시 차용(-30분)에서 오기 때문에 이것부터 맞추는 게 1순위입니다. 사주에 관심 많으신가 봐요!`;
  }

  // 2. 썸머타임 관련 질문 및 임상
  if (/썸머|서머|일광절약/i.test(text)) {
    return `썸머타임 적용 연도(한국 87~88년 등)는 인위적으로 1시간을 당긴 거라 -1시간 30분을 빼는 게 표준 학설입니다! 다만 본인 임상에서 다르게 느껴지셨다면 실제 출생 분(分)이나 지역 경도 편차를 대조해보시는 걸 추천드려요!`;
  }

  // 3. 비판/반론 (만세력 어플에 다 적용되어 있다 / 혼란 가중 등)
  if (/만세력|어플|혼란|다\s*알고/i.test(text)) {
    return `맞습니다! 최신 만세력 앱들은 표준시 보정 옵션이 기본 탑재되어 있죠 👍 다만 본인 출생시각을 앱에 넣을 때 '이미 보정된 시간'인지 모르고 두 번 빼거나, 병원 기록 그대로 헷갈려하시는 분들이 여전히 많아 짚어드린 내용입니다 :)`;
  }

  // 4. 야자시 / 조자시 관련 질문
  if (/야자시|조자시/i.test(text)) {
    return `야자시/조자시는 역학계에서도 수백 년간 갈리는 최대 난제죠 😅 30분 보정(23:30 기준)을 먼저 적용해보시면 어느 쪽 해석이 본인 실제 인생 궤적과 맞는지 훨씬 명확해집니다!`;
  }

  // 5. 외국 / 해외 출생자
  if (/외국|해외|미국|유럽|일본|중국|캐나다|호주|이민|출생국/i.test(text)) {
    return `외국 태생은 30분 빼시면 안 됩니다! ❌ 한국만 일본 표준시(동경 135도)를 쓰고 있어서 -30분 보정하는 거라, 외국은 '출생 국가 현지 시간 + 해당 도시 경도' 기준으로 봐야 합니다. 태어나신 국가/도시가 어디신가요?`;
  }

  // 6. 구체적 시간 언급 파싱:
  // 지원 포맷: "21:31", "23:55", "00:33", "오전 5시35분", "오후 1시 5분", "4시반", "11시10분" 등
  let hour = null;
  let minute = 0;
  let rawTimeStr = '';

  // Case A: 디지털 시각 (21:31, 00:33, 23:55 등)
  const digitalMatch = text.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (digitalMatch) {
    hour = parseInt(digitalMatch[1], 10);
    minute = parseInt(digitalMatch[2], 10);
    rawTimeStr = digitalMatch[0];
  } else {
    // Case B: 한글 시각 ("오전 5시35분", "4시반", "오후 1시 5분")
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

    // 특별 시간대 대응 (23:55, 23:59 -> 자시가 아니라 해시!)
    if (hour === 23 && minute >= 30 && minute <= 59 && saju.adjustedTotal < 23 * 60 + 30) {
      return `${rawTimeStr}에서 30분 빼면 ${saju.adjustedTimeStr}이라 자시(23:30~) 직전인 '해시(亥時, 21:30~23:30)'가 됩니다! 날짜(일진)까지 안 넘어가는 초특급 반전 케이스네요 😮`;
    }

    // 아기/가족 언급
    if (/애기|아기|아들|딸|아이/i.test(text)) {
      return `${rawTimeStr}에서 30분 빼면 약 ${saju.adjustedTimeStr}이라 '${saju.branchName}(${saju.range})' 구간이 맞습니다! 기존 시주에서 글자가 바뀌었나요? 👶`;
    }

    // 역술가마다 달랐던 고민 (오후 1시 5분 등)
    if (/역술가|다르고|오시|미시/i.test(text)) {
      return `${rawTimeStr}에서 30분 빼면 ${saju.adjustedTimeStr}이라 '${saju.branchName}(${saju.range})'가 100% 맞습니다! 30분 보정을 안 하고 단순히 13시 넘었다고 뒤 글자로 본 분들이 잘못 본 케이스입니다 👍`;
    }

    // 05:35 케이스 (인시인지 묘시인지 묻는 질문)
    if (/인시|묘시/i.test(text) && hour === 5) {
      return `정확하게 보셨습니다! ${rawTimeStr}에서 30분 빼면 ${saju.adjustedTimeStr}이라 묘시(05:30~)가 아니라 '${saju.branchName}(${saju.range})'가 맞습니다 🎯 글자가 완전히 바뀌는 대표적인 케이스네요!`;
    }

    // 일반 시간 질문
    return `네! ${rawTimeStr}에서 30분 빼면 약 ${saju.adjustedTimeStr}이라 '${saju.branchName}(${saju.range})' 구간에 해당합니다 👍 30분 경계선만 아니면 글자 변동 없습니다!`;
  }

  // 7. 사시생 / 특정 시주 언급 ("헐 나 여태 사시생으로 알고 있었는데")
  if (/사시생|묘시생|진시생|자시생|축시생|인시생|오시생|미시생|신시생|유시생|술시생|해시생/i.test(text)) {
    return `태어나신 정확한 시간(시/분)이 어떻게 되시나요? 30분 뺐을 때 앞뒤 글자로 넘어갔는지 바로 계산해드릴게요!`;
  }

  // 8. "30분 빼도 똑같아 / 안 바뀌어 / 그대로"
  if (/똑같|그대로|안\s*바[뀌꾀]|변함\s*없/i.test(text)) {
    return `시(時)의 정중앙에 걸쳐 계시면 30분 빼도 안 바뀝니다! 원래 알고 계시던 사주가 100% 진짜 본인 사주 맞네요 🎯 혹시 몇 시 태생이신가요?`;
  }

  // 9. 서울 출생 / 지역 감안 재대댓글
  if (/서울|태어난거/i.test(text)) {
    return `서울 출생이시면 딱 -32분 편차라 가장 정확하게 보신 게 맞습니다 👍 제대로 알고 계셨네요!`;
  }

  // 10. 사주 조금 알아요 등 가벼운 소통
  if (/관심|조금\s*알/i.test(text)) {
    return `조금 아시는 수준이 아니라 균시차까지 언급하실 정도면 상당한 내공이십니다 👏`;
  }

  // 11. 기본 참여형 답글
  return `댓글 감사합니다! 태어나신 시각에서 30분 뺐을 때 시주가 어떻게 나오셨나요? 궁금한 시간대 남겨주시면 계산해드릴게요 👍`;
}

// 4. Publish reply to Threads
async function publishReplyToComment(commentId, replyText) {
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
  console.log('   Threads AI Reply Assistant (Saju Domain)');
  console.log('========================================\n');

  console.log(`⚙️ Mode: ${isDryRun ? '🔍 DRY RUN (Preview only)' : isInteractive ? '✍️ INTERACTIVE (1-by-1 confirmation)' : '🚀 AUTO POST'}`);
  console.log(`💾 Already replied count in cache: ${repliedSet.size}`);

  let targetPost = null;

  if (postIdArg) {
    console.log(`📌 Fetching details for Post ID: ${postIdArg}...`);
    targetPost = await fetchPostDetails(postIdArg);
    console.log(`🎯 Post Content: "${targetPost.text?.slice(0, 70)}..."`);
  } else {
    console.log('📡 Fetching recent posts from Threads API...');
    const recentPosts = await fetchRecentUserPosts(10);

    if (recentPosts.length === 0) {
      console.log('⚠️ No published posts found for this user.');
      return;
    }

    console.log(`\n📋 Recent Posts (${recentPosts.length} found):`);
    recentPosts.forEach((post, i) => {
      const preview = (post.text || '').replace(/\n/g, ' ').slice(0, 60);
      console.log(`  [${i + 1}] ID: ${post.id} | ${preview}...`);
    });

    const sajuPost = recentPosts.find((p) => p.text && (p.text.includes('10명 중 7명') || p.text.includes('시주') || p.text.includes('30분')));
    targetPost = sajuPost || recentPosts[0];

    console.log(`\n🎯 Selected Post: [${targetPost.id}] "${targetPost.text?.slice(0, 50)}..."`);
  }

  console.log('\n💬 Fetching comments/replies for this post...');
  const allComments = await fetchPostReplies(targetPost.id);

  // Filter out self-replies
  const audienceComments = allComments.filter(c => c.username !== 'cosmicpath.app' && c.username !== targetPost.username);

  // Filter out already replied comments (unless in dry run where we inspect unreplied)
  const unrepliedComments = audienceComments.filter(c => !repliedSet.has(c.id));

  console.log(`📊 Total Audience Comments: ${audienceComments.length} | Pending New Replies: ${unrepliedComments.length}`);

  if (unrepliedComments.length === 0) {
    console.log('✨ All audience comments have already been answered! No new comments pending.');
    return;
  }

  console.log(`\n✨ Found ${unrepliedComments.length} pending comment(s). Generating domain expert replies...\n`);

  for (let i = 0; i < unrepliedComments.length; i++) {
    const comment = unrepliedComments[i];
    console.log('====================================================');
    console.log(`[신규 댓글 #${i + 1}] 작성자: @${comment.username || '알 수 없음'} (ID: ${comment.id})`);
    console.log(`💬 원문: "${comment.text}"`);

    const draftReply = generateDomainSajuReply(comment);
    console.log(`\n🤖 [AI/도메인 추천 답글]`);
    console.log(`"${draftReply}"\n`);

    if (isDryRun) {
      continue;
    }

    if (isInteractive) {
      const choice = await askQuestion('👉 전송하시겠습니까? [y: 전송 / e: 수정후 전송 / s: 스킵 / q: 종료]: ');
      if (choice.toLowerCase() === 'q') {
        console.log('🛑 Aborted by user.');
        break;
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
        const publishedId = await publishReplyToComment(comment.id, finalReply);
        console.log(`✅ Published successfully! (Reply ID: ${publishedId})`);
        await sleep(3000);
      } catch (err) {
        console.error(`❌ Publish error: ${err.message}`);
      }
    } else if (isAutoPost) {
      try {
        console.log(`🚀 Auto-publishing reply to @${comment.username}...`);
        const publishedId = await publishReplyToComment(comment.id, draftReply);
        console.log(`✅ Published! (Reply ID: ${publishedId})`);
        await sleep(5000);
      } catch (err) {
        console.error(`❌ Auto-publish error: ${err.message}`);
      }
    }
  }

  console.log('====================================================');
  console.log('\n🏁 Process completed.');
}

main().catch((err) => {
  console.error('\n💥 Fatal Error:', err);
  process.exit(1);
});
