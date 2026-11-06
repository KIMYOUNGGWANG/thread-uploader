// Link cadence must count across requests: the dashboard generates in chunks of 2,
// so a per-request index alone never reaches "every 3rd post".

export const LINK_CTA = "링크 확인";

export function shouldLinkAt(input: { index: number; linkOffset: number; cadence: number }): boolean {
  const cadence = Math.max(1, input.cadence);
  return (input.linkOffset + input.index + 1) % cadence === 0;
}

// The link CTA is never forced. 2026-11-06 audit (cosmicpath, 60 days): "링크 확인" posts had a 43-view median, the
// lowest of every CTA, and linked posts 74 vs 122 unlinked. A linked post keeps its first-comment link and uses the
// same CTAs as any other post; a post without a link must not ask readers to "check the link" either.
export function coupleCtaToLink(ctaCandidates: string[], shouldLink: boolean): string[] {
  void shouldLink;
  const withoutLinkCta = ctaCandidates.filter((cta) => cta !== LINK_CTA);
  return withoutLinkCta.length > 0 ? withoutLinkCta : ctaCandidates;
}
