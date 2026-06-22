import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, dkLen: 64 };

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_PARAMS.dkLen,
      { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p },
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(`${salt}:${derivedKey.toString("hex")}`);
      }
    );
  });
  return hash;
}

async function main() {
  const apply = process.argv.includes("--apply");

  if (!apply) {
    console.log("Dry run mode. Run with --apply to seed the database.");
    console.log("Cookie: auth_session=ulw_qa_demo_assets_user");
    console.log("Brand: ulw_qa_demo_assets_brand_id");
    return;
  }

  const userId = "ulw_qa_demo_assets_user";
  const brandId = "ulw_qa_demo_assets_brand_id";
  const email = "ulw_qa_demo_assets_user@example.com";
  const slug = "ulw-qa-demo-assets";

  console.log(`Seeding user: ${email} (ID: ${userId})`);
  const passwordHash = await hashPassword("password123");

  await prisma.user.upsert({
    where: { id: userId },
    update: {
      email,
      password: passwordHash,
      name: "ULW QA User",
    },
    create: {
      id: userId,
      email,
      password: passwordHash,
      name: "ULW QA User",
    },
  });

  console.log(`Seeding brand: ${slug} (ID: ${brandId})`);
  await prisma.brand.upsert({
    where: { id: brandId },
    update: {
      name: "ULW QA Demo Assets Brand",
      slug,
      accessToken: "mock_access_token",
      threadsUserId: "mock_threads_user_id",
      tokenExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      ownerId: userId,
    },
    create: {
      id: brandId,
      name: "ULW QA Demo Assets Brand",
      slug,
      accessToken: "mock_access_token",
      threadsUserId: "mock_threads_user_id",
      tokenExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      ownerId: userId,
    },
  });

  console.log("Seeding completed successfully.");
  console.log("Cookie: auth_session=ulw_qa_demo_assets_user");
  console.log(`Brand: ${brandId}`);
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
