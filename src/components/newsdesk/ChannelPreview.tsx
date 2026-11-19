import type { NewsPlatform } from "@/lib/newsdesk/verify";

interface ChannelPreviewProps {
  platform: NewsPlatform;
  text: string;
  images: string[];
  handle: string | null;
  brandName: string;
}

/* eslint-disable @next/next/no-img-element -- previews of Blob images the operator just uploaded */

/** The draft as it will land in each channel's own frame, so the operator approves what readers will see. */
export function ChannelPreview({ platform, text, images, handle, brandName }: ChannelPreviewProps) {
  const body = text.trim() || "원고가 비어 있어";
  if (platform === "telegram") {
    return (
      <div className="rounded-lg bg-[#dfe7ee] p-3" aria-label="텔레그램 채널 미리보기">
        <div className="overflow-hidden rounded-xl bg-white">
          {images.length > 0 && (
            <div className={`grid gap-0.5 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {images.map((src, i) => (
                <img key={src} src={src} alt="" className={`w-full object-cover ${images.length === 1 ? "aspect-[4/3]" : "aspect-square"} ${images.length % 2 === 1 && i === 0 && images.length > 1 ? "col-span-2 aspect-[2/1]" : ""}`} />
              ))}
            </div>
          )}
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-[#168acd]">{handle ?? brandName}</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-900">{body}</p>
          </div>
        </div>
      </div>
    );
  }
  if (platform === "threads") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3" aria-label="Threads 미리보기">
        <div className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white" aria-hidden>
            {brandName.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">{brandName}</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-900">{body}</p>
            {images.length > 0 && (
              <div className="mt-2 flex gap-1.5 overflow-x-auto">
                {images.map((src) => <img key={src} src={src} alt="" className="h-32 w-auto shrink-0 rounded-md object-cover" />)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-[#b2c7da] p-3" aria-label="카카오톡 단톡방 미리보기">
      <div className="ml-auto flex max-w-[92%] flex-col items-end gap-1.5">
        {images.map((src) => <img key={src} src={src} alt="" className="w-40 rounded-lg object-cover" />)}
        <p className="whitespace-pre-wrap break-words rounded-xl rounded-tr-sm bg-[#fee500] px-3 py-2 text-sm leading-relaxed text-slate-900">{body}</p>
      </div>
    </div>
  );
}
