---
name: analytics
description: "Core PM skill pack for product analytics. Covers defining North Star metrics, input metrics, designing dashboards, funnel/cohort analysis, and A/B testing strategy."
user-invocable: true
risk: safe
---

# Product Analytics Skill Pack

This skill pack provides frameworks for setting up metrics, evaluating product health, and running data-driven tests.

## 1. North Star & Input Metrics
Define the single metric that best captures the core value delivered to customers (North Star), and the leading indicators (Input Metrics) that drive it.
- **North Star Metric**: Example - 'Total listening time' (Spotify), 'Nights booked' (Airbnb).
- **Input Metrics**: Metrics team can directly influence (e.g., Search conversion rate, host listing rate).
*Prompt Pattern:* "Define a North Star Metric and 3 Input Metrics for [Product Type]."

## 2. Metrics Dashboard Design
Design a structured dashboard layout to track product health.
- Include Acquisition, Activation, Retention, Referral, and Revenue metrics (AARRR).
- Set alert thresholds for critical drops in performance.
*Prompt Pattern:* "Design a core product metrics dashboard for [Product/Feature]."

## 3. Funnel & Cohort Analysis
Analyze user progression and retention over time.
- **Funnel**: Identify drop-off points in key user journeys (e.g., Onboarding, Checkout).
- **Cohort**: Compare retention rates between different groups of users over time (e.g., users who signed up in Jan vs Feb).

## 4. A/B Testing Strategy
Design robust experiments to test hypotheses.
- Define the Hypothesis, Primary Metric, Secondary Metrics (guardrails), and Minimum Detectable Effect (MDE).
*Prompt Pattern:* "Design an A/B test to improve the conversion rate of [Specific Flow]."

## 🛠️ Implementation Checklist
- [ ] Is the North Star metric a measure of customer value, not just business revenue?
- [ ] Are the input metrics actionable by the product team?
- [ ] Does the analytics setup include guardrail metrics to prevent unintended negative consequences?
- [ ] Is the A/B test hypothesis clearly defined before execution?
