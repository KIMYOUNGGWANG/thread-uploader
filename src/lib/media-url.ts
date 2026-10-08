// Shared by server publishing and client previews: a post's media list may hold one .mp4 video.
export function isVideoMediaUrl(url: string): boolean {
  return /\.mp4(\?|#|$)/i.test(url);
}
