import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePostForSlide } from "@/lib/card-parser";
import { parseBrandConfig } from "@/types/brand";

const CACHE_CONTROL = "public, s-maxage=31536000, max-age=3600, stale-while-revalidate=86400";

function websiteHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Instagram's publishing API accepts JPEG images only, so carousel slides ask for ?format=jpg. */
async function toJpeg(png: Response): Promise<Response> {
  const sharp = (await import("sharp")).default;
  const jpeg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 90 }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    status: 200,
    headers: { "Content-Type": "image/jpeg", "Cache-Control": CACHE_CONTROL },
  });
}

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const slideParam = request.nextUrl.searchParams.get("slide");
  const slideIndex = Math.max(0, parseInt(slideParam || "0", 10) || 0);

  try {
    const post = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        content: true,
        topic: true,
        brand: {
          select: {
            name: true,
            slug: true,
            brandConfig: true,
          },
        },
      },
    });

    if (!post) {
      return new Response("Post not found", { status: 404 });
    }

    const { hook, sub, items, totalSlides, isCarouselDetail, oracleTag } = parsePostForSlide(post.content, slideIndex);
    const brandName = post.brand?.name || "CosmicPath";
    const topic = post.topic || "대운 & 커리어 타이밍";
    const displayHeader = oracleTag ? `${oracleTag.toUpperCase()} · ${topic}` : `${brandName.toUpperCase()} · ${topic}`;
    const slideTag = totalSlides && totalSlides > 1 ? `${slideIndex + 1} / ${totalSlides}` : "";
    const site = post.brand ? websiteHost(parseBrandConfig(post.brand.brandConfig).websiteUrl) : null;
    const footerNote = totalSlides && totalSlides > 1 && slideIndex === 0 ? "넘겨서 보기 →" : brandName;

    const image = new ImageResponse(
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
                {displayHeader}
              </span>
            </div>
            <span style={{ fontSize: "24px", color: isCarouselDetail ? "#38BDF8" : "#64748B", fontWeight: "700" }}>
              {slideTag}
            </span>
          </div>

          {/* Main Body */}
          <div style={{ display: "flex", flexDirection: "column", gap: "28px", margin: "40px 0" }}>
            <h1
              style={{
                fontSize: hook.length > 35 ? "48px" : "58px",
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
                  fontSize: isCarouselDetail ? "32px" : "26px",
                  lineHeight: "1.5",
                  color: isCarouselDetail ? "#E2E8F0" : "#94A3B8",
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
              <span style={{ fontSize: "24px", color: "#94A3B8", fontWeight: "600" }}>
                {footerNote}
              </span>
            </div>
            <span style={{ fontSize: "22px", color: "#64748B", fontWeight: "600" }}>
              {site ?? ""}
            </span>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1080,
        headers: {
          "Cache-Control": CACHE_CONTROL,
        },
      }
    );
    return request.nextUrl.searchParams.get("format") === "jpg" ? await toJpeg(image) : image;
  } catch (error) {
    console.error("[Card Route Error]", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
