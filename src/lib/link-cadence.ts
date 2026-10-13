// Link cadence must count across requests: the dashboard generates in chunks of 2,
// so a per-request index alone never reaches "every 3rd post".

export const LINK_CTA = "링크 확인";

export function shouldLinkAt(input: { index: number; linkOffset: number; cadence: number }): boolean {
  const cadence = Math.max(1, input.cadence);
  return (input.linkOffset + input.index + 1) % cadence === 0;
}

// A post without a link must not ask readers to "check the link"; a linked post should.
export function coupleCtaToLink(ctaCandidates: string[], shouldLink: boolean): string[] {
  if (shouldLink) return [LINK_CTA];
  const withoutLinkCta = ctaCandidates.filter((cta) => cta !== LINK_CTA);
  return withoutLinkCta.length > 0 ? withoutLinkCta : ctaCandidates;
}
