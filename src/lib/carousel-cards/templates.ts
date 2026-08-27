export interface CarouselSlideData {
  readonly archetype: CarouselArchetype;
  readonly title: string;
  readonly subtitle?: string;
  readonly highlightText?: string;
  readonly items?: readonly string[];
  readonly footerText?: string;
}

export type CarouselArchetype =
  | "QUESTION_COVER"
  | "BOLD_STAT"
  | "BEFORE_AFTER"
  | "PROBLEM_SOLUTION"
  | "QUOTE_MANIFESTO"
  | "CHECKLIST"
  | "MINIMAL_DATA"
  | "FRAMEWORK_DIAGRAM"
  | "TAKEAWAYS"
  | "CTA_SLIDE";

export interface CarouselThemeConfig {
  readonly primaryColor: string;
  readonly backgroundColor: string;
  readonly textColor: string;
  readonly accentColor: string;
  readonly fontFamily: string;
}

export const DEFAULT_CAROUSEL_THEME: CarouselThemeConfig = {
  primaryColor: "#6366f1", // Indigo-500
  backgroundColor: "#0f172a", // Slate-900
  textColor: "#f8fafc", // Slate-50
  accentColor: "#38bdf8", // Sky-400
  fontFamily: "sans-serif",
};

export interface ArchetypeDefinition {
  readonly id: CarouselArchetype;
  readonly name: string;
  readonly description: string;
}

export const CAROUSEL_ARCHETYPES: readonly ArchetypeDefinition[] = [
  {
    id: "QUESTION_COVER",
    name: "Curiosity Hook Cover",
    description: "High contrast curiosity question to drive slide swipes",
  },
  {
    id: "BOLD_STAT",
    name: "Bold Stat / Number",
    description: "Big stat callout with supporting insight",
  },
  {
    id: "BEFORE_AFTER",
    name: "Before vs After Split",
    description: "Comparison layout showing struggle vs transformation",
  },
  {
    id: "PROBLEM_SOLUTION",
    name: "Problem & Solution",
    description: "Pain point paired directly with your solution",
  },
  {
    id: "QUOTE_MANIFESTO",
    name: "Quote & Manifesto",
    description: "Bold opinion or thesis statement",
  },
  {
    id: "CHECKLIST",
    name: "Step-by-Step Checklist",
    description: "Actionable items with checkmark bullets",
  },
  {
    id: "MINIMAL_DATA",
    name: "Minimal Data / Code",
    description: "Monospaced data snippet or core formula",
  },
  {
    id: "FRAMEWORK_DIAGRAM",
    name: "3-Step Framework",
    description: "Visual 3-box process or pillar framework",
  },
  {
    id: "TAKEAWAYS",
    name: "Key Takeaways Summary",
    description: "Numbered bullet recap of core lessons",
  },
  {
    id: "CTA_SLIDE",
    name: "Action & CTA Outro",
    description: "Clear call to action, link prompt, and follow ask",
  },
];
