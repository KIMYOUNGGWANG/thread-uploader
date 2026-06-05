/**
 * add-advanced-creator-patterns.js
 *
 * 브랜드 설정에 PDF 기반 고급 creator 훅/CTA/공식 패턴팩을 병합한다.
 *
 * 실행:
 *   node scripts/add-advanced-creator-patterns.js --brand <slug> --dry-run
 *   node scripts/add-advanced-creator-patterns.js --brand <slug> --overwrite
 *   node scripts/add-advanced-creator-patterns.js --all --dry-run
 */

const fs = require("fs");
const path = require("path");

loadEnv();

const { PrismaClient } = require("@prisma/client");
const patternData = require("../src/data/advanced-creator-patterns.json");

const prisma = new PrismaClient();
const args = parseArgs(process.argv.slice(2));
const shouldDryRun = args["dry-run"] === true;
const shouldOverwrite = args.overwrite === true;

async function main() {
  const brands = await findTargetBrands(args);
  if (brands.length === 0) return;

  for (const brand of brands) {
    const config = JSON.parse(brand.brandConfig);
    const nextConfig = {
      ...config,
      hookTypes: mergeStrings(config.hookTypes, patternData.hooks.map((hook) => hook.label)),
      ctaTypes: mergeStrings(config.ctaTypes, patternData.ctas.map((cta) => cta.label)),
      formulas: mergeFormulas(config.formulas, patternData.formulas, shouldOverwrite),
    };

    const summary = buildSummary(config, nextConfig);
    console.log(`Brand: ${brand.name} (${brand.slug})`);
    console.log(`Hooks: ${summary.hooksBefore} -> ${summary.hooksAfter}`);
    console.log(`CTAs: ${summary.ctasBefore} -> ${summary.ctasAfter}`);
    console.log(`Formulas: ${summary.formulasBefore} -> ${summary.formulasAfter}`);

    if (shouldDryRun) {
      console.log("Dry run only. No database changes written.");
      continue;
    }

    await prisma.brand.update({
      where: { id: brand.id },
      data: { brandConfig: JSON.stringify(nextConfig) },
    });

    console.log("Advanced creator patterns applied.");
  }
}

async function findTargetBrands(parsedArgs) {
  if (parsedArgs.all === true) {
    return prisma.brand.findMany({ orderBy: { createdAt: "asc" } });
  }

  if (typeof parsedArgs.brand === "string" && parsedArgs.brand.trim()) {
    const brand = await prisma.brand.findFirst({ where: { slug: parsedArgs.brand.trim() } });
    if (brand) return [brand];
    console.error(`Brand not found: ${parsedArgs.brand}`);
    process.exit(1);
  }

  printUsage();
  process.exit(1);
}

function mergeStrings(existing, additions) {
  return Array.from(new Set([...(Array.isArray(existing) ? existing : []), ...additions]));
}

function mergeFormulas(existing, additions, overwrite) {
  const formulas = Array.isArray(existing) ? [...existing] : [];
  const indexById = new Map(formulas.map((formula, index) => [formula.id, index]));

  for (const formula of additions) {
    const index = indexById.get(formula.id);
    if (index === undefined) {
      indexById.set(formula.id, formulas.length);
      formulas.push(formula);
    } else if (overwrite) {
      formulas[index] = formula;
    }
  }

  return formulas;
}

function buildSummary(before, after) {
  return {
    hooksBefore: countItems(before.hookTypes),
    hooksAfter: countItems(after.hookTypes),
    ctasBefore: countItems(before.ctaTypes),
    ctasAfter: countItems(after.ctaTypes),
    formulasBefore: countItems(before.formulas),
    formulasAfter: countItems(after.formulas),
  };
}

function countItems(value) {
  return Array.isArray(value) ? value.length : 0;
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (!value.startsWith("--")) continue;

    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index++;
  }
  return parsed;
}

function printUsage() {
  console.error("Usage:");
  console.error("  node scripts/add-advanced-creator-patterns.js --brand <slug> [--dry-run] [--overwrite]");
  console.error("  node scripts/add-advanced-creator-patterns.js --all [--dry-run] [--overwrite]");
}

function loadEnv() {
  const root = path.resolve(__dirname, "..");
  for (const envFile of [".env.local", ".env"]) {
    const envPath = path.join(root, envFile);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
    return;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
