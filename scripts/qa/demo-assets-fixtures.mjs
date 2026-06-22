import http from "http";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HTML_FIXTURES = {
  invoiceflow: `
    <html>
      <head>
        <title>InvoiceFlow Premium SaaS</title>
        <meta name="description" content="Reduce your invoice creation time to 5 minutes.">
      </head>
      <body>
        <main>
          <h1>InvoiceFlow</h1>
          <p>The ultimate invoicing tool for freelancers.</p>
        </main>
        <section class="pricing">
          <h2>Standard Plan</h2>
          <div>Price: $19/mo</div>
          <button>시작하기 (Free Trial)</button>
        </section>
        <footer>
          <a href="/login">로그인</a>
        </footer>
      </body>
    </html>
  `,
};

async function main() {
  const seedJobIndex = process.argv.indexOf("--seed-job");
  const jobKey = seedJobIndex !== -1 ? process.argv[seedJobIndex + 1] : null;

  // Start HTTP Server on random port
  const server = http.createServer((req, res) => {
    if (req.url === "/invoiceflow") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(HTML_FIXTURES.invoiceflow);
      return;
    }
    if (req.url === "/redirect-private") {
      res.writeHead(302, { Location: "http://10.0.0.1/private" });
      res.end();
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  const port = await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(server.address().port);
    });
  });

  console.log(`FIXTURE_PORT=${port}`);

  if (jobKey) {
    const brandId = "ulw_qa_demo_assets_brand_id";
    const productUrl = `http://127.0.0.1:${port}/${jobKey}`;

    const job = await prisma.demoAssetJob.create({
      data: {
        brandId,
        productUrl,
        style: "clean-product-demo",
        videoCount: 3,
        imageCount: 6,
        status: "QUEUED",
      },
    });

    console.log(`JOB_ID=${job.id}`);
  }

  // Keep server running unless closed manually or process exits
  process.on("SIGINT", () => {
    server.close(() => {
      prisma.$disconnect().then(() => {
        process.exit(0);
      });
    });
  });
}

main().catch((err) => {
  console.error("Fixture server failed:", err);
  process.exit(1);
});
