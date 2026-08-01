import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Radar, TrendingUp, TrendingDown, Minus, Sparkles, Loader2, X, ChevronRight,
  Plus, Trash2, Zap, Users, Briefcase, ArrowUpRight, Maximize2, Globe2, Cpu,
  Building2, CalendarClock, Newspaper, Mail, Phone, Bell, DollarSign, UserPlus,
  AlertTriangle, LayoutGrid, Network, FileText, Copy, Check, Circle,
  Mic, Square, Smile, Meh, Frown, ListChecks, AlertOctagon, Tag, ChevronDown, PhoneCall, Presentation,
} from "lucide-react";

// ---------------------------------------------------------------------------
// DESIGN TOKENS — Lusha's real product palette (white bg, near-black text,
// vivid violet accent, small colored category chips), shared across both
// views so the merged tool reads as one coherent product, not two bolted
// together.
// ---------------------------------------------------------------------------

const FONT_IMPORT_URL =
  "https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap";

const PANEL = "#FFFFFF";
const INK = "#0A0A0A";
const MUTED = "#6B7280";
const BORDER = "#E5E5EA";
const VIOLET = "#7C3AED";
const BLUE_CHIP = "#4F8FEF";
const PINK_CHIP = "#F472B6";
const LAVENDER_BAND = "#EDE4FB";
const RISK = "#DC2626";

const TIER_COLORS = {
  healthy: { label: "Healthy", color: "#16A34A", bg: "#EAFBF1" },
  watch: { label: "Watch", color: "#D97706", bg: "#FEF6E7" },
  risk: { label: "At Risk", color: "#DC2626", bg: "#FEEDED" },
};

function scoreTier(score) {
  if (score >= 75) return "healthy";
  if (score >= 50) return "watch";
  return "risk";
}

const SENTIMENT_COLORS = { Champion: "#16A34A", Neutral: "#D97706", Detractor: "#E11D48", Unknown: "#9691AE" };
const SENTIMENT_PILL = {
  Champion: { text: "#DB2777", bg: "#FDE8F3" },
  Neutral: { text: "#C2410C", bg: "#FEF0E3" },
  Detractor: { text: "#DC2626", bg: "#FEE2E2" },
  Unknown: { text: "#6B7280", bg: "#F0F0F2" },
};
const SENTIMENT_SORT = { Champion: 0, Neutral: 1, Unknown: 2, Detractor: 3 };
const INFLUENCE_SORT = { High: 0, Medium: 1, Low: 2 };
function formatDoneAction(a) {
  return a.result && a.result.trim() ? `${a.text} — ${a.result.trim()}` : a.text;
}

function sortStakeholders(list) {
  return [...list].sort((a, b) => {
    const s = (SENTIMENT_SORT[a.sentiment] ?? 4) - (SENTIMENT_SORT[b.sentiment] ?? 4);
    if (s !== 0) return s;
    return (INFLUENCE_SORT[a.influence] ?? 3) - (INFLUENCE_SORT[b.influence] ?? 3);
  });
}

const ALERT_SIGNAL_TYPES = ["risk", "layoffs", "ma"];

const SIGNAL_STYLES = {
  funding: { label: "Funding", color: "#059669", icon: DollarSign },
  hiring: { label: "Hiring & Growth", color: "#2563EB", icon: Users },
  leadership: { label: "Leadership Change", color: "#D97706", icon: UserPlus },
  expansion: { label: "Market Expansion", color: "#0D9488", icon: Globe2 },
  product: { label: "Product / Tech Stack", color: "#4F46E5", icon: Cpu },
  ma: { label: "M&A Activity", color: "#7C3AED", icon: Building2 },
  layoffs: { label: "Layoffs / Downsizing", color: "#EA580C", icon: TrendingDown },
  renewal: { label: "Renewal / Budget Cycle", color: "#0891B2", icon: CalendarClock },
  news: { label: "News / Press Mention", color: "#64748B", icon: Newspaper },
  risk: { label: "Competitive Risk", color: "#DC2626", icon: AlertTriangle },
};

function signalTypeContext(type) {
  const context = {
    funding: "Fresh capital often means new budget for tools and expanded teams within the next 3 to 6 months.",
    hiring: "A hiring surge usually means the team is scaling fast and will likely need more seats or higher usage soon.",
    leadership: "New leadership often triggers a re-evaluation of existing vendors within their first 90 days.",
    expansion: "Entering a new market usually comes with new requirements and often a new budget line.",
    product: "A tech stack change can signal either a threat or an integration opportunity, worth a direct conversation.",
    ma: "M&A activity often triggers a vendor consolidation review. Act early to avoid stack rationalization cuts.",
    layoffs: "Downsizing can shrink budgets and remove champions, and raises churn risk if your contact is affected.",
    renewal: "Budget cycles are when renewal and expansion decisions get finalized.",
    news: "Public visibility often signals momentum and growth investment.",
    risk: "Competitive signals need a fast, direct response before a formal evaluation gets underway.",
  };
  return context[type] || "No additional context available yet.";
}

function influenceSentimentReadout(influence, sentiment) {
  const matrix = {
    High: {
      Champion: "Champion and highly influential — your strongest ally on this account.",
      Neutral: "Highly influential but undecided — top priority to win over.",
      Detractor: "Highly influential and skeptical — the biggest risk here, address directly.",
      Unknown: "Highly influential, sentiment not yet known — worth learning more urgently.",
    },
    Medium: {
      Champion: "Champion with moderate influence — a helpful advocate, but not decisive alone.",
      Neutral: "Moderate influence, undecided — worth engaging to build support.",
      Detractor: "Moderate influence and skeptical — handle carefully.",
      Unknown: "Moderate influence, sentiment unclear — gather more signal.",
    },
    Low: {
      Champion: "Champion but limited influence — friendly, though not decisive alone.",
      Neutral: "Low influence, neutral — lower priority for now.",
      Detractor: "Low influence and skeptical — minor risk, low priority to address.",
      Unknown: "Low influence, largely unknown — lowest priority to research.",
    },
  };
  return (matrix[influence] && matrix[influence][sentiment]) || "Not enough data yet to assess this stakeholder.";
}

// ---------------------------------------------------------------------------
// HEALTH METRIC DEFINITIONS
// ---------------------------------------------------------------------------

const METRIC_DEFS = [
  { key: "creditUtilization", label: "Credit utilization rate", suffix: "%", weight: 0.35, direction: "up" },
  { key: "seatAdoption", label: "Active seat adoption", suffix: "%", weight: 0.30, direction: "up" },
  { key: "crmSyncRate", label: "CRM sync success rate", suffix: "%", weight: 0.20, direction: "up" },
  { key: "bounceRate", label: "Email bounce rate", suffix: "%", weight: 0.15, direction: "down", maxForScore: 15 },
];

function normalizeMetric(def, raw) {
  if (def.direction === "down") {
    const capped = Math.min(raw, def.maxForScore);
    return 100 - (capped / def.maxForScore) * 100;
  }
  return Math.max(0, Math.min(100, raw));
}

function computeHealthScore(account) {
  let total = 0;
  METRIC_DEFS.forEach((def) => { total += normalizeMetric(def, account.metrics[def.key]) * def.weight; });
  return Math.round(total);
}

function formatMoney(n) { return "$" + n.toLocaleString("en-US"); }

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function renewalLabel(dateStr) {
  const days = daysUntil(dateStr);
  if (days == null) return null;
  const dateFormatted = new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (days < 0) return { text: `Renewal date passed (${dateFormatted})`, urgent: true };
  if (days === 0) return { text: `Renewal is today (${dateFormatted})`, urgent: true };
  if (days <= 60) return { text: `Renewal in ${days} days (${dateFormatted})`, urgent: true };
  return { text: `Renewal in ${days} days (${dateFormatted})`, urgent: false };
}

// ---------------------------------------------------------------------------
// UNIFIED ACCOUNT DATA — same 4 accounts, now carrying both health metrics
// AND expansion signals/stakeholders together, so the two views tell one
// consistent story about each customer.
// ---------------------------------------------------------------------------

const ACCOUNTS = [
  {
    id: "acc1", name: "Meridian Cloud Systems", tier: "Enterprise", value: 85000, domain: "meridiancloud.io", renewalDate: "2026-12-01",
    trend: [68, 71, 74, 78, 80, 83],
    metrics: { creditUtilization: 82, seatAdoption: 76, crmSyncRate: 95, bounceRate: 3 },
    healthNotes: "Just raised a $60M Series C and is scaling its sales org fast, with 22 open SDR roles. New CRO joined 6 weeks ago from a competitor.",
    signals: [
      { type: "funding", detail: "Raised $60M Series C", when: "3 weeks ago" },
      { type: "hiring", detail: "22 open roles posted in Sales Development", when: "this month" },
      { type: "leadership", detail: "New CRO joined from a competitor", when: "6 weeks ago" },
      { type: "renewal", detail: "Budget planning cycle starts next quarter", when: "upcoming" },
    ],
    stakeholders: [
      { name: "Dana Reeves", role: "VP Sales Ops", influence: "High", sentiment: "Champion", email: "dana.reeves@meridiancloud.io", phone: "+1 (415) 555-0142" },
      { name: "Marcus Webb", role: "CRO (new)", influence: "High", sentiment: "Unknown", email: "marcus.webb@meridiancloud.io", phone: "+1 (415) 555-0198" },
      { name: "Alicia Chen", role: "VP Customer Experience", influence: "Medium", sentiment: "Champion", email: "alicia.chen@meridiancloud.io", phone: "+1 (415) 555-0117" },
      { name: "Priya Nair", role: "SDR Team Lead", influence: "Medium", sentiment: "Neutral", email: "priya.nair@meridiancloud.io", phone: "+1 (415) 555-0163" },
      { name: "Jordan Blake", role: "Head of Enablement", influence: "Low", sentiment: "Neutral", email: "jordan.blake@meridiancloud.io", phone: "+1 (415) 555-0184" },
    ],
  },
  {
    id: "acc2", name: "Fortline Insurance Group", tier: "Mid-Market", value: 32000, domain: "fortlinegroup.com", renewalDate: "2027-04-01",
    trend: [72, 70, 69, 67, 66, 65],
    metrics: { creditUtilization: 58, seatAdoption: 61, crmSyncRate: 88, bounceRate: 6 },
    healthNotes: "Growing sales team (40 to 65 reps) and expanding into the EU, but a recent job posting referenced a competitor tool.",
    signals: [
      { type: "hiring", detail: "Sales team grew from 40 to 65 reps over 2 quarters", when: "ongoing" },
      { type: "risk", detail: "Recent job posting lists a competitor tool as \"a plus\"", when: "2 weeks ago" },
      { type: "expansion", detail: "Publicly announced GTM expansion into the EU", when: "1 month ago" },
      { type: "news", detail: "Featured in a regional business journal as a \"company to watch\"", when: "3 weeks ago" },
    ],
    stakeholders: [
      { name: "Tom Ashworth", role: "Director of RevOps", influence: "High", sentiment: "Neutral", email: "tom.ashworth@fortlinegroup.com", phone: "+1 (312) 555-0129" },
      { name: "Ravi Shah", role: "CFO", influence: "High", sentiment: "Unknown", email: "ravi.shah@fortlinegroup.com", phone: "+1 (312) 555-0155" },
      { name: "Elena Cruz", role: "Sales Manager", influence: "Medium", sentiment: "Champion", email: "elena.cruz@fortlinegroup.com", phone: "+1 (312) 555-0171" },
      { name: "Nina Torres", role: "RevOps Analyst", influence: "Low", sentiment: "Neutral", email: "nina.torres@fortlinegroup.com", phone: "+1 (312) 555-0188" },
    ],
  },
  {
    id: "acc3", name: "Northwind Analytics", tier: "SMB", value: 12000, domain: "northwindanalytics.co", renewalDate: "2026-10-01",
    trend: [60, 63, 66, 68, 71, 73],
    metrics: { creditUtilization: 70, seatAdoption: 65, crmSyncRate: 90, bounceRate: 4 },
    healthNotes: "Founder publicly committed to doubling the team next year and just closed a seed extension. Still only one confirmed internal champion.",
    signals: [
      { type: "leadership", detail: "Founder posted publicly about doubling the sales team next year", when: "1 week ago" },
      { type: "funding", detail: "Closed a seed extension round", when: "1 month ago" },
      { type: "product", detail: "Job posting mentions migrating their stack to a new CRM", when: "2 weeks ago" },
    ],
    stakeholders: [
      { name: "Sam Okafor", role: "Founder & CEO", influence: "High", sentiment: "Unknown", email: "sam@northwindanalytics.co", phone: "+1 (206) 555-0134" },
      { name: "Jess Lindqvist", role: "Head of Growth", influence: "Medium", sentiment: "Champion", email: "jess@northwindanalytics.co", phone: "+1 (206) 555-0147" },
    ],
  },
  {
    id: "acc4", name: "Brightline Logistics", tier: "Enterprise", value: 110000, domain: "brightlinelogistics.com", renewalDate: "2027-02-01",
    trend: [68, 60, 52, 44, 36, 29],
    metrics: { creditUtilization: 22, seatAdoption: 18, crmSyncRate: 61, bounceRate: 11 },
    healthNotes: "Acquired by a larger logistics holding company. VP of Sales role has been vacant for 2 months, alongside a 10% corporate layoff.",
    signals: [
      { type: "risk", detail: "VP of Sales departed, role still vacant", when: "2 months ago" },
      { type: "risk", detail: "Seat utilization down 20% over the past quarter", when: "ongoing" },
      { type: "ma", detail: "Acquired by a larger logistics holding company", when: "1 month ago" },
      { type: "layoffs", detail: "Announced a 10% reduction in corporate headcount", when: "3 weeks ago" },
    ],
    stakeholders: [
      { name: "Karen Liu", role: "RevOps Manager", influence: "Medium", sentiment: "Neutral", email: "karen.liu@brightlinelogistics.com", phone: "+1 (773) 555-0122" },
      { name: "Victor Osei", role: "New CFO (post-acquisition)", influence: "High", sentiment: "Unknown", email: "victor.osei@brightlinelogistics.com", phone: "+1 (773) 555-0139" },
      { name: "Priya Shah", role: "Ops Coordinator", influence: "Low", sentiment: "Detractor", email: "priya.shah@brightlinelogistics.com", phone: "+1 (773) 555-0156" },
    ],
  },
];

const FALLBACK_INSIGHTS = {
  acc1: { summary: "Meridian is trending strongly upward, with credit utilization at 82% and near-perfect CRM sync reliability. The new CRO and active SDR hiring point to a widening user base.", recommendation: "Prioritize this account for an expansion conversation while usage momentum is high." },
  acc2: { summary: "Fortline shows a slow, steady decline in health, with mid-range utilization and a rising bounce rate, consistent with the competitive signal already flagged.", recommendation: "Schedule a proactive check-in to understand the utilization dip before it worsens." },
  acc3: { summary: "Northwind is a small account trending positively across every metric, consistent with its recent funding and growth plans, though usage is concentrated in one user.", recommendation: "Encourage the founder to loop in additional teammates to broaden seat adoption." },
  acc4: { summary: "Brightline is in serious decline across all four metrics, mirroring the acquisition and layoffs already on record. Credit and seat usage have both collapsed.", recommendation: "Treat this as a retention-critical account. Identify the new internal owner before any other conversation." },
};

const FALLBACK_BRIEFS = {
  acc1: {
    opportunitySummary: "Meridian just raised a $60M Series C and is aggressively scaling its sales org, with 22 open SDR roles and a newly hired CRO. Health metrics confirm this, usage is strong and growing, which supports a confident expansion push.",
    priorityStakeholders: [
      { name: "Marcus Webb", reason: "As the new CRO, he'll shape tool decisions for the next 12+ months.", emailSubject: "Welcome, and a quick intro", emailBody: "Hi Marcus,\n\nCongrats on the new role at Meridian. I imagine the first few months are a whirlwind. I've had the pleasure of working with your team, and wanted to reach out directly as you settle in.\n\nWhen would be a good time for a 20 minute call sometime in the next couple of weeks? I'd love to hear your priorities and share a bit about how we've been supporting the team so far.\n\nLet me know what works best for your schedule.\n\nBest,\n[Your name]" },
      { name: "Dana Reeves", reason: "Already a champion with high influence and strong product usage to point to.", emailSubject: "Quick favor, intro to Marcus?", emailBody: "Hi Dana,\n\nHope things are going well amid all the team growth! I saw Marcus joined as CRO recently. Would you be open to a quick introduction? I'd love to connect with him early on.\n\nAlso happy to grab 15 minutes with you first if useful, just to sync before that.\n\nThanks so much, and congrats again on the momentum over there.\n\nBest,\n[Your name]" },
    ],
    dealAngle: "Position the expansion around supporting the incoming SDR team's ramp-up speed, backed by their already-strong usage metrics.",
    nextBestAction: "Ask Dana for a warm introduction to Marcus Webb within the next two weeks.",
    healthContext: "Healthy tier (score in the 80s), this account is a confident expansion candidate, not a retention risk.",
  },
  acc2: {
    opportunitySummary: "Fortline is expanding into the EU, but health metrics show a declining trend and a rising bounce rate that lines up with the competitive signal already flagged. This is a retain-and-defend situation more than a pure growth play right now.",
    priorityStakeholders: [
      { name: "Tom Ashworth", reason: "Holds tool-stack decision authority and is currently neutral, the highest-value conversation to shift.", emailSubject: "Checking in ahead of your EU expansion", emailBody: "Hi Tom,\n\nCongrats on the EU expansion news. Exciting stage for the team. I wanted to check in and see how planning is going on your end.\n\nWhen would be a good time this week or next for a short call? I'd love to hear what's top of mind as you scale into the new market, and see where we can best support.\n\nLet me know what works for you.\n\nBest,\n[Your name]" },
    ],
    dealAngle: "Lead with the declining usage trend directly, framed as a check-in rather than a sales pitch, before the competitive risk solidifies further.",
    nextBestAction: "Schedule a usage review with Tom Ashworth within 30 days, tied to both the EU expansion and the declining health trend.",
    healthContext: "Watch tier (score mid-60s) and trending down, treat this as a defend-the-account priority, not a growth priority, until the trend reverses.",
  },
  acc3: {
    opportunitySummary: "Northwind's health metrics are trending positively, consistent with their recent funding and growth plans, but usage is concentrated almost entirely in one person.",
    priorityStakeholders: [
      { name: "Sam Okafor", reason: "Founder and sole confirmed stakeholder, but sentiment is unknown despite growing usage.", emailSubject: "Saw the news, congrats!", emailBody: "Hi Sam,\n\nSaw your post about doubling the team next year. Congrats, that's an exciting stage to be entering!\n\nWould love to grab 15 minutes sometime to hear more about your plans, and make sure we're set up well to support the team as it grows. Happy to work around your schedule.\n\nLet me know what time works.\n\nBest,\n[Your name]" },
    ],
    dealAngle: "Focus this cycle on broadening usage beyond one person rather than pushing expansion revenue, the account is healthy but fragile if Sam's engagement ever drops.",
    nextBestAction: "Ask Sam directly who else on the team should get seat access as they scale.",
    healthContext: "Watch tier, just under the healthy threshold, mainly due to single-user concentration risk despite a positive trend.",
  },
  acc4: {
    opportunitySummary: "Brightline's health metrics have collapsed across the board, mirroring the acquisition, the vacant VP of Sales role, and the recent layoffs. This is a retention-critical account, not an expansion one.",
    priorityStakeholders: [
      { name: "Karen Liu", reason: "The only known stakeholder and currently neutral, the immediate path to understanding what's happening internally.", emailSubject: "Checking in", emailBody: "Hi Karen,\n\nHope you're doing alright given everything going on at Brightline recently. I wanted to check in and see how things are on your end.\n\nWhen would be a good time this week for a quick call? No agenda beyond making sure we're supporting you well through the transition, and hearing how things are looking from your side.\n\nLet me know what works.\n\nBest,\n[Your name]" },
    ],
    dealAngle: "Do not raise expansion at all this cycle. Lead entirely with stability and understanding the new organizational structure post-acquisition.",
    nextBestAction: "Request a check-in with Karen Liu this month to identify who now owns the renewal decision.",
    healthContext: "At Risk tier (score in the 20s) and falling sharply, this account needs retention triage before any other conversation happens.",
  },
};

const FALLBACK_REPORTS = {
  acc1: {
    executiveSummary: "Meridian is a healthy, fast-growing Enterprise account. Usage metrics are strong and trending up, and a recent $60M Series C plus active SDR hiring make this a well-timed expansion candidate.",
    keyPoints: ["Health score 83/100 (Healthy), trending up over the last 6 check-ins", "New CRO joined 6 weeks ago from a competitor, a key relationship to secure early", "Champion (Dana Reeves) already in place and highly engaged"],
    risksAndOpportunities: ["Opportunity: 22 open SDR roles signal a widening user base ahead", "Watch item: new CRO's tool preferences are not yet known"],
    recommendedActions: ["Prioritize an introduction to the new CRO within two weeks", "Position an expansion conversation around supporting the SDR ramp-up"],
  },
  acc2: {
    executiveSummary: "Fortline is a Mid-Market account showing early warning signs. Health metrics are declining and a competitor was referenced in a recent job posting, even as the account expands into the EU.",
    keyPoints: ["Health score 65/100 (Watch), trending down over the last 6 check-ins", "Competitive risk signal identified two weeks ago", "Primary contact (Tom Ashworth) currently neutral, not yet a champion"],
    risksAndOpportunities: ["Risk: declining usage combined with competitive interest", "Opportunity: EU expansion could justify a proactive support conversation"],
    recommendedActions: ["Schedule a usage review with Tom Ashworth within 30 days", "Address the competitive signal directly before it formalizes into an evaluation"],
  },
  acc3: {
    executiveSummary: "Northwind is a small but promising SMB account, trending positively on the back of recent funding and public growth plans, though usage is concentrated in a single user.",
    keyPoints: ["Health score 73/100 (Watch, just below Healthy threshold), trending up", "Founder-led account with high growth ambition", "Only one confirmed active stakeholder so far"],
    risksAndOpportunities: ["Risk: single point of usage concentration", "Opportunity: founder has publicly committed to doubling the team"],
    recommendedActions: ["Ask the founder to loop in additional teammates for broader adoption", "Keep this a light-touch relationship-building cycle, not a hard expansion push"],
  },
  acc4: {
    executiveSummary: "Brightline is a retention-critical Enterprise account. Health metrics have collapsed following an acquisition, a vacant VP of Sales role, and a 10% corporate layoff.",
    keyPoints: ["Health score 29/100 (At Risk), falling sharply over the last 6 check-ins", "Acquired by a larger logistics holding company one month ago", "No senior internal advocate currently confirmed"],
    risksAndOpportunities: ["Risk: high, this is the most urgent account in the portfolio right now", "Unknown: new CFO's stance on the relationship is not yet established"],
    recommendedActions: ["Do not raise expansion this cycle, retention only", "Identify the new internal decision-maker before the next renewal conversation"],
  },
};

const FALLBACK_PORTFOLIO_REPORT = {
  executiveSummary: "The portfolio is mixed: one account is healthy and expanding, two are in a watch state with early warning signs, and one enterprise account is in serious decline following an acquisition and layoffs. Total ARR at risk is significant given Brightline's size.",
  keyPoints: ["1 account Healthy, 2 in Watch, 1 At Risk out of 4 total accounts", "$110,000 ARR concentrated in the single At Risk account (Brightline)", "Two accounts show live competitive or organizational risk signals this cycle"],
  risksAndOpportunities: ["Highest priority risk: Brightline, post-acquisition instability with no confirmed senior advocate", "Highest priority opportunity: Meridian, strong usage growth plus active hiring, well-timed for expansion", "Fortline needs a proactive check-in before its declining trend and competitive signal compound"],
  recommendedActions: ["This week: initiate retention triage on Brightline", "This month: convert Meridian's momentum into a formal expansion conversation", "This quarter: reverse Fortline's declining trend before renewal"],
};

const FALLBACK_CALL_ANALYSIS = {
  acc1: { sentiment: "positive", sentimentScore: 88, summary: "Dana and the Meridian team sounded upbeat about the platform's role in supporting their SDR ramp-up. No concerns raised; the conversation focused on onboarding the incoming hires quickly.", topics: ["SDR onboarding", "Seat provisioning", "CRO introduction"], actionItems: ["Provision seats for the new SDR cohort", "Confirm timing for the CRO introduction call"], riskSignals: ["None identified this call"] },
  acc2: { sentiment: "neutral", sentimentScore: 52, summary: "Tom was polite but noncommittal, and confirmed the team is evaluating other vendors as part of a broader tooling review tied to the EU expansion.", topics: ["EU expansion tooling review", "Vendor evaluation"], actionItems: ["Send a comparison one-pager ahead of their vendor review", "Schedule a follow-up before the review concludes"], riskSignals: ["Active vendor evaluation confirmed verbally", "No strong internal champion pushing back on the review"] },
  acc3: { sentiment: "positive", sentimentScore: 79, summary: "Sam was enthusiastic about the product but mentioned he's the only one really using it day-to-day. Open to bringing on the growth team once headcount grows.", topics: ["Single-user usage pattern", "Team growth plans"], actionItems: ["Follow up once Sam's new hires start, to onboard them"], riskSignals: ["Usage still concentrated in one person"] },
  acc4: { sentiment: "negative", sentimentScore: 24, summary: "Karen sounded overwhelmed and mentioned the acquisition has created real uncertainty about tooling budgets going forward. No clear decision-maker identified yet.", topics: ["Post-acquisition uncertainty", "Budget ownership unclear"], actionItems: ["Ask Karen directly who now owns vendor decisions post-acquisition", "Avoid raising expansion until ownership is clarified"], riskSignals: ["Explicit budget uncertainty mentioned", "No confirmed decision-maker on the client side"] },
};

const EXAMPLE_QBR_NOTES = {
  acc1: `Q3 QBR w/ Dana Reeves + Marcus Webb (new CRO). Usage way up this quarter, credit utilization at 82%, SDR team growing fast, 22 open roles. Marcus asked good questions about roadmap, seemed impressed with reporting. Dana pushing for more seats ahead of the new hires starting. No complaints raised. Mentioned Series C funding, clearly investing in growth. Asked about enterprise-tier features. Want to follow up with pricing for expanded seats before their budget planning cycle next quarter.`,
  acc2: `QBR w/ Tom Ashworth. Bit of a tense one honestly. He mentioned they're doing a broader tooling review as part of the EU expansion, comparing us against at least one other vendor. Usage has dipped a bit this quarter (58% credit utilization, down from last review). Said the EU team wants a decision before they're fully staffed. Promised to send a comparison sheet. Also flagged their CRM sync has had a few hiccups lately. Ravi Shah (CFO) was mentioned as involved in budget decisions but wasn't on the call.`,
  acc3: `QBR w/ Sam Okafor (founder). Really positive tone, he's happy with the product. Still the only person actively using it day to day though, seat adoption is thin. Mentioned the recent funding round and plans to double the team next year. Said once new hires start he'll get them set up. No complaints, no risk signals really, just a concentration issue. Good candidate for a light-touch relationship, not a hard push this quarter.`,
  acc4: `QBR w/ Karen Liu, rescheduled twice. She sounded stretched thin. Company was acquired last month, still unclear who owns vendor budgets now. VP of Sales role has been vacant 2 months. 10% layoffs announced recently too. Credit utilization down to 22%, seat adoption way down. She couldn't commit to anything concrete, said she'd try to find out who the new decision maker is. This felt more like a check-in than a real business review.`,
};

const FALLBACK_QBR = {
  acc1: {
    executiveSummary: "Meridian had a strong quarter, with usage climbing alongside a $60M Series C and aggressive SDR hiring. The new CRO's engagement in this review is a good early signal, and the account is well positioned for an expansion conversation.",
    wins: ["Credit utilization up to 82%, reflecting strong day-to-day adoption", "New CRO engaged directly in the review and asked detailed roadmap questions"],
    risks: ["None significant this quarter"],
    nextSteps: ["Share enterprise-tier pricing ahead of their budget planning cycle", "Provision additional seats for the incoming SDR cohort"],
    renewalOutlook: "Strong. This account is a clear expansion candidate heading into next quarter.",
  },
  acc2: {
    executiveSummary: "Fortline is in the middle of a tooling review tied to their EU expansion, and usage has softened slightly this quarter. The relationship remains professional, but this account needs proactive attention before the review concludes.",
    wins: ["Continued progress on EU expansion planning"],
    risks: ["Active vendor comparison underway, with a decision expected before the EU team is fully staffed", "Credit utilization declined from the previous review", "Minor CRM sync reliability issues raised"],
    nextSteps: ["Send the requested vendor comparison sheet this week", "Loop in Ravi Shah (CFO) directly given his role in the budget decision", "Address the CRM sync issue before the next check-in"],
    renewalOutlook: "At risk. A competitive decision is actively in motion; this account needs a strong proactive response before next quarter.",
  },
  acc3: {
    executiveSummary: "Northwind remains a small but positive account. The founder is satisfied with the product and the company is growing quickly, though usage is still concentrated entirely in one person.",
    wins: ["Founder remains an enthusiastic, engaged user", "Recent funding round and public growth plans signal a growing account"],
    risks: ["Seat adoption remains limited to a single user, a concentration risk if that relationship ever weakens"],
    nextSteps: ["Check back in once new hires start, to help onboard them quickly", "Keep this a light-touch relationship this quarter rather than pushing expansion"],
    renewalOutlook: "Stable. Healthy relationship, but growth in usage depends on broader team adoption.",
  },
  acc4: {
    executiveSummary: "Brightline's quarter was dominated by instability following their acquisition, including a vacant VP of Sales role and a 10% layoff. This review functioned more as a check-in than a true business review, and the account needs retention-focused attention.",
    wins: ["None this quarter"],
    risks: ["No confirmed decision-maker for vendor budgets post-acquisition", "Credit utilization and seat adoption both declined sharply", "Primary contact appeared stretched thin and unable to commit to next steps"],
    nextSteps: ["Follow up with Karen Liu to identify the new internal decision-maker", "Hold off on any expansion conversation until ownership is clarified", "Schedule a shorter, lower-pressure check-in rather than a full review next cycle"],
    renewalOutlook: "At risk. This account needs stabilization before any confident renewal conversation is possible.",
  },
};

const EXAMPLE_TRANSCRIPTS = {
  acc1: `CSM: Hi Dana, thanks for hopping on. How's the SDR hiring going?
Client (Dana): Really well, actually. We've got the first batch of new hires starting in about two weeks.
CSM: That's great. Want to make sure they're set up with seats from day one, do you have a headcount for me?
Client (Dana): I think it's eight to start, could grow from there. I'll confirm the exact number by Friday.
CSM: Perfect, I'll get that provisioned as soon as you send it over. Also wanted to check, has Marcus had a chance to loop in yet?
Client (Dana): Not yet, he's still getting settled, but I mentioned you to him. I think a quick intro call in the next couple weeks would land well.
CSM: Sounds good, I'll follow up to get that on the calendar. Anything else on your end?
Client (Dana): No, honestly things are in a good place right now. Excited for the new hires to get going.`,
  acc2: `CSM: Hi Tom, good to catch up. How's the EU expansion planning going?
Client (Tom): It's moving along. Honestly, we're also in the middle of a broader tooling review as part of that, looking at a few vendors side by side.
CSM: Okay, appreciate you being upfront about that. Would it help if I put together a comparison sheet for our side?
Client (Tom): Yeah, that would actually be useful. We want to make a decision before the EU team is fully staffed.
CSM: Understood, I'll get that to you this week. Is there a timeline for when the review wraps up?
Client (Tom): Probably within the next month. Nothing decided yet, just want to be thorough.
CSM: Makes sense. I'll follow up before that window closes to see where things stand.`,
  acc3: `CSM: Hey Sam, how have things been since the funding round?
Client (Sam): Good, really good actually. Still just me using the tool day to day though, haven't onboarded anyone else yet.
CSM: That's useful to know. Once the new hires start, would it make sense to get them set up too?
Client (Sam): Definitely, that's the plan. We're planning to bring on a couple people over the next quarter.
CSM: Great, just flag it whenever that happens and I'll help get them ramped up quickly.
Client (Sam): Will do. Honestly really happy with how things have been going so far.`,
  acc4: `CSM: Hi Karen, wanted to check in given everything going on. How are things on your end?
Client (Karen): Honestly, a bit chaotic. Since the acquisition, it's not totally clear who owns vendor budgets anymore.
CSM: That sounds stressful. Is there someone new I should be looping in on our side?
Client (Karen): I'm not sure yet, to be honest. Might be someone from the parent company's finance team, but I don't have a name.
CSM: Okay, no pressure, just let me know when you find out. In the meantime is there anything urgent I can help with?
Client (Karen): Not really, mostly just trying to keep things steady until the dust settles.
CSM: Understood. I'll check back in in a couple weeks rather than push on anything right now.`,
};

// ---------------------------------------------------------------------------
// SHARED SMALL COMPONENTS
// ---------------------------------------------------------------------------

function ScoreRing({ score, size = 54 }) {
  const t = TIER_COLORS[scoreTier(score)];
  const inner = size - 12;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `conic-gradient(${t.color} ${score * 3.6}deg, ${BORDER} 0deg)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <div style={{ width: inner, height: inner, borderRadius: "50%", background: PANEL, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14, color: INK }}>
        {score}
      </div>
    </div>
  );
}

function TrajectoryStrip({ trend }) {
  const max = Math.max(...trend), min = Math.min(...trend), range = max - min || 1;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 26 }}>
      {trend.map((v, i) => {
        const h = 6 + ((v - min) / range) * 20;
        const t = TIER_COLORS[scoreTier(v)];
        return <div key={i} style={{ width: 5, height: h, borderRadius: 2, background: t.color, opacity: 0.55 + (i / trend.length) * 0.45 }} />;
      })}
    </div>
  );
}

function TrendIcon({ trend }) {
  const delta = trend[trend.length - 1] - trend[0];
  if (delta > 3) return <TrendingUp size={14} color="#16A34A" />;
  if (delta < -3) return <TrendingDown size={14} color="#DC2626" />;
  return <Minus size={14} color={MUTED} />;
}

function buildMailto(contact, subject, body) {
  if (!contact?.email) return null;
  return `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ---------------------------------------------------------------------------
// STAKEHOLDER GRAPH + ROSTER (Expansion view)
// ---------------------------------------------------------------------------

function influenceRadius(influence, scale = 1) {
  return (influence === "High" ? 22 : influence === "Medium" ? 18 : 14) * scale;
}
function influenceOrbit(influence, scale = 1) {
  return (influence === "High" ? 58 : influence === "Medium" ? 88 : 118) * scale;
}

function StakeholderGraph({ account, stakeholders, scale = 1 }) {
  const width = 400 * scale, height = 300 * scale, cx = width / 2, cy = height / 2;
  const nodes = stakeholders.map((s, i) => {
    const angle = (i / stakeholders.length) * Math.PI * 2 - Math.PI / 2;
    const orbitR = influenceOrbit(s.influence, scale);
    return { ...s, x: cx + orbitR * Math.cos(angle), y: cy + orbitR * Math.sin(angle) };
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={VIOLET} stopOpacity="0.18" />
          <stop offset="100%" stopColor={VIOLET} stopOpacity="0" />
        </radialGradient>
      </defs>
      {nodes.map((n, i) => (
        <line key={`l-${i}`} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke={SENTIMENT_COLORS[n.sentiment] || SENTIMENT_COLORS.Unknown} strokeWidth={(n.influence === "High" ? 1.8 : 1.1) * scale} opacity={0.5} />
      ))}
      <circle cx={cx} cy={cy} r={48 * scale} fill="url(#coreGlow)" />
      <circle cx={cx} cy={cy} r={32 * scale} fill={PANEL} stroke={VIOLET} strokeWidth={1.8 * scale} />
      <text x={cx} y={cy - 2 * scale} textAnchor="middle" fill={INK} fontSize={12 * scale} fontFamily="Sora, sans-serif" fontWeight="700">{account.name.split(" ")[0]}</text>
      <text x={cx} y={cy + 11 * scale} textAnchor="middle" fill={MUTED} fontSize={9 * scale} fontFamily="Inter, sans-serif">{account.tier}</text>
      {nodes.map((n, i) => {
        const r = influenceRadius(n.influence, scale);
        const color = SENTIMENT_COLORS[n.sentiment] || SENTIMENT_COLORS.Unknown;
        return (
          <g key={`n-${i}`}>
            <circle cx={n.x} cy={n.y} r={r + 5 * scale} fill={color} opacity={0.13} />
            <circle cx={n.x} cy={n.y} r={r} fill={PANEL} stroke={color} strokeWidth={2.2 * scale} />
            <text x={n.x} y={n.y + 3.5 * scale} textAnchor="middle" fill={INK} fontSize={11 * scale} fontFamily="Inter, sans-serif" fontWeight="700">
              {n.name.split(" ").map((w) => w[0]).join("")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SentimentLegend({ accountName }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${VIOLET}`, background: "transparent" }} />
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: MUTED }}>Center = the account{accountName ? ` (${accountName})` : ""}, not a stakeholder</span>
      </div>
      {Object.entries(SENTIMENT_COLORS).map(([label, color]) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: MUTED }}>{label}</span>
        </div>
      ))}
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: MUTED, marginLeft: 4 }}>· closer to center + bigger circle = higher influence</div>
    </div>
  );
}

function GraphModal({ account, stakeholders, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 24 }} onClick={onClose}>
      <div style={{ background: PANEL, borderRadius: 18, padding: 28, maxWidth: 640, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(10,10,10,0.25)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, position: "sticky", top: -28, background: PANEL, paddingTop: 4, marginTop: -4 }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17, color: INK }}>Stakeholder Map — {account.name}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED }}><X size={20} /></button>
        </div>
        <StakeholderGraph account={account} stakeholders={stakeholders} scale={1.2} />
        <SentimentLegend accountName={account.name} />
        <StakeholderRoster stakeholders={stakeholders} />
      </div>
    </div>
  );
}

function StakeholderRoster({ stakeholders, compact = false }) {
  const [hoveredId, setHoveredId] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
      {stakeholders.map((s, i) => {
        const color = SENTIMENT_COLORS[s.sentiment] || SENTIMENT_COLORS.Unknown;
        const initials = s.name.split(" ").map((w) => w[0]).join("");
        const rowKey = s.id || s.name;
        const isHovered = hoveredId === rowKey;
        const mailto = buildMailto(s, "Following up", `Hi ${s.name.split(" ")[0]},\n\n`);
        const pill = SENTIMENT_PILL[s.sentiment] || SENTIMENT_PILL.Unknown;
        return (
          <div key={rowKey} onMouseEnter={() => setHoveredId(rowKey)} onMouseLeave={() => setHoveredId(null)} style={{
            padding: compact ? "6px 8px" : "8px 10px", background: isHovered ? "#F5F0FF" : "#FBFAFF", borderRadius: 8,
            border: `1px solid ${isHovered ? VIOLET : BORDER}`, transition: "background 0.12s, border-color 0.12s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: compact ? 22 : 26, height: compact ? 22 : 26, borderRadius: "50%", flexShrink: 0, background: PANEL, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: compact ? 9 : 10, color: INK }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: compact ? 12 : 13, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: compact ? 10 : 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.role}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: MUTED }}>{s.influence}</span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, color: pill.text, background: pill.bg, padding: "2px 8px", borderRadius: 20 }}>{s.sentiment}</span>
              </div>
            </div>
            {isHovered && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: INK, lineHeight: 1.5, marginBottom: (s.email || s.phone) ? 8 : 0, fontStyle: "italic" }}>
                  {influenceSentimentReadout(s.influence, s.sentiment)}
                </div>
                {(s.email || s.phone) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    {s.email && <a href={mailto} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "'Inter', sans-serif", fontSize: 11, color: VIOLET, textDecoration: "none" }}><Mail size={12} /> {s.email}</a>}
                    {s.phone && <a href={`tel:${s.phone.replace(/[^0-9+]/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "'Inter', sans-serif", fontSize: 11, color: BLUE_CHIP, textDecoration: "none" }}><Phone size={12} /> {s.phone}</a>}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SignalCard({ signal }) {
  const [hovered, setHovered] = useState(false);
  const style = SIGNAL_STYLES[signal.type];
  const Icon = style.icon;
  const isAlert = ALERT_SIGNAL_TYPES.includes(signal.type);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{
      padding: "10px 12px", borderRadius: 10, background: isAlert ? "#FEF2F2" : "#FBFAFF",
      border: `1px solid ${isAlert ? "#FBC7C7" : BORDER}`, borderLeft: `3px solid ${style.color}`,
      transition: "box-shadow 0.12s", boxShadow: hovered ? "0 2px 8px rgba(10,10,10,0.08)" : "none",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Icon size={14} color={style.color} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: INK, lineHeight: 1.4 }}>{signal.detail}</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: style.color, marginTop: 3, letterSpacing: 0.4 }}>{style.label.toUpperCase()} · {signal.when}</div>
        </div>
        {isAlert && <Bell size={13} color={RISK} style={{ flexShrink: 0 }} />}
      </div>
      {hovered && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${isAlert ? "#FBC7C7" : BORDER}` }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: MUTED, lineHeight: 1.5, fontStyle: "italic" }}>{signal.impact || signalTypeContext(signal.type)}</div>
        </div>
      )}
    </div>
  );
}

function PriorityStakeholderCard({ person, contact, subject, body }) {
  const [showDraft, setShowDraft] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editableBody, setEditableBody] = useState(body);
  const textareaRef = useRef(null);
  useEffect(() => { setEditableBody(body); }, [body]);

  async function handleCopy() {
    const text = `To: ${contact?.email || "(no email on file)"}\nSubject: ${subject}\n\n${editableBody}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
      return;
    } catch (e) {}
    try {
      if (textareaRef.current) {
        textareaRef.current.focus(); textareaRef.current.select();
        document.execCommand("copy");
        setCopied(true); setTimeout(() => setCopied(false), 1800);
      }
    } catch (e) {}
  }

  return (
    <div style={{ padding: "10px 12px", background: "#FBFAFF", borderRadius: 8, border: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: VIOLET, marginTop: 6, flexShrink: 0 }} />
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: INK, lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700 }}>{person.name}</span>
          {contact?.role && <span style={{ color: MUTED, fontWeight: 400 }}> ({contact.role})</span>}
          {" — "}{person.reason}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BORDER}`, marginLeft: 13, alignItems: "center" }}>
        <button onClick={() => setShowDraft(!showDraft)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, color: VIOLET, padding: 0 }}>
          <Mail size={12} /> {showDraft ? "Hide draft" : "View draft email"}
        </button>
        {contact?.phone && <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "'Inter', sans-serif", fontSize: 11, color: BLUE_CHIP }}><Phone size={12} /> {contact.phone}</span>}
        {contact?.email && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: MUTED }}>{contact.email}</span>}
      </div>
      {showDraft && (
        <div style={{ marginTop: 10, marginLeft: 13, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: MUTED, marginBottom: 8 }}><span style={{ fontWeight: 600, color: INK }}>Subject: </span>{subject}</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: MUTED, marginBottom: 4, letterSpacing: 0.3, textTransform: "uppercase" }}>Editable — feel free to adjust before copying</div>
          <textarea ref={textareaRef} value={editableBody} onChange={(e) => setEditableBody(e.target.value)} rows={7} style={{ width: "100%", fontFamily: "'Inter', sans-serif", fontSize: 12, color: INK, lineHeight: 1.6, background: "#FBFAFF", border: `1px solid ${BORDER}`, borderRadius: 6, padding: 10, resize: "vertical", marginBottom: 10 }} />
          <button onClick={handleCopy} style={{ display: "flex", alignItems: "center", gap: 6, background: copied ? "#DCFCE7" : VIOLET, color: copied ? "#16A34A" : "#FFFFFF", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
            {copied ? "Copied ✓" : "Copy to clipboard"}
          </button>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: MUTED, marginLeft: 10 }}>or select the text above and press Ctrl+C / Cmd+C</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADD FORMS
// ---------------------------------------------------------------------------

function AddAccountForm({ onCancel, onSave }) {
  const [name, setName] = useState("");
  const [tier, setTier] = useState("Mid-Market");
  const [value, setValue] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [creditUtilization, setCreditUtilization] = useState("");
  const [seatAdoption, setSeatAdoption] = useState("");
  const [crmSyncRate, setCrmSyncRate] = useState("");
  const [bounceRate, setBounceRate] = useState("");
  const [healthNotes, setHealthNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const canSave = name.trim();

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const metrics = {
      creditUtilization: Number(creditUtilization) || 50,
      seatAdoption: Number(seatAdoption) || 50,
      crmSyncRate: Number(crmSyncRate) || 50,
      bounceRate: Number(bounceRate) || 5,
    };
    const score = computeHealthScore({ metrics });
    await onSave({
      id: `custom-${Date.now()}`, name: name.trim(), tier, value: Number(value) || 0,
      renewalDate: renewalDate || null,
      metrics, trend: Array(6).fill(score), healthNotes: healthNotes.trim() || "No notes yet.",
      signals: [], stakeholders: [], isCustom: true,
    });
    setSaving(false);
  }

  const fieldStyle = { width: "100%", background: "#FAFAFB", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 10px", color: INK, fontFamily: "'Inter', sans-serif", fontSize: 13 };
  const labelStyle = { fontFamily: "'Inter', sans-serif", fontSize: 10, color: MUTED, display: "block", marginBottom: 4, letterSpacing: 0.3, textTransform: "uppercase" };

  return (
    <div style={{ background: "#F8F5FF", border: `1px dashed ${VIOLET}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 15, color: INK }}>New account</span>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED }}><X size={16} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div><label style={labelStyle}>Account name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Solstice Robotics" style={fieldStyle} /></div>
        <div><label style={labelStyle}>Tier</label><select value={tier} onChange={(e) => setTier(e.target.value)} style={fieldStyle}>{["SMB", "Mid-Market", "Enterprise"].map((o) => <option key={o}>{o}</option>)}</select></div>
        <div><label style={labelStyle}>ARR ($)</label><input value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))} placeholder="45000" style={fieldStyle} /></div>
        <div><label style={labelStyle}>Renewal date</label><input type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} style={fieldStyle} /></div>
      </div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: MUTED, marginBottom: 6, letterSpacing: 0.3, textTransform: "uppercase" }}>Health metrics (optional — defaults to 50% if left blank)</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div><label style={labelStyle}>Credit util. (%)</label><input value={creditUtilization} onChange={(e) => setCreditUtilization(e.target.value.replace(/[^0-9]/g, ""))} placeholder="70" style={fieldStyle} /></div>
        <div><label style={labelStyle}>Seat adoption (%)</label><input value={seatAdoption} onChange={(e) => setSeatAdoption(e.target.value.replace(/[^0-9]/g, ""))} placeholder="65" style={fieldStyle} /></div>
        <div><label style={labelStyle}>CRM sync (%)</label><input value={crmSyncRate} onChange={(e) => setCrmSyncRate(e.target.value.replace(/[^0-9]/g, ""))} placeholder="90" style={fieldStyle} /></div>
        <div><label style={labelStyle}>Bounce rate (%)</label><input value={bounceRate} onChange={(e) => setBounceRate(e.target.value.replace(/[^0-9]/g, ""))} placeholder="5" style={fieldStyle} /></div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Notes (optional)</label>
        <textarea value={healthNotes} onChange={(e) => setHealthNotes(e.target.value)} rows={2} placeholder="Any context worth remembering…" style={{ ...fieldStyle, resize: "vertical" }} />
      </div>
      <button onClick={handleSave} disabled={!canSave || saving} style={{ display: "flex", alignItems: "center", gap: 6, background: canSave ? VIOLET : "#D8D4EA", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: canSave && !saving ? "pointer" : "default", fontFamily: "'Inter', sans-serif" }}>
        {saving ? <Loader2 size={13} className="spin" /> : <Plus size={13} />} {saving ? "Saving…" : "Add account"}
      </button>
    </div>
  );
}

function AddStakeholderForm({ onCancel, onSave }) {
  const [name, setName] = useState(""); const [role, setRole] = useState("");
  const [influence, setInfluence] = useState("Medium"); const [sentiment, setSentiment] = useState("Unknown");
  const [email, setEmail] = useState(""); const [phone, setPhone] = useState(""); const [saving, setSaving] = useState(false);
  const canSave = name.trim() && role.trim();

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    await onSave({ id: `custom-${Date.now()}`, name: name.trim(), role: role.trim(), influence, sentiment, email: email.trim() || undefined, phone: phone.trim() || undefined, isCustom: true });
    setSaving(false);
  }
  const fieldStyle = { width: "100%", background: "#FBFAFF", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 10px", color: INK, fontFamily: "'Inter', sans-serif", fontSize: 13 };
  const labelStyle = { fontFamily: "'Inter', sans-serif", fontSize: 10, color: MUTED, display: "block", marginBottom: 4, letterSpacing: 0.3, textTransform: "uppercase" };
  return (
    <div style={{ background: "#F8F5FF", border: `1px dashed ${VIOLET}`, borderRadius: 10, padding: 14, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 13, color: INK }}>New stakeholder</span>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED }}><X size={15} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div><label style={labelStyle}>Name</label><input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} /></div>
        <div><label style={labelStyle}>Role</label><input value={role} onChange={(e) => setRole(e.target.value)} style={fieldStyle} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div><label style={labelStyle}>Influence</label><select value={influence} onChange={(e) => setInfluence(e.target.value)} style={fieldStyle}>{["High", "Medium", "Low"].map((o) => <option key={o}>{o}</option>)}</select></div>
        <div><label style={labelStyle}>Sentiment</label><select value={sentiment} onChange={(e) => setSentiment(e.target.value)} style={fieldStyle}>{["Champion", "Neutral", "Detractor", "Unknown"].map((o) => <option key={o}>{o}</option>)}</select></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div><label style={labelStyle}>Email (optional)</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" style={fieldStyle} /></div>
        <div><label style={labelStyle}>Phone (optional)</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" style={fieldStyle} /></div>
      </div>
      <button onClick={handleSave} disabled={!canSave || saving} style={{ display: "flex", alignItems: "center", gap: 6, background: canSave ? VIOLET : "#D8D4EA", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: canSave && !saving ? "pointer" : "default", fontFamily: "'Inter', sans-serif" }}>
        {saving ? <Loader2 size={12} className="spin" /> : <Plus size={12} />} {saving ? "Saving…" : "Add stakeholder"}
      </button>
    </div>
  );
}

function AddSignalForm({ onCancel, onSave }) {
  const [type, setType] = useState("funding"); const [detail, setDetail] = useState(""); const [when, setWhen] = useState(""); const [saving, setSaving] = useState(false);
  const canSave = detail.trim();
  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    await onSave({ id: `custom-sig-${Date.now()}`, type, detail: detail.trim(), when: when.trim() || "recently" });
    setSaving(false);
  }
  const fieldStyle = { width: "100%", background: "#FBFAFF", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 10px", color: INK, fontFamily: "'Inter', sans-serif", fontSize: 13 };
  const labelStyle = { fontFamily: "'Inter', sans-serif", fontSize: 10, color: MUTED, display: "block", marginBottom: 4, letterSpacing: 0.3, textTransform: "uppercase" };
  return (
    <div style={{ background: "#F8F5FF", border: `1px dashed ${VIOLET}`, borderRadius: 10, padding: 14, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 13, color: INK }}>New signal</span>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED }}><X size={15} /></button>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)} style={fieldStyle}>{Object.entries(SIGNAL_STYLES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 12 }}>
        <div><label style={labelStyle}>Detail</label><input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="e.g. Raised $10M Series A" style={fieldStyle} /></div>
        <div><label style={labelStyle}>When</label><input value={when} onChange={(e) => setWhen(e.target.value)} placeholder="e.g. 2 weeks ago" style={fieldStyle} /></div>
      </div>
      <button onClick={handleSave} disabled={!canSave || saving} style={{ display: "flex", alignItems: "center", gap: 6, background: canSave ? VIOLET : "#D8D4EA", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: canSave && !saving ? "pointer" : "default", fontFamily: "'Inter', sans-serif" }}>
        {saving ? <Loader2 size={12} className="spin" /> : <Plus size={12} />} {saving ? "Saving…" : "Add signal"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HEALTH TAB
// ---------------------------------------------------------------------------

function MetricRow({ def, value }) {
  const normalized = normalizeMetric(def, value);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: MUTED }}>{def.label}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: INK }}>{value}{def.suffix}</span>
      </div>
      <div style={{ height: 6, background: "#F0F0F2", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${normalized}%`, background: VIOLET, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function HealthTab({ accounts, onOpenAccount }) {
  const counts = useMemo(() => {
    const c = { healthy: 0, watch: 0, risk: 0 };
    accounts.forEach((a) => c[scoreTier(computeHealthScore(a))]++);
    return c;
  }, [accounts]);
  const atRiskValue = accounts.filter((a) => scoreTier(computeHealthScore(a)) === "risk").reduce((s, a) => s + a.value, 0);
  const totalValue = accounts.reduce((s, a) => s + a.value, 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Healthy", value: counts.healthy, color: "#16A34A" },
          { label: "Watch", value: counts.watch, color: "#D97706" },
          { label: "At risk", value: counts.risk, color: "#DC2626" },
          { label: "ARR at risk", value: formatMoney(atRiskValue), color: INK, isText: true },
        ].map((stat) => (
          <div key={stat.label} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: MUTED, marginBottom: 4 }}>{stat.label}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: stat.isText ? INK : stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {accounts.map((account) => {
          const score = computeHealthScore(account);
          const t = TIER_COLORS[scoreTier(score)];
          return (
            <button key={account.id} onClick={() => onOpenAccount(account)} style={{
              background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, textAlign: "left",
              cursor: "pointer", width: "100%", display: "flex", flexDirection: "column", gap: 12,
              boxShadow: "0 1px 3px rgba(10,10,10,0.03)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 15, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{account.name}</div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: MUTED, marginTop: 2 }}>{account.tier} · {formatMoney(account.value)} ARR</div>
                </div>
                <ScoreRing score={score} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: t.color, background: t.bg, padding: "3px 10px", borderRadius: 20 }}>{t.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><TrendIcon trend={account.trend} /><TrajectoryStrip trend={account.trend} /></div>
              </div>
              {account.renewalDate && renewalLabel(account.renewalDate)?.urgent && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "'Inter', sans-serif", fontSize: 11, color: RISK, fontWeight: 600 }}>
                  <CalendarClock size={12} /> {renewalLabel(account.renewalDate).text}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 22, fontFamily: "'Inter', sans-serif", fontSize: 12, color: MUTED }}>
        Portfolio ARR: {formatMoney(totalValue)} across {accounts.length} accounts. All figures are fictional.
      </div>
    </div>
  );
}

function HealthDetailPanel({ account, onClose, onDelete, onAddAction, existingActions }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionAdded, setActionAdded] = useState(false);
  const score = computeHealthScore(account);
  const t = TIER_COLORS[scoreTier(score)];

  async function generateInsight() {
    setLoading(true); setError(null); setActionAdded(false);
    try {
      const metricsSummary = METRIC_DEFS.map((d) => `${d.label}: ${account.metrics[d.key]}${d.suffix}`).join(", ");
      const prompt = `You are a customer success assistant for a B2B sales intelligence data platform (in the spirit of Lusha). Given this customer account, write a JSON object with "summary" (2-3 sentences) and "recommendation" (1 sentence). Respond with ONLY valid JSON.

Account: ${account.name} (${account.tier}, ${formatMoney(account.value)} ARR)
Health score: ${score}/100 (${t.label})
Metrics: ${metricsSummary}
Notes: ${account.healthNotes}
Trend (oldest to newest): ${account.trend.join(", ")}`;
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "API error");
      setInsight({ ...JSON.parse(data.text.replace(/```json|```/g, "").trim()), generatedAt: Date.now() });
    } catch (e) {
      const fallback = FALLBACK_INSIGHTS[account.id];
      if (fallback) setInsight({ ...fallback, isFallback: true, generatedAt: Date.now() });
      else setError("Couldn't generate an insight right now.");
    } finally { setLoading(false); }
  }

  const alreadyLogged = insight && (actionAdded || (existingActions || []).some((a) => a.text === insight.recommendation));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", justifyContent: "flex-end", zIndex: 60 }} onClick={onClose}>
      <div style={{ width: "min(440px, 100%)", height: "100%", background: PANEL, borderLeft: `1px solid ${BORDER}`, padding: 26, overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 19, color: INK }}>{account.name}</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: MUTED, marginTop: 2 }}>{account.tier} · {formatMoney(account.value)} ARR</div>
            {account.renewalDate && (() => {
              const renewal = renewalLabel(account.renewalDate);
              return <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: renewal.urgent ? RISK : MUTED, fontWeight: renewal.urgent ? 700 : 400, marginTop: 4 }}>{renewal.text}</div>;
            })()}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {account.isCustom && <button onClick={() => onDelete(account.id)} style={{ display: "flex", alignItems: "center", gap: 5, background: "#FEF2F2", border: "1px solid #DC2626", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#DC2626", fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600 }}><Trash2 size={13} /> Remove</button>}
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED }}><X size={20} /></button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 26 }}>
          <ScoreRing score={score} />
          <div><span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: t.color, background: t.bg, padding: "3px 10px", borderRadius: 20 }}>{t.label}</span><div style={{ marginTop: 8 }}><TrajectoryStrip trend={account.trend} /></div></div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: INK, marginBottom: 12, letterSpacing: 0.4, textTransform: "uppercase" }}>Lusha usage metrics</div>
          {METRIC_DEFS.map((def) => <MetricRow key={def.key} def={def} value={account.metrics[def.key]} />)}
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: INK, marginBottom: 8, letterSpacing: 0.4, textTransform: "uppercase" }}>Latest note</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#374151", lineHeight: 1.55 }}>{account.healthNotes}</div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: INK, letterSpacing: 0.4, textTransform: "uppercase" }}>AI Insight</div>
            {!insight && <button onClick={generateInsight} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, background: VIOLET, color: "#FFFFFF", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "'Inter', sans-serif", opacity: loading ? 0.7 : 1 }}>{loading ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}{loading ? "Generating…" : "Generate insight"}</button>}
          </div>
          {error && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#DC2626" }}>{error}</div>}
          {insight && (
            <div style={{ background: "#FAFAFB", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                {insight.isFallback ? <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: MUTED, letterSpacing: 0.3, textTransform: "uppercase" }}>Example output</div> : <div />}
                {insight.generatedAt && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: MUTED }}>Generated {formatDate(insight.generatedAt)}</div>}
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#374151", lineHeight: 1.55, marginBottom: 12 }}>{insight.summary}</div>
              <div style={{ display: "flex", gap: 8, borderTop: `1px solid ${BORDER}`, paddingTop: 12, marginBottom: 10 }}><ChevronRight size={14} color={VIOLET} style={{ marginTop: 2, flexShrink: 0 }} /><div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: INK, fontWeight: 600, lineHeight: 1.5 }}>{insight.recommendation}</div></div>
              <button
                onClick={() => { onAddAction(insight.recommendation); setActionAdded(true); }}
                disabled={alreadyLogged}
                style={{
                  display: "flex", alignItems: "center", gap: 6, background: "none",
                  border: `1px solid ${alreadyLogged ? "#DCEFE2" : VIOLET}`, borderRadius: 8, padding: "6px 12px",
                  fontSize: 11, fontWeight: 600, color: alreadyLogged ? "#16A34A" : VIOLET,
                  cursor: alreadyLogged ? "default" : "pointer", fontFamily: "'Inter', sans-serif",
                }}
              >
                {alreadyLogged ? <><Check size={12} /> Added to Action Log</> : <><Plus size={12} /> Add to Action Log</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EXPANSION TAB
// ---------------------------------------------------------------------------

function ExpansionTab({ account, healthScore, healthTier, allSignals, allStakeholders, onAddSignal, onAddStakeholder, onDeleteStakeholder, showAddSignalForm, setShowAddSignalForm, showAddStakeholderForm, setShowAddStakeholderForm, onAddAction, existingActions }) {
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionAdded, setActionAdded] = useState(false);
  const alertSignals = useMemo(() => allSignals.filter((s) => ALERT_SIGNAL_TYPES.includes(s.type)), [allSignals]);
  const tierMeta = TIER_COLORS[healthTier];

  async function generateBrief() {
    setLoading(true); setError(null); setActionAdded(false);
    try {
      const signalsText = allSignals.map((s) => `- [${SIGNAL_STYLES[s.type].label}] ${s.detail} (${s.when})`).join("\n");
      const stakeholdersText = allStakeholders.map((s) => `- ${s.name}, ${s.role}, influence: ${s.influence}, sentiment: ${s.sentiment}`).join("\n");
      const prompt = `You are a GTM/account expansion strategist assistant for an account manager working an existing customer account. This account's current product health score is ${healthScore}/100 (${tierMeta.label} tier), based on usage data. Use this health context to calibrate your recommendation: if the tier is "At Risk", do not recommend an expansion push, prioritize retention and stability instead; if "Watch", be cautious and balanced; if "Healthy", a confident growth angle is appropriate.

Given the account's recent signals and known stakeholders, produce an expansion brief. Respond with ONLY valid JSON (no markdown fences, no preamble):
{
  "opportunitySummary": "2-3 sentences on the opportunity or risk, grounded in the specific signals AND the health score context",
  "priorityStakeholders": [
    {
      "name": "exact name from the list",
      "reason": "1 sentence, internal reasoning only",
      "emailSubject": "short natural subject line",
      "emailBody": "complete client-facing email, under 120 words, no internal reasoning or jargon, natural sentences, no em dashes, ending with an OPEN-ENDED scheduling question like 'When would be a good time...' never a closed yes/no question, signed '[Your name]'"
    }
  ],
  "dealAngle": "1-2 sentences, internal only, calibrated to the health tier",
  "nextBestAction": "1 concrete next step, internal only",
  "healthContext": "1 sentence explicitly referencing the health score/tier and how it shapes this recommendation"
}
Pick 1-2 priorityStakeholders maximum, only from the list provided. Each stakeholder must appear AT MOST ONCE — never list the same person twice, even if there are multiple distinct reasons to reach out to them; if that happens, merge all reasons into a single combined entry with one email for that person. If the account has only one stakeholder on record, return exactly one priorityStakeholders entry, not two.

Account: ${account.name} (${account.tier}, ARR $${account.value.toLocaleString()})
Health score: ${healthScore}/100 (${tierMeta.label})
${account.renewalDate ? `Renewal date: ${account.renewalDate} (${daysUntil(account.renewalDate)} days from now)` : ""}
Signals:
${signalsText}
Known stakeholders:
${stakeholdersText}`;
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "API error");
      const parsedBrief = JSON.parse(data.text.replace(/```json|```/g, "").trim());
      if (Array.isArray(parsedBrief.priorityStakeholders)) {
        const byName = {};
        parsedBrief.priorityStakeholders.forEach((p) => {
          if (byName[p.name]) {
            byName[p.name].reason += ` Also: ${p.reason}`;
          } else {
            byName[p.name] = { ...p };
          }
        });
        parsedBrief.priorityStakeholders = Object.values(byName);
      }
      setBrief({ ...parsedBrief, generatedAt: Date.now() });
    } catch (e) {
      const fallback = FALLBACK_BRIEFS[account.id];
      if (fallback) setBrief({ ...fallback, isFallback: true, generatedAt: Date.now() });
      else setError("Couldn't generate the brief right now.");
    } finally { setLoading(false); }
  }

  return (
    <div>
      {alertSignals.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "11px 16px", background: "linear-gradient(90deg, #FEF2F2, #FFF7ED)", border: "1px solid #FBC7C7", borderRadius: 10 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <Bell size={16} color={RISK} />
            <span style={{ position: "absolute", top: -3, right: -3, width: 6, height: 6, borderRadius: "50%", background: RISK, animation: "pulse 1.8s ease-in-out infinite" }} />
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: INK }}>
            <span style={{ fontWeight: 700 }}>{alertSignals.length} signal{alertSignals.length > 1 ? "s" : ""}</span> on {account.name} need{alertSignals.length === 1 ? "s" : ""} your attention
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "9px 14px", background: tierMeta.bg, borderRadius: 10 }}>
        <div style={{ width: 12, height: 12, borderRadius: 3, background: tierMeta.color, flexShrink: 0 }} />
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: INK }}>
          <span style={{ fontWeight: 700 }}>Health context:</span> this account is <span style={{ fontWeight: 700, color: tierMeta.color }}>{tierMeta.label}</span> ({healthScore}/100), the brief below will be calibrated accordingly
        </span>
      </div>

      {account.renewalDate && (() => {
        const renewal = renewalLabel(account.renewalDate);
        return (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "9px 14px",
            background: renewal.urgent ? "#FEF2F2" : "#F0F0F2", borderRadius: 10,
          }}>
            <CalendarClock size={14} color={renewal.urgent ? RISK : MUTED} style={{ flexShrink: 0 }} />
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: renewal.urgent ? RISK : INK, fontWeight: renewal.urgent ? 700 : 400 }}>
              {renewal.text}{renewal.urgent && " — approaching, worth raising in this cycle's plan"}
            </span>
          </div>
        );
      })()}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: BLUE_CHIP, flexShrink: 0 }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, color: INK, letterSpacing: 0.4, textTransform: "uppercase" }}>Signals</span>
            </div>
            <button onClick={() => setShowAddSignalForm(!showAddSignalForm)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: VIOLET, fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600 }}><Plus size={13} /> Add</button>
          </div>
          {showAddSignalForm && <AddSignalForm onCancel={() => setShowAddSignalForm(false)} onSave={onAddSignal} />}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: showAddSignalForm ? 12 : 0 }}>
            {allSignals.length === 0 ? <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: MUTED, fontStyle: "italic" }}>No signals recorded yet.</div> : allSignals.map((s, i) => <SignalCard key={s.id || i} signal={s} />)}
          </div>
        </div>

        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: PINK_CHIP, flexShrink: 0 }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, color: INK, letterSpacing: 0.4, textTransform: "uppercase" }}>Stakeholder Map</span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={() => setShowGraphModal(true)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED }}><Maximize2 size={13} /></button>
              <button onClick={() => setShowAddStakeholderForm(!showAddStakeholderForm)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: VIOLET, fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600 }}><Plus size={13} /> Add</button>
            </div>
          </div>
          <div onClick={() => allStakeholders.length > 0 && setShowGraphModal(true)} style={{ cursor: allStakeholders.length > 0 ? "zoom-in" : "default" }}>
            {allStakeholders.length === 0 ? (
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: MUTED, fontStyle: "italic", padding: "30px 0", textAlign: "center" }}>No stakeholders mapped yet.</div>
            ) : (
              <>
                <StakeholderGraph account={account} stakeholders={allStakeholders} scale={1} />
                <StakeholderRoster stakeholders={allStakeholders} compact />
              </>
            )}
          </div>
          <SentimentLegend accountName={account.name} />
          {showAddStakeholderForm && <AddStakeholderForm onCancel={() => setShowAddStakeholderForm(false)} onSave={onAddStakeholder} />}
        </div>
      </div>

      <button onClick={generateBrief} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 8, background: VIOLET, color: "#FFFFFF", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 13, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "'Inter', sans-serif", opacity: loading ? 0.75 : 1, marginBottom: 20 }}>
        {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} {loading ? "Generating expansion brief…" : "Generate expansion brief"}
      </button>

      {error && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: RISK, marginBottom: 20 }}>{error}</div>}

      {brief && (
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24 }}>
          {brief.isFallback && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: MUTED, marginBottom: 6, letterSpacing: 0.3, textTransform: "uppercase" }}>Example output</div>}
          {brief.generatedAt && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: MUTED, marginBottom: 14 }}>Generated {formatDate(brief.generatedAt)}</div>}
          {brief.healthContext && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: tierMeta.bg, padding: 12, borderRadius: 8, marginBottom: 18 }}>
              <Radar size={14} color={tierMeta.color} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: INK, lineHeight: 1.5, fontStyle: "italic" }}>{brief.healthContext}</div>
            </div>
          )}
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: INK, lineHeight: 1.6, marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${BORDER}` }}>{brief.opportunitySummary}</div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}><Users size={14} color={VIOLET} /><span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, color: INK, letterSpacing: 0.4, textTransform: "uppercase" }}>Priority stakeholders</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(brief.priorityStakeholders || []).map((p, i) => {
                const contact = allStakeholders.find((s) => s.name === p.name);
                const firstName = p.name.split(" ")[0];
                const subject = p.emailSubject || `Quick note re: ${account.name}`;
                const draftBody = p.emailBody || `Hi ${firstName},\n\nHope you're doing well. I wanted to reach out and see when might work for a quick 15-20 minute call sometime this week or next. Happy to work around your schedule.\n\nLooking forward to connecting.\n\nBest,\n[Your name]`;
                return <PriorityStakeholderCard key={i} person={p} contact={contact} subject={subject} body={draftBody} />;
              })}
            </div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}><Briefcase size={14} color={VIOLET} /><span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, color: INK, letterSpacing: 0.4, textTransform: "uppercase" }}>Deal angle</span></div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: INK, lineHeight: 1.5 }}>{brief.dealAngle}</div>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}><ArrowUpRight size={14} color={VIOLET} /><span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, color: INK, letterSpacing: 0.4, textTransform: "uppercase" }}>Next best action</span></div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: INK, fontWeight: 600, lineHeight: 1.5, background: "#F5F0FF", padding: 14, borderRadius: 10, border: "1px solid #E0D4FA", marginBottom: 8 }}>{brief.nextBestAction}</div>
            <button
              onClick={() => { onAddAction(brief.nextBestAction); setActionAdded(true); }}
              disabled={actionAdded || (existingActions || []).some((a) => a.text === brief.nextBestAction)}
              style={{
                display: "flex", alignItems: "center", gap: 6, background: "none",
                border: `1px solid ${(actionAdded || (existingActions || []).some((a) => a.text === brief.nextBestAction)) ? "#DCEFE2" : VIOLET}`,
                borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 600,
                color: (actionAdded || (existingActions || []).some((a) => a.text === brief.nextBestAction)) ? "#16A34A" : VIOLET,
                cursor: (actionAdded || (existingActions || []).some((a) => a.text === brief.nextBestAction)) ? "default" : "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {(actionAdded || (existingActions || []).some((a) => a.text === brief.nextBestAction)) ? <><Check size={12} /> Added to Action Log</> : <><Plus size={12} /> Add to Action Log</>}
            </button>
          </div>
        </div>
      )}

      {showGraphModal && <GraphModal account={account} stakeholders={allStakeholders} onClose={() => setShowGraphModal(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MANAGER REPORT TAB — generates a manager-ready recap, either for the
// currently selected account or the whole portfolio, so the AM doesn't
// have to build the summary by hand before a 1:1 or pipeline review.
// ---------------------------------------------------------------------------

function ReportSection({ title, items, icon: Icon, color }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Icon size={14} color={color} />
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, color: INK, letterSpacing: 0.4, textTransform: "uppercase" }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(items || []).map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, marginTop: 6, flexShrink: 0 }} />
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: INK, lineHeight: 1.5 }}>{item}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressSection({ actions }) {
  if (!actions || actions.length === 0) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Check size={14} color="#16A34A" />
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, color: INK, letterSpacing: 0.4, textTransform: "uppercase" }}>Progress already made</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {actions.map((a, i) => (
          <div key={i}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#16A34A", marginTop: 6, flexShrink: 0 }} />
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: INK, fontWeight: 600, lineHeight: 1.5 }}>{a.text}</div>
            </div>
            {a.result && a.result.trim() && (
              <div style={{
                marginLeft: 13, marginTop: 6, background: "#F7FAF8", border: "1px solid #DCEFE2", borderRadius: 8,
                padding: "10px 12px", fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#374151",
                lineHeight: 1.6, whiteSpace: "pre-wrap",
              }}>
                {a.result.trim()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionLogPanel({ actions, onAdd, onToggle, onDelete, onUpdateResult }) {
  const [text, setText] = useState("");

  function handleAdd() {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  }

  const done = actions.filter((a) => a.done);
  const pending = actions.filter((a) => !a.done);

  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <Check size={14} color={VIOLET} />
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, color: INK, letterSpacing: 0.4, textTransform: "uppercase" }}>Action Log</span>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: MUTED }}>— track what's already been done, so reports don't repeat it</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="e.g. Business review with Marcus Webb"
          style={{ flex: 1, background: "#FAFAFB", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 10px", color: INK, fontFamily: "'Inter', sans-serif", fontSize: 13 }}
        />
        <button onClick={handleAdd} style={{
          display: "flex", alignItems: "center", gap: 5, background: VIOLET, color: "#FFFFFF", border: "none",
          borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif",
        }}>
          <Plus size={13} /> Add
        </button>
      </div>

      {actions.length === 0 ? (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: MUTED, fontStyle: "italic" }}>No actions logged yet for this account.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[...pending, ...done].map((a) => (
            <div key={a.id} style={{
              display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", borderRadius: 8,
              background: a.done ? "#F7FAF8" : "#FBFAFF", border: `1px solid ${a.done ? "#DCEFE2" : BORDER}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => onToggle(a.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0 }}>
                  {a.done ? <Check size={16} color="#16A34A" /> : <Circle size={16} color={MUTED} />}
                </button>
                <div style={{
                  flex: 1, fontFamily: "'Inter', sans-serif", fontSize: 13,
                  color: a.done ? MUTED : INK, textDecoration: a.done ? "line-through" : "none",
                }}>
                  {a.text}
                </div>
                <button onClick={() => onDelete(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>
              {a.done && (
                <textarea
                  defaultValue={a.result || ""}
                  placeholder="What was the result / outcome? (optional — paste a call summary, notes, etc.)"
                  onBlur={(e) => onUpdateResult(a.id, e.target.value)}
                  rows={2}
                  style={{
                    marginLeft: 26, background: "#FFFFFF", border: `1px solid #DCEFE2`, borderRadius: 6,
                    padding: "6px 9px", color: INK, fontFamily: "'Inter', sans-serif", fontSize: 12,
                    lineHeight: 1.5, resize: "vertical",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ManagerReportTab({ mode, setMode, account, healthScore, healthTier, allSignals, allStakeholders, allAccounts, actions, actionLogAll, onAddAction, onToggleAction, onDeleteAction, onUpdateActionResult }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState({});
  const [showHistory, setShowHistory] = useState(false);
  const tierMeta = TIER_COLORS[healthTier];

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORAGE_REPORT_HISTORY, false);
        if (r?.value) setHistory(JSON.parse(r.value));
      } catch (e) {}
    })();
  }, []);

  async function saveHistoryEntry(entry) {
    const key = mode === "single" ? account.id : "portfolio";
    const updated = { ...history, [key]: [entry, ...(history[key] || [])].slice(0, 10) };
    setHistory(updated);
    try { await window.storage.set(STORAGE_REPORT_HISTORY, JSON.stringify(updated), false); } catch (e) {}
  }

  async function deleteHistoryEntry(index) {
    const key = mode === "single" ? account.id : "portfolio";
    const updated = { ...history, [key]: (history[key] || []).filter((_, i) => i !== index) };
    setHistory(updated);
    try { await window.storage.set(STORAGE_REPORT_HISTORY, JSON.stringify(updated), false); } catch (e) {}
  }

  const historyKey = mode === "single" ? account.id : "portfolio";
  const historyEntries = history[historyKey] || [];

  const portfolioStats = useMemo(() => {
    if (mode !== "all" || !actionLogAll) return null;
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    let completedThisMonth = 0;
    const stagnant = [];
    allAccounts.forEach((a) => {
      const log = actionLogAll[a.id] || [];
      const doneEntries = log.filter((x) => x.done);
      let mostRecent = null;
      doneEntries.forEach((x) => {
        if (x.completedAt) {
          const d = new Date(x.completedAt);
          if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) completedThisMonth++;
          if (!mostRecent || d > mostRecent) mostRecent = d;
        }
      });
      if (doneEntries.length === 0) {
        stagnant.push({ name: a.name, reason: "no completed actions logged" });
      } else if (mostRecent) {
        const daysSince = Math.floor((now - mostRecent) / (1000 * 60 * 60 * 24));
        if (daysSince > 14) stagnant.push({ name: a.name, reason: `no activity in ${daysSince} days` });
      }
    });
    return { completedThisMonth, stagnant };
  }, [mode, actionLogAll, allAccounts]);

  async function generateReport() {
    setLoading(true); setError(null); setReport(null);
    try {
      let prompt;
      if (mode === "single") {
        const alertCount = allSignals.filter((s) => ALERT_SIGNAL_TYPES.includes(s.type)).length;
        const sentimentCounts = allStakeholders.reduce((acc, s) => { acc[s.sentiment] = (acc[s.sentiment] || 0) + 1; return acc; }, {});
        const doneActions = actions.filter((a) => a.done).map(formatDoneAction);
        const pendingActions = actions.filter((a) => !a.done).map((a) => a.text);
        prompt = `You are helping an account manager prepare a concise, manager-ready status update on a single account, to share in a 1:1 or pipeline review without needing to present it live. Write for the account manager's own manager: concise, results-oriented, no fluff. Respond with ONLY valid JSON (no markdown fences, no preamble):
{
  "executiveSummary": "2-3 sentences, covering overall status, and crediting progress already made if relevant",
  "keyPoints": ["3-4 short bullets covering health status, notable signals, and stakeholder situation"],
  "risksAndOpportunities": ["2-3 short bullets"],
  "recommendedActions": ["1-3 short, concrete NEW bullets — do not repeat anything already marked as done below"]
}
Account: ${account.name} (${account.tier}, ARR $${account.value.toLocaleString()})
Health score: ${healthScore}/100 (${tierMeta.label}), trend: ${account.trend.join(", ")}
Alert-level signals: ${alertCount}
Signals: ${allSignals.map((s) => `${SIGNAL_STYLES[s.type].label}: ${s.detail}`).join("; ") || "none recorded"}
Stakeholder sentiment breakdown: ${Object.entries(sentimentCounts).map(([k, v]) => `${v} ${k}`).join(", ") || "none mapped"}
Actions already completed: ${doneActions.join("; ") || "none logged yet"}
Actions still pending/logged but not done: ${pendingActions.join("; ") || "none logged"}`;
      } else {
        const summary = allAccounts.map((a) => {
          const s = computeHealthScore(a);
          const t = scoreTier(s);
          const alertCount = a.signals.filter((sig) => ALERT_SIGNAL_TYPES.includes(sig.type)).length;
          return `${a.name} (${a.tier}, $${a.value.toLocaleString()} ARR): score ${s}/100 (${TIER_COLORS[t].label}), ${alertCount} alert signal(s)`;
        }).join("\n");
        prompt = `You are helping an account manager prepare a concise, manager-ready portfolio-wide status update covering all their accounts, to share in a pipeline review without presenting it live. Write for the account manager's own manager: concise, results-oriented, no fluff. Respond with ONLY valid JSON (no markdown fences, no preamble):
{
  "executiveSummary": "2-3 sentences covering overall portfolio health",
  "keyPoints": ["3-4 short bullets, e.g. health tier distribution, ARR at risk, notable movers"],
  "risksAndOpportunities": ["2-3 short bullets naming specific accounts and why"],
  "recommendedActions": ["prioritized list of 2-4 short, concrete bullets across the portfolio"]
}
Portfolio (${allAccounts.length} accounts):
${summary}`;
      }

      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "API error");
      const parsed = JSON.parse(data.text.replace(/```json|```/g, "").trim());
      const ts = Date.now();
      setReport({ ...parsed, generatedAt: ts });
      saveHistoryEntry({
        timestamp: ts,
        score: mode === "single" ? healthScore : null,
        tier: mode === "single" ? tierMeta.label : null,
        summary: parsed.executiveSummary,
        fullReport: { ...parsed, generatedAt: ts },
      });
    } catch (e) {
      if (mode === "single") {
        const fallback = FALLBACK_REPORTS[account.id];
        if (fallback) {
          const ts = Date.now();
          setReport({ ...fallback, isFallback: true, generatedAt: ts });
          saveHistoryEntry({ timestamp: ts, score: healthScore, tier: tierMeta.label, summary: fallback.executiveSummary, isFallback: true, fullReport: { ...fallback, isFallback: true, generatedAt: ts } });
        } else setError("Couldn't generate the report right now.");
      } else {
        const isDefaultPortfolio = allAccounts.length === 4 && allAccounts.every((a) => !a.isCustom);
        if (isDefaultPortfolio) {
          const ts = Date.now();
          setReport({ ...FALLBACK_PORTFOLIO_REPORT, isFallback: true, generatedAt: ts });
          saveHistoryEntry({ timestamp: ts, score: null, tier: null, summary: FALLBACK_PORTFOLIO_REPORT.executiveSummary, isFallback: true, fullReport: { ...FALLBACK_PORTFOLIO_REPORT, isFallback: true, generatedAt: ts } });
        } else setError("Couldn't generate the report right now.");
      }
    } finally { setLoading(false); }
  }

  async function handleCopy() {
    if (!report) return;
    const doneActions = mode === "single" ? actions.filter((a) => a.done) : [];
    const progressLines = doneActions.flatMap((a) => {
      const lines = [`- ${a.text}`];
      if (a.result && a.result.trim()) {
        a.result.trim().split("\n").forEach((l) => lines.push(`    ${l}`));
      }
      return lines;
    });
    const lines = [
      mode === "single" ? `${account.name} — Status Update` : `Portfolio Status Update (${allAccounts.length} accounts)`,
      report.generatedAt ? `Generated ${formatDate(report.generatedAt)}` : "",
      "", report.executiveSummary, "",
      "Key points:", ...(report.keyPoints || []).map((p) => `- ${p}`), "",
      "Risks & opportunities:", ...(report.risksAndOpportunities || []).map((p) => `- ${p}`), "",
      "Recommended actions:", ...(report.recommendedActions || []).map((p) => `- ${p}`),
      ...(progressLines.length > 0 ? ["", "Progress already made:", ...progressLines] : []),
    ];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
      return;
    } catch (e) {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch (e) {}
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[
          { key: "single", label: `This account (${account.name})` },
          { key: "all", label: `All accounts (${allAccounts.length})` },
        ].map((m) => (
          <button key={m.key} onClick={() => { setMode(m.key); setReport(null); setError(null); }} style={{
            fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, padding: "9px 16px", borderRadius: 9, cursor: "pointer",
            border: mode === m.key ? `1px solid ${VIOLET}` : `1px solid ${BORDER}`,
            background: mode === m.key ? "#F0E9FF" : PANEL, color: mode === m.key ? INK : MUTED,
          }}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === "single" && (
        <ActionLogPanel actions={actions} onAdd={onAddAction} onToggle={onToggleAction} onDelete={onDeleteAction} onUpdateResult={onUpdateActionResult} />
      )}

      {mode === "all" && portfolioStats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 20 }}>
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: MUTED, marginBottom: 4 }}>Actions completed this month</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: "#16A34A" }}>{portfolioStats.completedThisMonth}</div>
          </div>
          <div style={{ background: portfolioStats.stagnant.length > 0 ? "#FEF6E7" : PANEL, border: `1px solid ${portfolioStats.stagnant.length > 0 ? "#F5D9A8" : BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: MUTED, marginBottom: 6 }}>Accounts needing attention</div>
            {portfolioStats.stagnant.length === 0 ? (
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#16A34A", fontWeight: 600 }}>None — all accounts have recent activity</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {portfolioStats.stagnant.map((s, i) => (
                  <div key={i} style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#B45309" }}>
                    <span style={{ fontWeight: 700 }}>{s.name}</span> — {s.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
        <button onClick={generateReport} disabled={loading} style={{
          display: "flex", alignItems: "center", gap: 8, background: VIOLET, color: "#FFFFFF", border: "none",
          borderRadius: 10, padding: "12px 20px", fontSize: 13, fontWeight: 700, cursor: loading ? "default" : "pointer",
          fontFamily: "'Inter', sans-serif", opacity: loading ? 0.75 : 1,
        }}>
          {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
          {loading ? "Generating report…" : mode === "single" ? "Generate account recap" : "Generate portfolio recap"}
        </button>
        {historyEntries.length > 0 && (
          <button onClick={() => setShowHistory(!showHistory)} style={{
            display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${BORDER}`,
            borderRadius: 10, padding: "10px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: MUTED, fontFamily: "'Inter', sans-serif",
          }}>
            {showHistory ? "Hide history" : `View history (${historyEntries.length})`}
          </button>
        )}
      </div>

      {showHistory && historyEntries.length > 0 && (
        <div style={{ background: "#FAFAFB", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: INK, marginBottom: 12, letterSpacing: 0.4, textTransform: "uppercase" }}>Past reports</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {historyEntries.map((h, i) => {
              const prev = historyEntries[i + 1];
              const delta = mode === "single" && h.score != null && prev?.score != null ? h.score - prev.score : null;
              return (
                <div
                  key={i}
                  onClick={() => { if (h.fullReport) { setReport(h.fullReport); setShowHistory(false); } }}
                  style={{
                    display: "flex", gap: 12, alignItems: "flex-start", paddingBottom: 10,
                    borderBottom: i < historyEntries.length - 1 ? `1px solid ${BORDER}` : "none",
                    cursor: h.fullReport ? "pointer" : "default", borderRadius: 8, padding: "6px 8px", margin: "-6px -8px 4px",
                  }}
                  onMouseEnter={(e) => { if (h.fullReport) e.currentTarget.style.background = "#F0E9FF"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  {mode === "single" && h.score != null && <ScoreRing score={h.score} size={34} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: MUTED }}>
                        {new Date(h.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {delta != null && (
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700 }}>
                            {delta > 0 ? <span style={{ color: "#16A34A" }}>+{delta}</span> : delta < 0 ? <span style={{ color: "#DC2626" }}>{delta}</span> : <span style={{ color: MUTED }}>±0</span>}
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteHistoryEntry(i); }}
                          title="Delete this report"
                          style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex", padding: 0 }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{h.summary}</div>
                    {h.fullReport && (
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: VIOLET, fontWeight: 600, marginTop: 4 }}>View full report →</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: RISK, marginBottom: 20 }}>{error}</div>}

      {report && (
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, color: INK }}>
                {mode === "single" ? `${account.name} — Status Update` : `Portfolio Status Update`}
              </div>
              {report.generatedAt && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: MUTED, marginTop: 2 }}>Generated {formatDate(report.generatedAt)}</div>}
            </div>
            <button onClick={handleCopy} style={{
              display: "flex", alignItems: "center", gap: 6, background: copied ? "#DCFCE7" : "#F5F0FF",
              color: copied ? "#16A34A" : VIOLET, border: `1px solid ${copied ? "#BBF7D0" : "#E0D4FA"}`, borderRadius: 8,
              padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif", flexShrink: 0,
            }}>
              <Copy size={12} /> {copied ? "Copied ✓" : "Copy report"}
            </button>
          </div>

          {report.isFallback && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: MUTED, marginBottom: 14, letterSpacing: 0.3, textTransform: "uppercase" }}>Example output</div>}

          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: INK, lineHeight: 1.6, marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${BORDER}` }}>
            {report.executiveSummary}
          </div>

          <ReportSection title="Key points" items={report.keyPoints} icon={FileText} color={VIOLET} />
          <ReportSection title="Risks & opportunities" items={report.risksAndOpportunities} icon={AlertTriangle} color="#D97706" />
          <ReportSection title="Recommended actions" items={report.recommendedActions} icon={ArrowUpRight} color="#16A34A" />
          {mode === "single" && actions.filter((a) => a.done).length > 0 && (
            <ProgressSection actions={actions.filter((a) => a.done)} />
          )}
        </div>
      )}

      {!report && !error && (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: MUTED, textAlign: "center", padding: 24 }}>
          Generates a ready-to-share status update, no need to present it live.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CALL INTELLIGENCE TAB — records/transcribes a call (with real speaker
// diarization via AssemblyAI), analyzes it via Claude, and saves every
// analyzed call to a persistent, per-account call history so past
// conversations stay accessible.
// ---------------------------------------------------------------------------

function SentimentBadge({ sentiment, score }) {
  const config = {
    positive: { icon: Smile, color: "#16A34A", bg: "#EAFBF1", label: "Positive" },
    neutral: { icon: Meh, color: "#D97706", bg: "#FEF6E7", label: "Neutral" },
    negative: { icon: Frown, color: "#DC2626", bg: "#FEEDED", label: "Negative" },
  }[sentiment] || { icon: Meh, color: MUTED, bg: "#F0F0F2", label: "Unknown" };
  const Icon = config.icon;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: config.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} color={config.color} />
      </div>
      <div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 13, color: INK }}>{config.label}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: MUTED }}>{score}/100</div>
      </div>
    </div>
  );
}

function CallAnalysisCard({ analysis, onAddAction, existingActions }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addedItems, setAddedItems] = useState(new Set());

  async function handleCopy() {
    const lines = [
      `Call analysis — ${{ positive: "Positive", neutral: "Neutral", negative: "Negative" }[analysis.sentiment] || "Unknown"} (${analysis.sentimentScore}/100)`,
      "", analysis.summary, "",
      "Topics: " + (analysis.topics || []).join(", "), "",
      "Action items:", ...(analysis.actionItems || []).map((p) => `- ${p}`), "",
      "Risk signals:", ...((analysis.riskSignals && analysis.riskSignals.length ? analysis.riskSignals : ["None identified this call"]).map((p) => `- ${p}`)),
    ];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
      return;
    } catch (e) {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch (e) {}
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          {analysis.isFallback && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: MUTED, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 2 }}>Example output</div>}
          {analysis.timestamp && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: MUTED }}>{formatDate(analysis.timestamp)}</div>}
        </div>
        <button onClick={handleCopy} style={{
          display: "flex", alignItems: "center", gap: 5, marginLeft: "auto",
          background: copied ? "#DCFCE7" : "#F5F0FF", color: copied ? "#16A34A" : VIOLET,
          border: `1px solid ${copied ? "#BBF7D0" : "#E0D4FA"}`, borderRadius: 8, padding: "5px 10px",
          fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif", flexShrink: 0,
        }}>
          <Copy size={11} /> {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <SentimentBadge sentiment={analysis.sentiment} score={analysis.sentimentScore} />
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#374151", lineHeight: 1.6, margin: "14px 0" }}>{analysis.summary}</div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><Tag size={12} color={VIOLET} /><span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, color: INK, letterSpacing: 0.4, textTransform: "uppercase" }}>Topics</span></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(analysis.topics || []).map((topic, i) => (
            <span key={i} style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: VIOLET, background: "#F5F0FF", padding: "3px 9px", borderRadius: 20 }}>{topic}</span>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><ListChecks size={12} color="#16A34A" /><span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, color: INK, letterSpacing: 0.4, textTransform: "uppercase" }}>Action items</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(analysis.actionItems || []).map((item, i) => {
            const isAdded = addedItems.has(i) || (existingActions || []).some((a) => a.text === item);
            return (
              <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 7, alignItems: "flex-start", flex: 1 }}>
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#16A34A", marginTop: 6, flexShrink: 0 }} />
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: INK, lineHeight: 1.5 }}>{item}</div>
                </div>
                {onAddAction && (
                  <button
                    onClick={() => { onAddAction(item); setAddedItems((prev) => new Set(prev).add(i)); }}
                    disabled={isAdded}
                    title={isAdded ? "Added to Action Log" : "Add to Action Log"}
                    style={{ background: "none", border: "none", cursor: isAdded ? "default" : "pointer", color: isAdded ? "#16A34A" : MUTED, flexShrink: 0, display: "flex" }}
                  >
                    {isAdded ? <Check size={13} /> : <Plus size={13} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><AlertOctagon size={12} color={RISK} /><span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, color: INK, letterSpacing: 0.4, textTransform: "uppercase" }}>Risk signals</span></div>
        {(!analysis.riskSignals || analysis.riskSignals.length === 0 || (analysis.riskSignals.length === 1 && /none/i.test(analysis.riskSignals[0]))) ? (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: MUTED, fontStyle: "italic" }}>None identified this call.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {analysis.riskSignals.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: RISK, marginTop: 6, flexShrink: 0 }} />
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: INK, lineHeight: 1.5 }}>{item}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {analysis.transcript && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
          <button onClick={() => setShowTranscript(!showTranscript)} style={{
            display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer",
            color: MUTED, fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, padding: 0,
          }}>
            <ChevronDown size={12} style={{ transform: showTranscript ? "rotate(180deg)" : "none" }} />
            {showTranscript ? "Hide transcript" : "View transcript"}
          </button>
          {showTranscript && (
            <div style={{
              marginTop: 10, background: "#FAFAFB", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12,
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#374151", lineHeight: 1.6,
              whiteSpace: "pre-wrap", maxHeight: 260, overflowY: "auto",
            }}>
              {analysis.transcript}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CallIntelligenceTab({ account, callHistory, onSaveCall, onDeleteCall, onAddAction, existingActions }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [micSupported, setMicSupported] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [detectedSpeakers, setDetectedSpeakers] = useState([]);
  const [speakerMap, setSpeakerMap] = useState({});
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [expandedCallId, setExpandedCallId] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!navigator.mediaDevices || !window.MediaRecorder) setMicSupported(false);
  }, []);

  async function startRecording() {
    setError(null);
    setCurrentAnalysis(null);
    setTranscript("");
    setDetectedSpeakers([]);
    setSpeakerMap({});
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => handleRecordingStop(recorder.mimeType || mimeType || "audio/webm");
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (e) {
      setError("Couldn't access the microphone. Check your browser's mic permissions for this site.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
    }
  }

  async function handleRecordingStop(mimeType) {
    setIsTranscribing(true);
    setError(null);
    try {
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const response = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audioBase64: base64, mimeType }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Transcription failed");
      setTranscript(data.formattedTranscript);
      setDetectedSpeakers(data.speakers || []);
    } catch (e) {
      setError(e.message || "Transcription failed. Try recording again.");
    } finally { setIsTranscribing(false); }
  }

  function relabelSpeaker(rawLabel, newName) {
    const currentLabel = speakerMap[rawLabel] || rawLabel;
    setSpeakerMap((prev) => ({ ...prev, [rawLabel]: newName }));
    setTranscript((prev) => prev.replace(new RegExp(`^${currentLabel}:`, "gm"), `${newName}:`));
  }

  async function analyzeCall() {
    if (!transcript.trim()) { setError("Record a call first, or there's no transcript to analyze."); return; }
    setIsAnalyzing(true);
    setError(null);
    try {
      const prompt = `You are a call intelligence assistant for customer success teams. Analyze the call transcript below and respond with ONLY valid JSON (no markdown fences, no preamble):
{
  "sentiment": "positive" | "neutral" | "negative",
  "sentimentScore": <integer 0-100>,
  "summary": "2-3 sentences summarizing the call",
  "topics": ["short topic", "short topic", "short topic"],
  "actionItems": ["short action item", "short action item"],
  "riskSignals": ["short risk signal", "short risk signal"]
}
If there are no risk signals, use a single item stating "None identified this call".

Account: ${account.name} (${account.tier})
Transcript:
${transcript}`;
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "API error");
      const parsed = JSON.parse(data.text.replace(/```json|```/g, "").trim());
      const ts = Date.now();
      setCurrentAnalysis({ ...parsed, transcript, timestamp: ts });
      onSaveCall({ id: `call-${ts}`, timestamp: ts, transcript, ...parsed });
    } catch (e) {
      const fallback = FALLBACK_CALL_ANALYSIS[account.id];
      if (fallback) {
        const ts = Date.now();
        const withFlag = { ...fallback, isFallback: true, transcript, timestamp: ts };
        setCurrentAnalysis(withFlag);
        onSaveCall({ id: `call-${ts}`, timestamp: ts, transcript, ...withFlag });
      } else {
        setError("Couldn't analyze the call right now.");
      }
    } finally { setIsAnalyzing(false); }
  }

  function handleClear() {
    setTranscript(""); setDetectedSpeakers([]); setSpeakerMap({}); setCurrentAnalysis(null); setError(null);
  }

  function loadExample() {
    const example = EXAMPLE_TRANSCRIPTS[account.id];
    if (!example) return;
    setTranscript(example);
    setDetectedSpeakers([]);
    setSpeakerMap({});
    setCurrentAnalysis(null);
    setError(null);
    setShowTranscript(true);
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <PhoneCall size={14} color={VIOLET} />
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, color: INK, letterSpacing: 0.4, textTransform: "uppercase" }}>New call</span>
          </div>

          {micSupported ? (
            <button onClick={isRecording ? stopRecording : startRecording} disabled={isTranscribing} style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "center",
              background: isRecording ? RISK : VIOLET, color: "#FFFFFF", border: "none", borderRadius: 10,
              padding: "12px 16px", fontSize: 13, fontWeight: 700, cursor: isTranscribing ? "default" : "pointer",
              fontFamily: "'Inter', sans-serif", opacity: isTranscribing ? 0.6 : 1, marginBottom: 10,
            }}>
              {isTranscribing ? <Loader2 size={15} className="spin" /> : isRecording ? <Square size={15} /> : <Mic size={15} />}
              {isTranscribing ? "Transcribing…" : isRecording ? "Stop recording" : "Record live"}
            </button>
          ) : (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: MUTED, marginBottom: 10 }}>Live recording needs microphone access in this browser.</div>
          )}

          {EXAMPLE_TRANSCRIPTS[account.id] && (
            <button onClick={loadExample} style={{
              display: "flex", alignItems: "center", gap: 6, width: "100%", justifyContent: "center",
              background: "none", border: `1px dashed ${BORDER}`, borderRadius: 10, padding: "9px 16px",
              fontSize: 12, fontWeight: 600, color: MUTED, cursor: "pointer", fontFamily: "'Inter', sans-serif", marginBottom: 14,
            }}>
              Load example call
            </button>
          )}

          {detectedSpeakers.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: MUTED, marginBottom: 6, letterSpacing: 0.3, textTransform: "uppercase" }}>Label speakers</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {detectedSpeakers.map((rawLabel) => (
                  <div key={rawLabel} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: MUTED }}>{rawLabel}:</span>
                    <input
                      type="text" placeholder="e.g. CSM, Client…" defaultValue={speakerMap[rawLabel] || ""}
                      onKeyDown={(e) => { if (e.key === "Enter" && e.currentTarget.value.trim()) { relabelSpeaker(rawLabel, e.currentTarget.value.trim()); e.currentTarget.blur(); } }}
                      onBlur={(e) => { if (e.currentTarget.value.trim()) relabelSpeaker(rawLabel, e.currentTarget.value.trim()); }}
                      style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, padding: "4px 8px", borderRadius: 20, width: 120, border: `1px solid ${BORDER}`, background: "#FAFAFB", color: INK }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {transcript && (
            <div style={{ marginBottom: 14 }}>
              <button onClick={() => setShowTranscript(!showTranscript)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: MUTED, fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, padding: 0, marginBottom: 8 }}>
                <ChevronDown size={12} style={{ transform: showTranscript ? "rotate(180deg)" : "none" }} /> {showTranscript ? "Hide transcript" : "View / edit transcript"}
              </button>
              {showTranscript && (
                <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={7} style={{
                  width: "100%", background: "#FAFAFB", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10,
                  color: "#374151", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.6, resize: "vertical",
                }} />
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={analyzeCall} disabled={isAnalyzing || !transcript.trim()} style={{
              display: "flex", alignItems: "center", gap: 6, background: transcript.trim() ? VIOLET : "#D8D4EA", color: "#FFFFFF", border: "none",
              borderRadius: 8, padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: (isAnalyzing || !transcript.trim()) ? "default" : "pointer", fontFamily: "'Inter', sans-serif",
            }}>
              {isAnalyzing ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} {isAnalyzing ? "Analyzing…" : "Analyze call"}
            </button>
            {transcript && <button onClick={handleClear} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "9px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: MUTED, fontFamily: "'Inter', sans-serif" }}>Clear</button>}
          </div>
          {error && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: RISK, marginTop: 10 }}>{error}</div>}
        </div>

        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, color: INK, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 12 }}>Latest analysis</div>
          {currentAnalysis ? <CallAnalysisCard analysis={currentAnalysis} onAddAction={onAddAction} existingActions={existingActions} /> : (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: MUTED, textAlign: "center", padding: "30px 0" }}>Record and analyze a call to see the breakdown here.</div>
          )}
        </div>
      </div>

      <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
          <PhoneCall size={14} color={VIOLET} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, color: INK, letterSpacing: 0.4, textTransform: "uppercase" }}>Call history — {account.name}</span>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: MUTED }}>({callHistory.length})</span>
        </div>
        {callHistory.length === 0 ? (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: MUTED, fontStyle: "italic" }}>No calls logged yet for this account.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {callHistory.slice().reverse().map((call) => {
              const isExpanded = expandedCallId === call.id;
              return (
                <div key={call.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
                  <div
                    onClick={() => setExpandedCallId(isExpanded ? null : call.id)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer", background: isExpanded ? "#F5F0FF" : "#FBFAFF" }}
                  >
                    <SentimentBadge sentiment={call.sentiment} score={call.sentimentScore} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: MUTED, marginBottom: 2 }}>
                        {new Date(call.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{call.summary}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteCall(call.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, flexShrink: 0 }}>
                      <Trash2 size={13} />
                    </button>
                    <ChevronDown size={14} color={MUTED} style={{ transform: isExpanded ? "rotate(180deg)" : "none", flexShrink: 0 }} />
                  </div>
                  {isExpanded && (
                    <div style={{ padding: 16, borderTop: `1px solid ${BORDER}` }}>
                      <CallAnalysisCard analysis={call} onAddAction={onAddAction} existingActions={existingActions} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QBR TAB — the client-facing section. Raw meeting notes go in, a
// structured, client-ready business review comes out, with a copy button
// to paste directly into an email or document sent to the client.
// ---------------------------------------------------------------------------

function QBRSection({ title, items, icon: Icon, color }) {
  const isEmpty = !items || items.length === 0 || (items.length === 1 && /^none/i.test(items[0]));
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Icon size={14} color={color} />
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, color: INK, letterSpacing: 0.4, textTransform: "uppercase" }}>{title}</span>
      </div>
      {isEmpty ? (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: MUTED, fontStyle: "italic" }}>None this cycle.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, marginTop: 6, flexShrink: 0 }} />
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: INK, lineHeight: 1.5 }}>{item}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QBRTab({ account, onAddAction, existingActions, qbrHistory, onSaveQBR, onDeleteQBR }) {
  const [notes, setNotes] = useState("");
  const [qbr, setQbr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [addedSteps, setAddedSteps] = useState(new Set());
  const [expandedQbrId, setExpandedQbrId] = useState(null);

  useEffect(() => {
    setNotes("");
    setQbr(null);
    setError(null);
    setAddedSteps(new Set());
  }, [account.id]);

  function loadExample() {
    const example = EXAMPLE_QBR_NOTES[account.id];
    if (!example) return;
    setNotes(example);
    setQbr(null);
    setError(null);
  }

  function handleClear() {
    setNotes("");
    setQbr(null);
    setError(null);
  }

  async function generateQBR() {
    if (!notes.trim()) { setError("Add some meeting notes first, or load the example."); return; }
    setLoading(true);
    setError(null);
    setAddedSteps(new Set());
    try {
      const prompt = `You are a customer success assistant. Turn the raw, unstructured QBR meeting notes below into a formal, client-ready quarterly business review. This document may be shared directly with the client, so keep it professional, factual, and free of internal jargon, sentiment labels, or health-score references. Respond with ONLY valid JSON (no markdown fences, no preamble):
{
  "executiveSummary": "2-3 sentences, professional tone",
  "wins": ["short bullet", "short bullet"],
  "risks": ["short bullet, phrased constructively", "short bullet"],
  "nextSteps": ["short bullet", "short bullet", "short bullet"],
  "renewalOutlook": "one sentence on renewal/expansion outlook, internal framing is fine here"
}
If there are no wins or no risks, use a single item stating "None this cycle" for that field.

Account: ${account.name} (${account.tier})
Raw meeting notes: ${notes}`;
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "API error");
      const parsed = JSON.parse(data.text.replace(/```json|```/g, "").trim());
      const ts = Date.now();
      const full = { ...parsed, generatedAt: ts };
      setQbr(full);
      onSaveQBR({ id: `qbr-${ts}`, timestamp: ts, notes, ...full });
    } catch (e) {
      const fallback = FALLBACK_QBR[account.id];
      if (fallback && notes.trim() === (EXAMPLE_QBR_NOTES[account.id] || "").trim()) {
        const ts = Date.now();
        const full = { ...fallback, isFallback: true, generatedAt: ts };
        setQbr(full);
        onSaveQBR({ id: `qbr-${ts}`, timestamp: ts, notes, ...full });
      } else {
        setError("Couldn't generate the QBR right now.");
      }
    } finally { setLoading(false); }
  }

  async function handleCopy() {
    if (!qbr) return;
    const lines = [
      `${account.name} — Quarterly Business Review`,
      qbr.generatedAt ? `Prepared ${formatDate(qbr.generatedAt)}` : "", "",
      qbr.executiveSummary, "",
      "Wins:", ...(qbr.wins || []).map((p) => `- ${p}`), "",
      "Areas to address:", ...(qbr.risks || []).map((p) => `- ${p}`), "",
      "Next steps:", ...(qbr.nextSteps || []).map((p) => `- ${p}`),
    ];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
      return;
    } catch (e) {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch (e) {}
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "9px 14px", background: "#F5F0FF", borderRadius: 10 }}>
        <Presentation size={14} color={VIOLET} />
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: INK }}>
          This document is meant to be shared with <span style={{ fontWeight: 700 }}>{account.name}</span> — factual and client-ready, unlike the internal Manager Report.
        </span>
      </div>

      <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: MUTED, letterSpacing: 0.3, textTransform: "uppercase" }}>Raw meeting notes</label>
          <div style={{ display: "flex", gap: 12 }}>
            {EXAMPLE_QBR_NOTES[account.id] && (
              <button onClick={loadExample} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontFamily: "'Inter', sans-serif", fontSize: 11, padding: 0 }}>Load example notes</button>
            )}
            {notes && <button onClick={handleClear} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontFamily: "'Inter', sans-serif", fontSize: 11, padding: 0 }}>Clear</button>}
          </div>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Paste or type raw notes from the QBR call — messy is fine, that's the point."
          rows={6}
          style={{ width: "100%", background: "#FAFAFB", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, color: "#374151", fontFamily: "'Inter', sans-serif", fontSize: 13, lineHeight: 1.5, resize: "vertical", marginBottom: 14 }}
        />
        <button onClick={generateQBR} disabled={loading} style={{
          display: "flex", alignItems: "center", gap: 8, background: VIOLET, color: "#FFFFFF", border: "none",
          borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: loading ? "default" : "pointer",
          fontFamily: "'Inter', sans-serif", opacity: loading ? 0.75 : 1,
        }}>
          {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} {loading ? "Generating QBR…" : "Generate QBR"}
        </button>
      </div>

      {error && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: RISK, marginBottom: 20 }}>{error}</div>}

      {qbr && (
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ background: "#F5F0FF", borderBottom: `1px solid ${BORDER}`, padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Presentation size={16} color={VIOLET} />
              <div>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, color: INK }}>{account.name} — Business Review</div>
                {qbr.generatedAt && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: MUTED, marginTop: 2 }}>Prepared {formatDate(qbr.generatedAt)}</div>}
              </div>
            </div>
            <button onClick={handleCopy} style={{
              display: "flex", alignItems: "center", gap: 6, background: copied ? "#DCFCE7" : "#FFFFFF",
              color: copied ? "#16A34A" : VIOLET, border: `1px solid ${copied ? "#BBF7D0" : "#E0D4FA"}`, borderRadius: 8,
              padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif", flexShrink: 0,
            }}>
              <Copy size={12} /> {copied ? "Copied ✓" : "Copy for client"}
            </button>
          </div>
          <div style={{ padding: 22 }}>
            {qbr.isFallback && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: MUTED, marginBottom: 14, letterSpacing: 0.3, textTransform: "uppercase" }}>Example output</div>}
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: INK, lineHeight: 1.6, marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${BORDER}` }}>{qbr.executiveSummary}</div>
            <QBRSection title="Wins" items={qbr.wins} icon={TrendingUp} color="#16A34A" />
            <QBRSection title="Areas to address" items={qbr.risks} icon={AlertTriangle} color="#D97706" />
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <ArrowUpRight size={14} color={VIOLET} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, color: INK, letterSpacing: 0.4, textTransform: "uppercase" }}>Next steps</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(qbr.nextSteps || []).map((step, i) => {
                  const isAdded = addedSteps.has(i) || (existingActions || []).some((a) => a.text === step);
                  return (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flex: 1 }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: VIOLET, marginTop: 6, flexShrink: 0 }} />
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: INK, lineHeight: 1.5 }}>{step}</div>
                      </div>
                      {onAddAction && (
                        <button
                          onClick={() => { onAddAction(step); setAddedSteps((prev) => new Set(prev).add(i)); }}
                          disabled={isAdded}
                          title={isAdded ? "Added to Action Log" : "Add to Action Log"}
                          style={{ background: "none", border: "none", cursor: isAdded ? "default" : "pointer", color: isAdded ? "#16A34A" : MUTED, flexShrink: 0, display: "flex" }}
                        >
                          {isAdded ? <Check size={14} /> : <Plus size={14} />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ background: "#FAFAFB", borderTop: `2px dashed ${BORDER}`, padding: "16px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Briefcase size={13} color={MUTED} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 0.4, textTransform: "uppercase" }}>Internal only — not included in "Copy for client"</span>
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#374151", lineHeight: 1.5, fontStyle: "italic" }}>{qbr.renewalOutlook}</div>
          </div>
        </div>
      )}

      {!qbr && !error && (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: MUTED, textAlign: "center", padding: 24 }}>
          Add meeting notes, then generate a client-ready business review.
        </div>
      )}

      <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
          <Presentation size={14} color={VIOLET} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, color: INK, letterSpacing: 0.4, textTransform: "uppercase" }}>QBR history — {account.name}</span>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: MUTED }}>({(qbrHistory || []).length})</span>
        </div>
        {(!qbrHistory || qbrHistory.length === 0) ? (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: MUTED, fontStyle: "italic" }}>No QBRs generated yet for this account.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {qbrHistory.slice().reverse().map((entry) => {
              const isExpanded = expandedQbrId === entry.id;
              return (
                <div key={entry.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
                  <div
                    onClick={() => setExpandedQbrId(isExpanded ? null : entry.id)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer", background: isExpanded ? "#F5F0FF" : "#FBFAFF" }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: MUTED, marginBottom: 2 }}>{formatDate(entry.timestamp)}</div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.executiveSummary}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteQBR(entry.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, flexShrink: 0 }}>
                      <Trash2 size={13} />
                    </button>
                    <ChevronDown size={14} color={MUTED} style={{ transform: isExpanded ? "rotate(180deg)" : "none", flexShrink: 0 }} />
                  </div>
                  {isExpanded && (
                    <div style={{ padding: 16, borderTop: `1px solid ${BORDER}` }}>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: INK, lineHeight: 1.6, marginBottom: 18, paddingBottom: 18, borderBottom: `1px solid ${BORDER}` }}>{entry.executiveSummary}</div>
                      <QBRSection title="Wins" items={entry.wins} icon={TrendingUp} color="#16A34A" />
                      <QBRSection title="Areas to address" items={entry.risks} icon={AlertTriangle} color="#D97706" />
                      <QBRSection title="Next steps" items={entry.nextSteps} icon={ArrowUpRight} color={VIOLET} />
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${BORDER}` }}>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>Internal only</div>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#374151", fontStyle: "italic" }}>{entry.renewalOutlook}</div>
                      </div>
                      {entry.notes && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${BORDER}` }}>
                          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>Original raw notes</div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: MUTED, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{entry.notes}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN APP
// ---------------------------------------------------------------------------

const STORAGE_ACCOUNTS = "lusha-suite-custom-accounts";
const STORAGE_SIGNALS = "lusha-suite-custom-signals";
const STORAGE_STAKEHOLDERS = "lusha-suite-custom-stakeholders";
const STORAGE_ACTIONS = "lusha-suite-action-log";
const STORAGE_REPORT_HISTORY = "lusha-suite-report-history";
const STORAGE_CALL_HISTORY = "lusha-suite-call-history";
const STORAGE_QBR_HISTORY = "lusha-suite-qbr-history";

export default function LushaAccountSuite() {
  const [activeTab, setActiveTab] = useState("health");
  const [reportMode, setReportMode] = useState("single");
  const [accountId, setAccountId] = useState(ACCOUNTS[0].id);
  const [customAccounts, setCustomAccounts] = useState([]);
  const [customSignals, setCustomSignals] = useState({});
  const [customStakeholders, setCustomStakeholders] = useState({});
  const [actionLog, setActionLog] = useState({});
  const [callHistory, setCallHistory] = useState({});
  const [qbrHistory, setQbrHistory] = useState({});
  const [showAddAccountForm, setShowAddAccountForm] = useState(false);
  const [showAddSignalForm, setShowAddSignalForm] = useState(false);
  const [showAddStakeholderForm, setShowAddStakeholderForm] = useState(false);
  const [openHealthAccount, setOpenHealthAccount] = useState(null);

  useEffect(() => {
    (async () => {
      try { const r = await window.storage.get(STORAGE_ACCOUNTS, false); if (r?.value) setCustomAccounts(JSON.parse(r.value)); } catch (e) {}
      try { const r = await window.storage.get(STORAGE_SIGNALS, false); if (r?.value) setCustomSignals(JSON.parse(r.value)); } catch (e) {}
      try { const r = await window.storage.get(STORAGE_STAKEHOLDERS, false); if (r?.value) setCustomStakeholders(JSON.parse(r.value)); } catch (e) {}
      try { const r = await window.storage.get(STORAGE_ACTIONS, false); if (r?.value) setActionLog(JSON.parse(r.value)); } catch (e) {}
      try { const r = await window.storage.get(STORAGE_CALL_HISTORY, false); if (r?.value) setCallHistory(JSON.parse(r.value)); } catch (e) {}
      try { const r = await window.storage.get(STORAGE_QBR_HISTORY, false); if (r?.value) setQbrHistory(JSON.parse(r.value)); } catch (e) {}
    })();
  }, []);

  const allAccounts = useMemo(() => [...ACCOUNTS, ...customAccounts], [customAccounts]);
  const account = useMemo(() => allAccounts.find((a) => a.id === accountId) || allAccounts[0], [allAccounts, accountId]);
  const healthScore = useMemo(() => computeHealthScore(account), [account]);
  const healthTier = scoreTier(healthScore);
  const allSignals = useMemo(() => [...account.signals, ...(customSignals[account.id] || [])], [account, customSignals]);
  const accountActions = useMemo(() => actionLog[account.id] || [], [actionLog, account]);
  const allStakeholders = useMemo(() => sortStakeholders([...account.stakeholders, ...(customStakeholders[account.id] || [])]), [account, customStakeholders]);

  function handleAccountChange(id) {
    setAccountId(id);
    setShowAddSignalForm(false);
    setShowAddStakeholderForm(false);
  }

  async function handleSaveAccount(newAccount) {
    const updated = [...customAccounts, newAccount];
    setCustomAccounts(updated);
    try { await window.storage.set(STORAGE_ACCOUNTS, JSON.stringify(updated), false); } catch (e) {}
    setShowAddAccountForm(false);
    setAccountId(newAccount.id);
  }

  async function handleDeleteAccount(id) {
    const updated = customAccounts.filter((a) => a.id !== id);
    setCustomAccounts(updated);
    try { await window.storage.set(STORAGE_ACCOUNTS, JSON.stringify(updated), false); } catch (e) {}
    const remaining = [...ACCOUNTS, ...updated];
    setAccountId(remaining[0].id);
    setOpenHealthAccount(null);
  }

  async function handleSaveSignal(newSignal) {
    const updated = { ...customSignals, [account.id]: [...(customSignals[account.id] || []), newSignal] };
    setCustomSignals(updated);
    try { await window.storage.set(STORAGE_SIGNALS, JSON.stringify(updated), false); } catch (e) {}
    setShowAddSignalForm(false);
  }

  async function handleSaveStakeholder(newStakeholder) {
    const updated = { ...customStakeholders, [account.id]: [...(customStakeholders[account.id] || []), newStakeholder] };
    setCustomStakeholders(updated);
    try { await window.storage.set(STORAGE_STAKEHOLDERS, JSON.stringify(updated), false); } catch (e) {}
    setShowAddStakeholderForm(false);
  }

  async function handleDeleteStakeholder(id) {
    const updated = { ...customStakeholders, [account.id]: (customStakeholders[account.id] || []).filter((s) => s.id !== id) };
    setCustomStakeholders(updated);
    try { await window.storage.set(STORAGE_STAKEHOLDERS, JSON.stringify(updated), false); } catch (e) {}
  }

  async function handleAddAction(text, targetAccountId = account.id) {
    const newAction = { id: `action-${Date.now()}`, text, done: false, addedAt: new Date().toISOString() };
    const updated = { ...actionLog, [targetAccountId]: [...(actionLog[targetAccountId] || []), newAction] };
    setActionLog(updated);
    try { await window.storage.set(STORAGE_ACTIONS, JSON.stringify(updated), false); } catch (e) {}
  }

  async function handleToggleAction(id) {
    const updated = {
      ...actionLog,
      [account.id]: (actionLog[account.id] || []).map((a) => {
        if (a.id !== id) return a;
        const nowDone = !a.done;
        return { ...a, done: nowDone, completedAt: nowDone ? new Date().toISOString() : null };
      }),
    };
    setActionLog(updated);
    try { await window.storage.set(STORAGE_ACTIONS, JSON.stringify(updated), false); } catch (e) {}
  }

  async function handleDeleteAction(id) {
    const updated = { ...actionLog, [account.id]: (actionLog[account.id] || []).filter((a) => a.id !== id) };
    setActionLog(updated);
    try { await window.storage.set(STORAGE_ACTIONS, JSON.stringify(updated), false); } catch (e) {}
  }

  async function handleUpdateActionResult(id, result) {
    const updated = {
      ...actionLog,
      [account.id]: (actionLog[account.id] || []).map((a) => a.id === id ? { ...a, result } : a),
    };
    setActionLog(updated);
    try { await window.storage.set(STORAGE_ACTIONS, JSON.stringify(updated), false); } catch (e) {}
  }

  async function handleSaveCall(call) {
    const updated = { ...callHistory, [account.id]: [...(callHistory[account.id] || []), call] };
    setCallHistory(updated);
    try { await window.storage.set(STORAGE_CALL_HISTORY, JSON.stringify(updated), false); } catch (e) {}
  }

  async function handleDeleteCall(id) {
    const updated = { ...callHistory, [account.id]: (callHistory[account.id] || []).filter((c) => c.id !== id) };
    setCallHistory(updated);
    try { await window.storage.set(STORAGE_CALL_HISTORY, JSON.stringify(updated), false); } catch (e) {}
  }

  async function handleSaveQBR(entry) {
    const updated = { ...qbrHistory, [account.id]: [...(qbrHistory[account.id] || []), entry] };
    setQbrHistory(updated);
    try { await window.storage.set(STORAGE_QBR_HISTORY, JSON.stringify(updated), false); } catch (e) {}
  }

  async function handleDeleteQBR(id) {
    const updated = { ...qbrHistory, [account.id]: (qbrHistory[account.id] || []).filter((q) => q.id !== id) };
    setQbrHistory(updated);
    try { await window.storage.set(STORAGE_QBR_HISTORY, JSON.stringify(updated), false); } catch (e) {}
  }

  return (
    <div style={{ minHeight: "100%", background: PANEL, fontFamily: "'Inter', sans-serif" }}>
      <link rel="stylesheet" href={FONT_IMPORT_URL} />
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }
        .spin { animation: spin 0.8s linear infinite; }
        * { box-sizing: border-box; }
        select:focus, input:focus { outline: none; border-color: ${VIOLET} !important; }
      `}</style>

      <div style={{ background: LAVENDER_BAND, padding: "24px 24px 20px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: VIOLET, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Radar size={14} color="#FFFFFF" />
            </div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 26, color: INK }}>Account Intelligence Suite</div>
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: MUTED, marginBottom: 12 }}>
            Customer health and account expansion, in one place, reading the same account data
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#FFFFFF", padding: "5px 10px", borderRadius: 20, border: "1px solid #DDD2F5" }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: VIOLET, flexShrink: 0 }} />
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: INK, fontWeight: 600 }}>In the spirit of Lusha's product</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 24px 48px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: `1px solid ${BORDER}` }}>
          {[
            { key: "health", label: "Health Dashboard", icon: LayoutGrid },
            { key: "expansion", label: "Expansion Copilot", icon: Network },
            { key: "calls", label: "Call Intelligence", icon: PhoneCall },
            { key: "qbr", label: "QBR Assistant", icon: Presentation },
            { key: "report", label: "Manager Report", icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display: "flex", alignItems: "center", gap: 7, fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 13,
                padding: "10px 16px", cursor: "pointer", background: "none", border: "none",
                borderBottom: isActive ? `2px solid ${VIOLET}` : "2px solid transparent",
                color: isActive ? VIOLET : MUTED, marginBottom: -1,
              }}>
                <Icon size={15} /> {tab.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          {allAccounts.map((a) => {
            const s = computeHealthScore(a);
            const t = TIER_COLORS[scoreTier(s)];
            const isActive = accountId === a.id;
            return (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", gap: 0, borderRadius: 9,
                border: isActive ? `1px solid ${VIOLET}` : `1px solid ${BORDER}`,
                background: isActive ? "#F0E9FF" : PANEL, overflow: "hidden",
              }}>
                <button onClick={() => { handleAccountChange(a.id); if (activeTab === "health") setOpenHealthAccount(a); }} style={{
                  display: "flex", alignItems: "center", gap: 7, fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13,
                  padding: "8px 14px", cursor: "pointer", border: "none", background: "transparent",
                  color: isActive ? INK : MUTED,
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                  {a.name}{a.isCustom ? " ✦" : ""}
                </button>
                {a.isCustom && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteAccount(a.id); }}
                    title="Remove this account"
                    style={{
                      display: "flex", alignItems: "center", padding: "8px 10px", cursor: "pointer",
                      border: "none", borderLeft: `1px solid ${isActive ? "#DDD2F5" : BORDER}`, background: "transparent", color: RISK,
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
          <button onClick={() => setShowAddAccountForm(!showAddAccountForm)} style={{
            display: "flex", alignItems: "center", gap: 5, fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 13,
            padding: "8px 14px", borderRadius: 9, cursor: "pointer", border: `1px solid ${VIOLET}`,
            background: showAddAccountForm ? "#F0E9FF" : "transparent", color: VIOLET,
          }}>
            <Plus size={14} /> Add account
          </button>
        </div>

        {showAddAccountForm && <AddAccountForm onCancel={() => setShowAddAccountForm(false)} onSave={handleSaveAccount} />}

        {activeTab === "health" ? (
          <HealthTab accounts={allAccounts} onOpenAccount={setOpenHealthAccount} />
        ) : activeTab === "expansion" ? (
          <ExpansionTab
            account={account}
            healthScore={healthScore}
            healthTier={healthTier}
            allSignals={allSignals}
            allStakeholders={allStakeholders}
            onAddSignal={handleSaveSignal}
            onAddStakeholder={handleSaveStakeholder}
            onDeleteStakeholder={handleDeleteStakeholder}
            showAddSignalForm={showAddSignalForm}
            setShowAddSignalForm={setShowAddSignalForm}
            showAddStakeholderForm={showAddStakeholderForm}
            setShowAddStakeholderForm={setShowAddStakeholderForm}
            onAddAction={handleAddAction}
            existingActions={accountActions}
          />
        ) : activeTab === "calls" ? (
          <CallIntelligenceTab
            account={account}
            callHistory={callHistory[account.id] || []}
            onSaveCall={handleSaveCall}
            onDeleteCall={handleDeleteCall}
            onAddAction={handleAddAction}
            existingActions={accountActions}
          />
        ) : activeTab === "qbr" ? (
          <QBRTab
            account={account}
            onAddAction={handleAddAction}
            existingActions={accountActions}
            qbrHistory={qbrHistory[account.id] || []}
            onSaveQBR={handleSaveQBR}
            onDeleteQBR={handleDeleteQBR}
          />
        ) : (
          <ManagerReportTab
            mode={reportMode}
            setMode={setReportMode}
            account={account}
            healthScore={healthScore}
            healthTier={healthTier}
            allSignals={allSignals}
            allStakeholders={allStakeholders}
            allAccounts={allAccounts}
            actions={accountActions}
            actionLogAll={actionLog}
            onAddAction={handleAddAction}
            onToggleAction={handleToggleAction}
            onDeleteAction={handleDeleteAction}
            onUpdateActionResult={handleUpdateActionResult}
          />
        )}
      </div>

      {openHealthAccount && (
        <HealthDetailPanel
          account={allAccounts.find((a) => a.id === openHealthAccount.id)}
          onClose={() => setOpenHealthAccount(null)}
          onDelete={handleDeleteAccount}
          onAddAction={(text) => handleAddAction(text, openHealthAccount.id)}
          existingActions={actionLog[openHealthAccount.id] || []}
        />
      )}
    </div>
  );
}
