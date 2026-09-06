import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import { learnViralPatterns } from '../src/lib/viral-service';

async function syncOmaMemory() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`🔄 Starting OMA Memory ↔ PostgreSQL Database Synchronization... ${isDryRun ? '[DRY-RUN]' : ''}`);

  // 1. Read brand-voice.md (check .agent/memory and .agents/memory)
  const candidatePaths = [
    path.join(process.cwd(), '.agent/memory/brand-voice.md'),
    path.join(process.cwd(), '.agents/memory/brand-voice.md'),
  ];
  const brandVoicePath = candidatePaths.find((p) => fs.existsSync(p));
  if (!brandVoicePath) {
    throw new Error(`brand-voice.md not found in candidates: ${candidatePaths.join(', ')}`);
  }
  const brandVoiceContent = fs.readFileSync(brandVoicePath, 'utf-8');
  console.log(`✅ Loaded brand-voice.md from ${brandVoicePath} (${brandVoiceContent.length} bytes)`);

  // 2. Fetch CosmicPath brand
  const brand = await prisma.brand.findFirst({ where: { slug: 'cosmicpath' } });
  if (!brand) {
    throw new Error('CosmicPath brand not found in database');
  }

  // 3. Update brandConfig (systemPrompt, topics, productProfile)
  const currentConfig = JSON.parse(brand.brandConfig || '{}');
  currentConfig.systemPrompt = brandVoiceContent;

  // Clean legacy topics and ensure 3 new wedges are present
  const legacyTerms = ['진태양시', '30분', '32분', '타로 전면 폐기'];
  const cleanedTopics = (currentConfig.topics || []).filter(
    (t: string) => !legacyTerms.some((term) => t.includes(term))
  );
  const newWedgeTopics = [
    '식상 vs 관성 기질 미스매치',
    '10년 대운 교운기 번아웃',
    '단일 사주 맹점과 5대 엔진 교차 분석',
  ];
  for (const newTopic of newWedgeTopics) {
    if (!cleanedTopics.includes(newTopic)) {
      cleanedTopics.unshift(newTopic);
    }
  }
  currentConfig.topics = cleanedTopics;

  // Update productProfile positioning
  if (currentConfig.productProfile) {
    currentConfig.productProfile.oneLineDescription =
      "5대 동서양 결정론적 계산 엔진 교차 검증 기반의 VIP 인생 의사결정 도시에(Executive Decision Dossier)";
    currentConfig.productProfile.positioningNotes =
      "사주·점성술·자미두수·태국왕실·수비학 5대 엔진 교차 분석. 단일 도구 맹신과 무속적 위로 배제. 컨설팅 펌 스타일의 냉철한 인텔리전스.";
  }

  console.log(`\n📋 Updated Topics (${cleanedTopics.length}):`);
  cleanedTopics.slice(0, 5).forEach((t: string) => console.log(`   - ${t}`));

  if (!isDryRun) {
    await prisma.brand.update({
      where: { id: brand.id },
      data: {
        brandConfig: JSON.stringify(currentConfig, null, 2),
      },
    });
    console.log('✅ Synchronized brand-voice.md & 3 new wedges into brandConfig in Postgres DB');

    // 4. Trigger learnViralPatterns
    console.log('🔄 Re-synthesizing viralMemory from all high-performing ViralExample records...');
    const learnResult = await learnViralPatterns(brand.id);
    console.log(`✅ Learned ${learnResult.learnedPatterns} top patterns across ${learnResult.learnedExamples} examples`);
  } else {
    console.log('⚡ [DRY-RUN] Skipped database write.');
  }

  console.log('\n🎉 OMA Memory & Database synchronization routine completed!');
}

syncOmaMemory()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

