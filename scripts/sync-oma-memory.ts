import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import { learnViralPatterns } from '../src/lib/viral-service';

async function syncOmaMemory() {
  console.log('🔄 Starting OMA Memory ↔ PostgreSQL Database Synchronization...');

  // 1. Read .agents/memory/brand-voice.md
  const brandVoicePath = path.join(process.cwd(), '.agents/memory/brand-voice.md');
  if (!fs.existsSync(brandVoicePath)) {
    throw new Error(`brand-voice.md not found at: ${brandVoicePath}`);
  }
  const brandVoiceContent = fs.readFileSync(brandVoicePath, 'utf-8');
  console.log(`✅ Loaded .agents/memory/brand-voice.md (${brandVoiceContent.length} bytes)`);

  // 2. Fetch CosmicPath brand
  const brand = await prisma.brand.findFirst({ where: { slug: 'cosmicpath' } });
  if (!brand) {
    throw new Error('CosmicPath brand not found in database');
  }

  // 3. Update brandConfig.systemPrompt
  const currentConfig = JSON.parse(brand.brandConfig || '{}');
  currentConfig.systemPrompt = brandVoiceContent;

  await prisma.brand.update({
    where: { id: brand.id },
    data: {
      brandConfig: JSON.stringify(currentConfig, null, 2),
    },
  });
  console.log('✅ Synchronized brand-voice.md into brandConfig.systemPrompt in Postgres DB');

  // 4. Trigger learnViralPatterns to sync 30만/12만 hits into viralMemory
  console.log('🔄 Re-synthesizing viralMemory from all high-performing ViralExample records...');
  const learnResult = await learnViralPatterns(brand.id);
  console.log(`✅ Learned ${learnResult.learnedPatterns} top patterns across ${learnResult.learnedExamples} examples`);

  const updatedBrand = await prisma.brand.findUnique({
    where: { id: brand.id },
    select: { viralMemory: true },
  });
  const mem = JSON.parse(updatedBrand?.viralMemory || '{}');
  console.log('\n=== CURRENT ACTIVE TOP PATTERNS IN DB ===');
  for (const p of mem.topPatterns?.slice(0, 5) || []) {
    console.log(`- [${p.dimension}] ${p.value} (Score: ${p.avgViralScore})`);
  }

  console.log('\n🎉 OMA Memory & Database 100% Synchronized successfully!');
}

syncOmaMemory()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
