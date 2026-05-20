const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const THREADS_REFRESH_URL = "https://graph.threads.net/refresh_access_token";
const TOKEN_REFRESH_WINDOW_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysUntil(tokenExpiry) {
  return Math.ceil((tokenExpiry.getTime() - Date.now()) / MS_PER_DAY);
}

function shouldRefresh(tokenExpiry) {
  return tokenExpiry.getTime() <= Date.now() + TOKEN_REFRESH_WINDOW_DAYS * MS_PER_DAY;
}

function toExpiryDate(expiresIn) {
  return new Date(Date.now() + Number(expiresIn) * 1000);
}

async function refreshLongLivedToken(accessToken) {
  const params = new URLSearchParams({
    grant_type: "th_refresh_token",
    access_token: accessToken,
  });

  const response = await fetch(`${THREADS_REFRESH_URL}?${params}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message ?? "Unknown refresh error");
  }

  if (!data.access_token || !data.expires_in) {
    throw new Error("Refresh response did not include access_token and expires_in");
  }

  return {
    accessToken: data.access_token,
    tokenExpiry: toExpiryDate(data.expires_in),
  };
}

async function refreshSettingsToken(prismaClient) {
  const settings = await prismaClient.settings.findUnique({ where: { id: "default" } });

  if (!settings) {
    console.log("Legacy Settings token not found. Skipping.");
    return { checked: false, refreshed: false, failed: false };
  }

  if (!shouldRefresh(settings.tokenExpiry)) {
    console.log(`Legacy Settings token still valid for ${daysUntil(settings.tokenExpiry)} days.`);
    return { checked: true, refreshed: false, failed: false };
  }

  try {
    const refreshed = await refreshLongLivedToken(settings.accessToken);
    await prismaClient.settings.update({
      where: { id: "default" },
      data: refreshed,
    });
    console.log(`Legacy Settings token refreshed until ${refreshed.tokenExpiry.toISOString()}.`);
    return { checked: true, refreshed: true, failed: false };
  } catch (error) {
    console.error(`Legacy Settings token refresh failed: ${error.message}`);
    return { checked: true, refreshed: false, failed: true };
  }
}

async function refreshBrandTokens(prismaClient) {
  const brands = await prismaClient.brand.findMany({
    select: {
      id: true,
      slug: true,
      accessToken: true,
      tokenExpiry: true,
    },
    orderBy: { slug: "asc" },
  });

  const results = [];

  for (const brand of brands) {
    if (!shouldRefresh(brand.tokenExpiry)) {
      console.log(`${brand.slug} token still valid for ${daysUntil(brand.tokenExpiry)} days.`);
      results.push({ slug: brand.slug, refreshed: false, failed: false });
      continue;
    }

    try {
      const refreshed = await refreshLongLivedToken(brand.accessToken);
      await prismaClient.brand.update({
        where: { id: brand.id },
        data: refreshed,
      });
      console.log(`${brand.slug} token refreshed until ${refreshed.tokenExpiry.toISOString()}.`);
      results.push({ slug: brand.slug, refreshed: true, failed: false });
    } catch (error) {
      console.error(`${brand.slug} token refresh failed: ${error.message}`);
      results.push({ slug: brand.slug, refreshed: false, failed: true });
    }
  }

  return results;
}

async function refreshTokens({ prismaClient = prisma } = {}) {
  console.log(`Checking Threads tokens within ${TOKEN_REFRESH_WINDOW_DAYS} days of expiry...`);

  const settingsResult = await refreshSettingsToken(prismaClient);
  const brandResults = await refreshBrandTokens(prismaClient);
  const brandFailures = brandResults.filter((result) => result.failed);

  console.log(
    `Token refresh complete. settingsRefreshed=${settingsResult.refreshed} ` +
      `brandRefreshed=${brandResults.filter((result) => result.refreshed).length} ` +
      `brandFailures=${brandFailures.length}`
  );

  return {
    settingsFailed: settingsResult.failed,
    settingsRefreshed: settingsResult.refreshed,
    brandRefreshed: brandResults.filter((result) => result.refreshed).length,
    brandFailures: brandFailures.length,
  };
}

async function main() {
  const result = await refreshTokens();

  if (result.settingsFailed) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("Fatal token refresh error:", error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { refreshTokens };
