#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Design System Generator - Aggregates search results and applies reasoning
to generate comprehensive design system recommendations.

Usage:
    from design_system import generate_design_system
    result = generate_design_system("SaaS dashboard", "My Project")
"""

import csv
import json
from pathlib import Path
from core import search, DATA_DIR


# ============ CONFIGURATION ============
REASONING_FILE = "ui-reasoning.csv"

SEARCH_CONFIG = {
    "product": {"max_results": 1},
    "style": {"max_results": 3},
    "color": {"max_results": 2},
    "landing": {"max_results": 2},
    "typography": {"max_results": 2}
}

ANTI_GENERIC_GUARDRAILS = [
    "Do not default to centered SaaS hero + three equal cards + generic CTA.",
    "Do not use Inter/Roboto/Arial for both heading and body unless constraints require it.",
    "Do not lean on purple-pink AI gradients unless the brand already owns that palette.",
    "Do not keep every section on the same width, radius, shadow, and spacing rhythm.",
    "Do not describe premium treatment without adding concrete visual implementation."
]

SIGNATURE_MOVES = [
    "Add one typography contrast move: expressive heading family + calmer body family.",
    "Add one composition break: oversized media, offset split, or asymmetric module.",
    "Add one material cue: tinted shadow, grain, framed surface, frosted panel, or metallic edge.",
    "Add one motion identity: stagger, spring, cinematic scroll, or deliberate stillness.",
    "Add one brand accent system: badges, icon containers, underlines, or illustration language."
]

KOREAN_UI_RULES = [
    "If the interface is in Korean, prefer a Korean-friendly font pairing over generic defaults.",
    "Use word-break: keep-all for long Korean copy blocks when appropriate.",
    "Write natural Korean copy, not translated SaaS filler language."
]

OUTPUT_BANNED_PATTERNS = [
    "Do not output only the hero when a full page was requested.",
    "Do not use placeholder copy, lorem ipsum, or vague filler lines.",
    "Do not write 'the rest follows the same pattern' or similar shortcuts.",
    "Do not leave TODO blocks, skeleton sections, or empty cards in the final output.",
    "Do not promise premium treatment in prose without shipping the full code."
]

PAGE_COMPLETENESS = {
    "landing": [
        "head/meta + font loading + global tokens",
        "navigation",
        "hero",
        "trust or social proof",
        "features or value sections",
        "primary CTA",
        "footer"
    ],
    "marketing": [
        "head/meta + font loading + global tokens",
        "navigation",
        "hero",
        "proof or differentiation",
        "feature/story sections",
        "CTA",
        "footer"
    ],
    "dashboard": [
        "head/meta + app shell tokens",
        "page header with clear hierarchy",
        "primary KPI or overview block",
        "main working surface",
        "supporting detail modules",
        "empty/loading/error states",
        "responsive/mobile behavior"
    ],
    "app": [
        "head/meta + app tokens",
        "primary navigation",
        "top-level page header",
        "main task surface",
        "feedback states",
        "empty/loading/error states",
        "responsive/mobile behavior"
    ]
}


# ============ DESIGN SYSTEM GENERATOR ============
class DesignSystemGenerator:
    """Generates design system recommendations from aggregated searches."""

    def __init__(self):
        self.reasoning_data = self._load_reasoning()

    def _load_reasoning(self) -> list:
        """Load reasoning rules from CSV."""
        filepath = DATA_DIR / REASONING_FILE
        if not filepath.exists():
            return []
        with open(filepath, 'r', encoding='utf-8') as f:
            return list(csv.DictReader(f))

    def _multi_domain_search(self, query: str, style_priority: list = None) -> dict:
        """Execute searches across multiple domains."""
        results = {}
        for domain, config in SEARCH_CONFIG.items():
            if domain == "style" and style_priority:
                # For style, also search with priority keywords
                priority_query = " ".join(style_priority[:2]) if style_priority else query
                combined_query = f"{query} {priority_query}"
                results[domain] = search(combined_query, domain, config["max_results"])
            else:
                results[domain] = search(query, domain, config["max_results"])
        return results

    def _find_reasoning_rule(self, category: str) -> dict:
        """Find matching reasoning rule for a category."""
        category_lower = category.lower()

        # Try exact match first
        for rule in self.reasoning_data:
            if rule.get("UI_Category", "").lower() == category_lower:
                return rule

        # Try partial match
        for rule in self.reasoning_data:
            ui_cat = rule.get("UI_Category", "").lower()
            if ui_cat in category_lower or category_lower in ui_cat:
                return rule

        # Try keyword match
        for rule in self.reasoning_data:
            ui_cat = rule.get("UI_Category", "").lower()
            keywords = ui_cat.replace("/", " ").replace("-", " ").split()
            if any(kw in category_lower for kw in keywords):
                return rule

        return {}

    def _apply_reasoning(self, category: str, search_results: dict) -> dict:
        """Apply reasoning rules to search results."""
        rule = self._find_reasoning_rule(category)

        if not rule:
            return {
                "pattern": "Hero + Features + CTA",
                "style_priority": ["Minimalism", "Flat Design"],
                "color_mood": "Professional",
                "typography_mood": "Clean",
                "key_effects": "Subtle hover transitions",
                "anti_patterns": "",
                "decision_rules": {},
                "severity": "MEDIUM"
            }

        # Parse decision rules JSON
        decision_rules = {}
        try:
            decision_rules = json.loads(rule.get("Decision_Rules", "{}"))
        except json.JSONDecodeError:
            pass

        return {
            "pattern": rule.get("Recommended_Pattern", ""),
            "style_priority": [s.strip() for s in rule.get("Style_Priority", "").split("+")],
            "color_mood": rule.get("Color_Mood", ""),
            "typography_mood": rule.get("Typography_Mood", ""),
            "key_effects": rule.get("Key_Effects", ""),
            "anti_patterns": rule.get("Anti_Patterns", ""),
            "decision_rules": decision_rules,
            "severity": rule.get("Severity", "MEDIUM")
        }

    def _select_best_match(self, results: list, priority_keywords: list) -> dict:
        """Select best matching result based on priority keywords."""
        if not results:
            return {}

        if not priority_keywords:
            return results[0]

        # First: try exact style name match
        for priority in priority_keywords:
            priority_lower = priority.lower().strip()
            for result in results:
                style_name = result.get("Style Category", "").lower()
                if priority_lower in style_name or style_name in priority_lower:
                    return result

        # Second: score by keyword match in all fields
        scored = []
        for result in results:
            result_str = str(result).lower()
            score = 0
            for kw in priority_keywords:
                kw_lower = kw.lower().strip()
                # Higher score for style name match
                if kw_lower in result.get("Style Category", "").lower():
                    score += 10
                # Lower score for keyword field match
                elif kw_lower in result.get("Keywords", "").lower():
                    score += 3
                # Even lower for other field matches
                elif kw_lower in result_str:
                    score += 1
            scored.append((score, result))

        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1] if scored and scored[0][0] > 0 else results[0]

    def _extract_results(self, search_result: dict) -> list:
        """Extract results list from search result dict."""
        return search_result.get("results", [])

    def _select_typography(self, query: str, typography_results: list) -> dict:
        """Prefer typography pairings with clearer personality when the default is too generic."""
        if not typography_results:
            return {}

        best_typography = typography_results[0]
        query_lower = query.lower()
        heading = best_typography.get("Heading Font", "").strip().lower()
        body = best_typography.get("Body Font", "").strip().lower()

        if "korean" in query_lower and heading and heading == body:
            for result in typography_results:
                result_heading = result.get("Heading Font", "").strip().lower()
                result_body = result.get("Body Font", "").strip().lower()
                if result_heading and result_body and result_heading != result_body:
                    return result

            premium_korean_results = search("korean premium editorial brand", "typography", 5)
            for result in premium_korean_results.get("results", []):
                result_heading = result.get("Heading Font", "").strip().lower()
                result_body = result.get("Body Font", "").strip().lower()
                if result_heading and result_body and result_heading != result_body:
                    return result

        return best_typography

    def generate(self, query: str, project_name: str = None) -> dict:
        """Generate complete design system recommendation."""
        # Step 1: First search product to get category
        product_result = search(query, "product", 1)
        product_results = product_result.get("results", [])
        category = "General"
        if product_results:
            category = product_results[0].get("Product Type", "General")

        # Step 2: Get reasoning rules for this category
        reasoning = self._apply_reasoning(category, {})
        style_priority = reasoning.get("style_priority", [])

        # Step 3: Multi-domain search with style priority hints
        search_results = self._multi_domain_search(query, style_priority)
        search_results["product"] = product_result  # Reuse product search

        # Step 4: Select best matches from each domain using priority
        style_results = self._extract_results(search_results.get("style", {}))
        color_results = self._extract_results(search_results.get("color", {}))
        typography_results = self._extract_results(search_results.get("typography", {}))
        landing_results = self._extract_results(search_results.get("landing", {}))

        best_style = self._select_best_match(style_results, reasoning.get("style_priority", []))
        best_color = color_results[0] if color_results else {}
        best_typography = self._select_typography(query, typography_results)
        best_landing = landing_results[0] if landing_results else {}

        # Step 5: Build final recommendation
        # Combine effects from both reasoning and style search
        style_effects = best_style.get("Effects & Animation", "")
        reasoning_effects = reasoning.get("key_effects", "")
        combined_effects = style_effects if style_effects else reasoning_effects

        return {
            "project_name": project_name or query.upper(),
            "category": category,
            "pattern": {
                "name": best_landing.get("Pattern Name", reasoning.get("pattern", "Hero + Features + CTA")),
                "sections": best_landing.get("Section Order", "Hero > Features > CTA"),
                "cta_placement": best_landing.get("Primary CTA Placement", "Above fold"),
                "color_strategy": best_landing.get("Color Strategy", ""),
                "conversion": best_landing.get("Conversion Optimization", "")
            },
            "style": {
                "name": best_style.get("Style Category", "Minimalism"),
                "type": best_style.get("Type", "General"),
                "effects": style_effects,
                "keywords": best_style.get("Keywords", ""),
                "best_for": best_style.get("Best For", ""),
                "performance": best_style.get("Performance", ""),
                "accessibility": best_style.get("Accessibility", "")
            },
            "colors": {
                "primary": best_color.get("Primary (Hex)", "#2563EB"),
                "secondary": best_color.get("Secondary (Hex)", "#3B82F6"),
                "cta": best_color.get("CTA (Hex)", "#F97316"),
                "background": best_color.get("Background (Hex)", "#F8FAFC"),
                "text": best_color.get("Text (Hex)", "#1E293B"),
                "notes": best_color.get("Notes", "")
            },
            "typography": {
                "heading": best_typography.get("Heading Font", "Inter"),
                "body": best_typography.get("Body Font", "Inter"),
                "mood": best_typography.get("Mood/Style Keywords", reasoning.get("typography_mood", "")),
                "best_for": best_typography.get("Best For", ""),
                "google_fonts_url": best_typography.get("Google Fonts URL", ""),
                "css_import": best_typography.get("CSS Import", "")
            },
            "key_effects": combined_effects,
            "anti_patterns": reasoning.get("anti_patterns", ""),
            "anti_generic_guardrails": ANTI_GENERIC_GUARDRAILS,
            "signature_moves": SIGNATURE_MOVES,
            "korean_ui_rules": KOREAN_UI_RULES,
            "decision_rules": reasoning.get("decision_rules", {}),
            "severity": reasoning.get("severity", "MEDIUM")
        }

    def generate_redesign_audit(self, query: str, project_name: str = None) -> dict:
        """Generate a redesign-first audit focused on removing generic AI output."""
        design_system = self.generate(query, project_name)
        pattern = design_system.get("pattern", {})
        style = design_system.get("style", {})
        typography = design_system.get("typography", {})
        colors = design_system.get("colors", {})
        heading = typography.get("heading", "")
        body = typography.get("body", "")

        fix_first = []
        if heading and body and heading == body:
            fix_first.append(
                f"Typography is too safe. Replace the single-font feel with a clearer heading/body contrast instead of staying on {heading} everywhere."
            )
        else:
            fix_first.append(
                f"Lean harder into the type contrast between {heading or 'the heading font'} and {body or 'the body font'} so the page has a recognisable voice."
            )

        if colors.get("primary") in {"#3B82F6", "#2563EB"} or colors.get("secondary") in {"#60A5FA", "#3B82F6"}:
            fix_first.append(
                "The palette risks reading as generic SaaS blue. Add a stronger material system, supporting neutral, or domain-specific accent before adding more gradients."
            )
        else:
            fix_first.append(
                "Keep the palette, but make it feel owned through surface treatment, contrast discipline, and repeated brand accents."
            )

        fix_first.append(
            "Break the repeated section rhythm. Add one oversized, offset, or asymmetric module so the page stops feeling template-generated."
        )

        preserve = [
            f"Preserve the core narrative shape from {pattern.get('name', 'the current pattern')} if it already supports the product story.",
            f"Preserve the strongest directional cue from {style.get('name', 'the selected style')} instead of mixing multiple unrelated aesthetics.",
            "Preserve clarity and accessibility while increasing visual character."
        ]

        upgrade_moves = [
            f"Typography move: build the hero and section headings around {heading or 'a more expressive display face'}, then let {body or 'a quieter body face'} carry dense copy.",
            "Composition move: introduce one non-uniform section with different column balance, media scale, or card span.",
            "Material move: give backgrounds and surfaces a deliberate identity through grain, tint, border logic, frosted layering, or editorial whitespace.",
            "Copy move: replace generic claims with concrete product language, numbers, proof, or category-specific terms."
        ]

        return {
            "project_name": design_system.get("project_name", project_name or query.upper()),
            "style_name": style.get("name", ""),
            "pattern_name": pattern.get("name", ""),
            "preserve": preserve,
            "fix_first": fix_first[:3],
            "upgrade_moves": upgrade_moves,
            "signature_moves": design_system.get("signature_moves", []),
            "anti_generic_guardrails": design_system.get("anti_generic_guardrails", []),
            "output_banned_patterns": OUTPUT_BANNED_PATTERNS
        }


# ============ OUTPUT FORMATTERS ============
BOX_WIDTH = 90  # Wider box for more content

def format_ascii_box(design_system: dict) -> str:
    """Format design system as ASCII box with emojis (MCP-style)."""
    project = design_system.get("project_name", "PROJECT")
    pattern = design_system.get("pattern", {})
    style = design_system.get("style", {})
    colors = design_system.get("colors", {})
    typography = design_system.get("typography", {})
    effects = design_system.get("key_effects", "")
    anti_patterns = design_system.get("anti_patterns", "")
    anti_generic_guardrails = design_system.get("anti_generic_guardrails", [])
    signature_moves = design_system.get("signature_moves", [])
    korean_ui_rules = design_system.get("korean_ui_rules", [])

    def wrap_text(text: str, prefix: str, width: int) -> list:
        """Wrap long text into multiple lines."""
        if not text:
            return []
        words = text.split()
        lines = []
        current_line = prefix
        for word in words:
            if len(current_line) + len(word) + 1 <= width - 2:
                current_line += (" " if current_line != prefix else "") + word
            else:
                if current_line != prefix:
                    lines.append(current_line)
                current_line = prefix + word
        if current_line != prefix:
            lines.append(current_line)
        return lines

    # Build sections from pattern
    sections = pattern.get("sections", "").split(">")
    sections = [s.strip() for s in sections if s.strip()]

    # Build output lines
    lines = []
    w = BOX_WIDTH - 1

    lines.append("+" + "-" * w + "+")
    lines.append(f"|  TARGET: {project} - RECOMMENDED DESIGN SYSTEM".ljust(BOX_WIDTH) + "|")
    lines.append("+" + "-" * w + "+")
    lines.append("|" + " " * BOX_WIDTH + "|")

    # Pattern section
    lines.append(f"|  PATTERN: {pattern.get('name', '')}".ljust(BOX_WIDTH) + "|")
    if pattern.get('conversion'):
        lines.append(f"|     Conversion: {pattern.get('conversion', '')}".ljust(BOX_WIDTH) + "|")
    if pattern.get('cta_placement'):
        lines.append(f"|     CTA: {pattern.get('cta_placement', '')}".ljust(BOX_WIDTH) + "|")
    lines.append("|     Sections:".ljust(BOX_WIDTH) + "|")
    for i, section in enumerate(sections, 1):
        lines.append(f"|       {i}. {section}".ljust(BOX_WIDTH) + "|")
    lines.append("|" + " " * BOX_WIDTH + "|")

    # Style section
    lines.append(f"|  STYLE: {style.get('name', '')}".ljust(BOX_WIDTH) + "|")
    if style.get("keywords"):
        for line in wrap_text(f"Keywords: {style.get('keywords', '')}", "|     ", BOX_WIDTH):
            lines.append(line.ljust(BOX_WIDTH) + "|")
    if style.get("best_for"):
        for line in wrap_text(f"Best For: {style.get('best_for', '')}", "|     ", BOX_WIDTH):
            lines.append(line.ljust(BOX_WIDTH) + "|")
    if style.get("performance") or style.get("accessibility"):
        perf_a11y = f"Performance: {style.get('performance', '')} | Accessibility: {style.get('accessibility', '')}"
        lines.append(f"|     {perf_a11y}".ljust(BOX_WIDTH) + "|")
    lines.append("|" + " " * BOX_WIDTH + "|")

    # Colors section
    lines.append("|  COLORS:".ljust(BOX_WIDTH) + "|")
    lines.append(f"|     Primary:    {colors.get('primary', '')}".ljust(BOX_WIDTH) + "|")
    lines.append(f"|     Secondary:  {colors.get('secondary', '')}".ljust(BOX_WIDTH) + "|")
    lines.append(f"|     CTA:        {colors.get('cta', '')}".ljust(BOX_WIDTH) + "|")
    lines.append(f"|     Background: {colors.get('background', '')}".ljust(BOX_WIDTH) + "|")
    lines.append(f"|     Text:       {colors.get('text', '')}".ljust(BOX_WIDTH) + "|")
    if colors.get("notes"):
        for line in wrap_text(f"Notes: {colors.get('notes', '')}", "|     ", BOX_WIDTH):
            lines.append(line.ljust(BOX_WIDTH) + "|")
    lines.append("|" + " " * BOX_WIDTH + "|")

    # Typography section
    lines.append(f"|  TYPOGRAPHY: {typography.get('heading', '')} / {typography.get('body', '')}".ljust(BOX_WIDTH) + "|")
    if typography.get("mood"):
        for line in wrap_text(f"Mood: {typography.get('mood', '')}", "|     ", BOX_WIDTH):
            lines.append(line.ljust(BOX_WIDTH) + "|")
    if typography.get("best_for"):
        for line in wrap_text(f"Best For: {typography.get('best_for', '')}", "|     ", BOX_WIDTH):
            lines.append(line.ljust(BOX_WIDTH) + "|")
    if typography.get("google_fonts_url"):
        lines.append(f"|     Google Fonts: {typography.get('google_fonts_url', '')}".ljust(BOX_WIDTH) + "|")
    if typography.get("css_import"):
        lines.append(f"|     CSS Import: {typography.get('css_import', '')[:70]}...".ljust(BOX_WIDTH) + "|")
    lines.append("|" + " " * BOX_WIDTH + "|")

    # Key Effects section
    if effects:
        lines.append("|  KEY EFFECTS:".ljust(BOX_WIDTH) + "|")
        for line in wrap_text(effects, "|     ", BOX_WIDTH):
            lines.append(line.ljust(BOX_WIDTH) + "|")
        lines.append("|" + " " * BOX_WIDTH + "|")

    # Anti-patterns section
    if anti_patterns:
        lines.append("|  AVOID (Anti-patterns):".ljust(BOX_WIDTH) + "|")
        for line in wrap_text(anti_patterns, "|     ", BOX_WIDTH):
            lines.append(line.ljust(BOX_WIDTH) + "|")
        lines.append("|" + " " * BOX_WIDTH + "|")

    if anti_generic_guardrails:
        lines.append("|  ANTI-GENERIC GUARDRAILS:".ljust(BOX_WIDTH) + "|")
        for item in anti_generic_guardrails:
            for line in wrap_text(item, "|     - ", BOX_WIDTH):
                lines.append(line.ljust(BOX_WIDTH) + "|")
        lines.append("|" + " " * BOX_WIDTH + "|")

    if signature_moves:
        lines.append("|  SIGNATURE MOVES:".ljust(BOX_WIDTH) + "|")
        for item in signature_moves:
            for line in wrap_text(item, "|     - ", BOX_WIDTH):
                lines.append(line.ljust(BOX_WIDTH) + "|")
        lines.append("|" + " " * BOX_WIDTH + "|")

    if korean_ui_rules:
        lines.append("|  KOREAN UI RULES:".ljust(BOX_WIDTH) + "|")
        for item in korean_ui_rules:
            for line in wrap_text(item, "|     - ", BOX_WIDTH):
                lines.append(line.ljust(BOX_WIDTH) + "|")
        lines.append("|" + " " * BOX_WIDTH + "|")

    # Pre-Delivery Checklist section
    lines.append("|  PRE-DELIVERY CHECKLIST:".ljust(BOX_WIDTH) + "|")
    checklist_items = [
        "[ ] No emojis as icons (use SVG: Heroicons/Lucide)",
        "[ ] One signature visual move exists beyond color and border-radius",
        "[ ] Typography is intentional, not default-safe by habit",
        "[ ] Section rhythm varies at least once through scale or asymmetry",
        "[ ] Background treatment feels deliberate, not flat by accident",
        "[ ] No generic AI startup gradients unless brand-fit",
        "[ ] Copy uses concrete product language, not vague marketing filler",
        "[ ] cursor-pointer on all clickable elements",
        "[ ] Hover states with smooth transitions (150-300ms)",
        "[ ] Light mode: text contrast 4.5:1 minimum",
        "[ ] Focus states visible for keyboard nav",
        "[ ] prefers-reduced-motion respected",
        "[ ] Responsive: 375px, 768px, 1024px, 1440px"
    ]
    for item in checklist_items:
        lines.append(f"|     {item}".ljust(BOX_WIDTH) + "|")
    lines.append("|" + " " * BOX_WIDTH + "|")

    lines.append("+" + "-" * w + "+")

    return "\n".join(lines)


def format_markdown(design_system: dict) -> str:
    """Format design system as markdown."""
    project = design_system.get("project_name", "PROJECT")
    pattern = design_system.get("pattern", {})
    style = design_system.get("style", {})
    colors = design_system.get("colors", {})
    typography = design_system.get("typography", {})
    effects = design_system.get("key_effects", "")
    anti_patterns = design_system.get("anti_patterns", "")
    anti_generic_guardrails = design_system.get("anti_generic_guardrails", [])
    signature_moves = design_system.get("signature_moves", [])
    korean_ui_rules = design_system.get("korean_ui_rules", [])

    lines = []
    lines.append(f"## Design System: {project}")
    lines.append("")

    # Pattern section
    lines.append("### Pattern")
    lines.append(f"- **Name:** {pattern.get('name', '')}")
    if pattern.get('conversion'):
        lines.append(f"- **Conversion Focus:** {pattern.get('conversion', '')}")
    if pattern.get('cta_placement'):
        lines.append(f"- **CTA Placement:** {pattern.get('cta_placement', '')}")
    if pattern.get('color_strategy'):
        lines.append(f"- **Color Strategy:** {pattern.get('color_strategy', '')}")
    lines.append(f"- **Sections:** {pattern.get('sections', '')}")
    lines.append("")

    # Style section
    lines.append("### Style")
    lines.append(f"- **Name:** {style.get('name', '')}")
    if style.get('keywords'):
        lines.append(f"- **Keywords:** {style.get('keywords', '')}")
    if style.get('best_for'):
        lines.append(f"- **Best For:** {style.get('best_for', '')}")
    if style.get('performance') or style.get('accessibility'):
        lines.append(f"- **Performance:** {style.get('performance', '')} | **Accessibility:** {style.get('accessibility', '')}")
    lines.append("")

    # Colors section
    lines.append("### Colors")
    lines.append(f"| Role | Hex |")
    lines.append(f"|------|-----|")
    lines.append(f"| Primary | {colors.get('primary', '')} |")
    lines.append(f"| Secondary | {colors.get('secondary', '')} |")
    lines.append(f"| CTA | {colors.get('cta', '')} |")
    lines.append(f"| Background | {colors.get('background', '')} |")
    lines.append(f"| Text | {colors.get('text', '')} |")
    if colors.get("notes"):
        lines.append(f"\n*Notes: {colors.get('notes', '')}*")
    lines.append("")

    # Typography section
    lines.append("### Typography")
    lines.append(f"- **Heading:** {typography.get('heading', '')}")
    lines.append(f"- **Body:** {typography.get('body', '')}")
    if typography.get("mood"):
        lines.append(f"- **Mood:** {typography.get('mood', '')}")
    if typography.get("best_for"):
        lines.append(f"- **Best For:** {typography.get('best_for', '')}")
    if typography.get("google_fonts_url"):
        lines.append(f"- **Google Fonts:** {typography.get('google_fonts_url', '')}")
    if typography.get("css_import"):
        lines.append(f"- **CSS Import:**")
        lines.append(f"```css")
        lines.append(f"{typography.get('css_import', '')}")
        lines.append(f"```")
    lines.append("")

    # Key Effects section
    if effects:
        lines.append("### Key Effects")
        lines.append(f"{effects}")
        lines.append("")

    # Anti-patterns section
    if anti_patterns:
        lines.append("### Avoid (Anti-patterns)")
        lines.append(f"- {anti_patterns.replace(' + ', '\n- ')}")
        lines.append("")

    if anti_generic_guardrails:
        lines.append("### Anti-Generic Guardrails")
        for item in anti_generic_guardrails:
            lines.append(f"- {item}")
        lines.append("")

    if signature_moves:
        lines.append("### Signature Moves")
        for item in signature_moves:
            lines.append(f"- {item}")
        lines.append("")

    if korean_ui_rules:
        lines.append("### Korean UI Rules")
        for item in korean_ui_rules:
            lines.append(f"- {item}")
        lines.append("")

    # Pre-Delivery Checklist section
    lines.append("### Pre-Delivery Checklist")
    lines.append("- [ ] No emojis as icons (use SVG: Heroicons/Lucide)")
    lines.append("- [ ] One signature visual move exists beyond color and border-radius")
    lines.append("- [ ] Typography is intentional, not default-safe by habit")
    lines.append("- [ ] Section rhythm varies at least once through scale or asymmetry")
    lines.append("- [ ] Background treatment feels deliberate, not flat by accident")
    lines.append("- [ ] No generic AI startup gradients unless brand-fit")
    lines.append("- [ ] Copy uses concrete product language, not vague marketing filler")
    lines.append("- [ ] cursor-pointer on all clickable elements")
    lines.append("- [ ] Hover states with smooth transitions (150-300ms)")
    lines.append("- [ ] Light mode: text contrast 4.5:1 minimum")
    lines.append("- [ ] Focus states visible for keyboard nav")
    lines.append("- [ ] prefers-reduced-motion respected")
    lines.append("- [ ] Responsive: 375px, 768px, 1024px, 1440px")
    lines.append("")

    return "\n".join(lines)


def format_redesign_markdown(audit: dict) -> str:
    """Format redesign audit as markdown."""
    lines = []
    lines.append(f"## Redesign Audit: {audit.get('project_name', 'PROJECT')}")
    lines.append("")

    if audit.get("pattern_name") or audit.get("style_name"):
        lines.append("### Current Direction")
        if audit.get("pattern_name"):
            lines.append(f"- **Pattern:** {audit.get('pattern_name', '')}")
        if audit.get("style_name"):
            lines.append(f"- **Style:** {audit.get('style_name', '')}")
        lines.append("")

    lines.append("### Preserve")
    for item in audit.get("preserve", []):
        lines.append(f"- {item}")
    lines.append("")

    lines.append("### Fix First")
    for item in audit.get("fix_first", []):
        lines.append(f"- {item}")
    lines.append("")

    lines.append("### Upgrade Moves")
    for item in audit.get("upgrade_moves", []):
        lines.append(f"- {item}")
    lines.append("")

    lines.append("### Anti-Generic Guardrails")
    for item in audit.get("anti_generic_guardrails", []):
        lines.append(f"- {item}")
    lines.append("")

    lines.append("### Output Bans")
    for item in audit.get("output_banned_patterns", []):
        lines.append(f"- {item}")
    lines.append("")

    return "\n".join(lines)


def generate_output_guard(page_type: str = "landing", output_format: str = "markdown") -> str:
    """Generate completeness rules for full-page delivery."""
    normalized_page_type = page_type.lower().strip()
    required_sections = PAGE_COMPLETENESS.get(normalized_page_type, PAGE_COMPLETENESS["landing"])

    lines = []
    lines.append(f"## Full Output Guard: {normalized_page_type.title()}")
    lines.append("")
    lines.append("### Required Sections")
    for item in required_sections:
        lines.append(f"- {item}")
    lines.append("")
    lines.append("### Banned Patterns")
    for item in OUTPUT_BANNED_PATTERNS:
        lines.append(f"- {item}")
    lines.append("")
    lines.append("### Final Check")
    lines.append("- [ ] The page is complete from top to bottom, not just the strongest section.")
    lines.append("- [ ] All visible copy is real and product-specific.")
    lines.append("- [ ] Interaction states, responsive behavior, and support states are present.")
    lines.append("- [ ] No placeholders, TODOs, or verbal promises stand in for code.")
    lines.append("")

    return "\n".join(lines)


# ============ MAIN ENTRY POINT ============
def generate_design_system(query: str, project_name: str = None, output_format: str = "ascii") -> str:
    """
    Main entry point for design system generation.

    Args:
        query: Search query (e.g., "SaaS dashboard", "e-commerce luxury")
        project_name: Optional project name for output header
        output_format: "ascii" (default) or "markdown"

    Returns:
        Formatted design system string
    """
    generator = DesignSystemGenerator()
    design_system = generator.generate(query, project_name)

    if output_format == "markdown":
        return format_markdown(design_system)
    return format_ascii_box(design_system)


def generate_redesign_audit(query: str, project_name: str = None, output_format: str = "markdown") -> str:
    """Main entry point for redesign audit generation."""
    generator = DesignSystemGenerator()
    audit = generator.generate_redesign_audit(query, project_name)

    return format_redesign_markdown(audit)


# ============ CLI SUPPORT ============
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate Design System")
    parser.add_argument("query", help="Search query (e.g., 'SaaS dashboard')")
    parser.add_argument("--project-name", "-p", type=str, default=None, help="Project name")
    parser.add_argument("--format", "-f", choices=["ascii", "markdown"], default="ascii", help="Output format")

    args = parser.parse_args()

    result = generate_design_system(args.query, args.project_name, args.format)
    print(result)
