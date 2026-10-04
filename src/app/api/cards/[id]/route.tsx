import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parsePostForCard(content: string) {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  const hook = lines[0] || "운명과 타이밍의 법칙";

  // Look for A/B/C or bullet points
  const items: string[] = [];
  let sub = "";

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[▶\-\*•]?\s*[A-C]\./i.test(line) || /^[A-C]\s*[\:\.]/i.test(line)) {
      items.push(line.replace(/^[▶\-\*•]\s*/, ""));
    } else if (!sub && !line.includes("체크해봐") && !line.includes("어디에 가까워")) {
      sub = line;
    }
  }

  return { hook, sub, items: items.slice(0, 3) };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const post = await prisma.post.findUnique({
      where: { id },
      include: { brand: true },
    });

    if (!post) {
      return new Response("Post not found", { status: 404 });
    }

    const { hook, sub, items } = parsePostForCard(post.content);
    const brandName = post.brand.name || "CosmicPath";
    const topic = post.topic || "대운 & 커리어 타이밍";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundColor: "#0B0F19",
            backgroundImage:
              "radial-gradient(circle at 25% 15%, rgba(99, 102, 241, 0.22) 0%, transparent 50%), radial-gradient(circle at 80% 85%, rgba(168, 85, 247, 0.22) 0%, transparent 50%)",
            padding: "80px",
            color: "#F8FAFC",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 24px",
                background: "rgba(99, 102, 241, 0.25)",
                border: "1px solid rgba(99, 102, 241, 0.5)",
                borderRadius: "30px",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: "#38BDF8",
                }}
              />
              <span style={{ fontSize: "24px", fontWeight: "700", color: "#E0E7FF", letterSpacing: "1px" }}>
                {brandName.toUpperCase()} · {topic}
              </span>
            </div>
            <span style={{ fontSize: "24px", color: "#64748B", fontWeight: "600" }}>
              CRITICAL TIMING CHECK
            </span>
          </div>

          {/* Main Body */}
          <div style={{ display: "flex", flexDirection: "column", gap: "28px", margin: "40px 0" }}>
            <h1
              style={{
                fontSize: hook.length > 35 ? "50px" : "58px",
                fontWeight: "900",
                lineHeight: "1.25",
                color: "#FFFFFF",
                wordBreak: "keep-all",
                letterSpacing: "-0.5px",
              }}
            >
              {hook}
            </h1>

            {sub && (
              <p
                style={{
                  fontSize: "26px",
                  lineHeight: "1.5",
                  color: "#94A3B8",
                  maxWidth: "920px",
                  wordBreak: "keep-all",
                }}
              >
                {sub}
              </p>
            )}

            {/* Checklist / Options */}
            {items.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
                {items.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "20px 28px",
                      background: "rgba(30, 41, 59, 0.7)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "16px",
                      fontSize: "26px",
                      fontWeight: "600",
                      color: index === 0 ? "#F1F5F9" : "#CBD5E1",
                    }}
                  >
                    <span
                      style={{
                        color: index === 0 ? "#38BDF8" : index === 1 ? "#A855F7" : "#F59E0B",
                        fontWeight: "800",
                        marginRight: "16px",
                      }}
                    >
                      {item.slice(0, 3)}
                    </span>
                    <span>{item.slice(3).trim()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "2px solid rgba(255, 255, 255, 0.1)",
              paddingTop: "32px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "24px", color: "#38BDF8", fontWeight: "700" }}>💬</span>
              <span style={{ fontSize: "24px", color: "#94A3B8", fontWeight: "600" }}>
                당신의 상황을 댓글로 남겨주시면 솔루션을 짚어드립니다
              </span>
            </div>
            <span style={{ fontSize: "22px", color: "#64748B", fontWeight: "600" }}>
              www.cosmicpath.app
            </span>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1080,
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      }
    );
  } catch (error) {
    console.error("[Card Route Error]", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
