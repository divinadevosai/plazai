/**
 * The buildings around the plaza. Each one is a place avatars go to do one kind of work:
 * it adds expertise to the agent's prompt, and tasks are routed to it by keywords.
 */
export interface BuildingDef {
  id: string;
  name: string;
  blurb: string;
  /** Extra guidance added to the agent's system prompt while working here. */
  expertise: string;
  /** Words in a task that send it here automatically. */
  keywords: RegExp;
  color: string;
  roof: string;
  /** Lucide-style SVG path(s) for the sign, drawn on a canvas. */
  icon: string;
}

export const PLAZA_ID = "plaza";

export const BUILDINGS: BuildingDef[] = [
  {
    id: "servers",
    name: "Server Room",
    blurb: "Backend work: APIs, databases, servers and performance.",
    expertise: "You're in the Server Room doing backend engineering. Think about APIs, data models, databases, scaling, error handling and logging. Give concrete code, schemas or commands where they help.",
    keywords: /\b(backend|back-end|server|api|endpoint|database|db|postgres|sql schema|redis|queue|microservice|latency|scal(e|ing)|cache)\b/i,
    color: "#e9eef6",
    roof: "#5a6478",
    icon: "M2 3h20v6H2zM2 15h20v6H2zM6 6h.01M6 18h.01",
  },
  {
    id: "calendar",
    name: "Calendar Tower",
    blurb: "Reminders, schedules, plans and anything time-based.",
    expertise: "You're in the Calendar Tower. Focus on plans, schedules, deadlines and reminders. Turn requests into clear dated steps and timelines.",
    keywords: /\b(remind|reminder|schedule|calendar|deadline|meeting|agenda|timeline|plan (my|the) (week|day|month)|routine)\b/i,
    color: "#fff6e6",
    roof: "#e84d4d",
    icon: "M3 5h18v16H3zM16 3v4M8 3v4M3 10h18",
  },
  {
    id: "repo",
    name: "Repo HQ",
    blurb: "GitHub work: read repos, write changes, then upload a branch, pull request or new repo.",
    expertise:
      "You're in Repo HQ working on a code repository. Read the repository context you're given carefully. When you create or change files, output each complete file exactly like this:\nFILE: path/to/file.ext\n```\n<entire file content>\n```\nOnly output whole files, keep paths relative to the repo root, and explain your changes briefly before the files.",
    keywords: /\b(github|git hub|repo|repository|commit|pull request|\bpr\b|branch|readme|merge|push (to|the) (repo|github))\b/i,
    color: "#eef8f0",
    roof: "#2c7a4b",
    icon: "M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9",
  },
  {
    id: "library",
    name: "Library",
    blurb: "Research, explanations, summaries and learning.",
    expertise: "You're in the Library doing research. Be accurate, cite what kind of source a claim would come from, separate facts from opinions, and summarise clearly.",
    keywords: /\b(research|summari[sz]e|explain|learn|study|compare|history of|what is|how does|sources?)\b/i,
    color: "#f6efe4",
    roof: "#8a5a3b",
    icon: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5",
  },
  {
    id: "cafe",
    name: "Writers' Café",
    blurb: "Blog posts, emails, docs, captions and copy.",
    expertise: "You're in the Writers' Café. Write clearly and warmly for the audience, with a strong opening, short paragraphs and a clear call to action where it fits.",
    keywords: /\b(write|writing|blog|post|email|newsletter|caption|copy|article|story|tweet|bio|docs?|documentation|press release)\b/i,
    color: "#fff1f4",
    roof: "#e06fa8",
    icon: "M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v2M10 2v2M14 2v2",
  },
  {
    id: "studio",
    name: "Design Studio",
    blurb: "UI and UX ideas, layouts, branding and colour.",
    expertise: "You're in the Design Studio. Think about users, layout, hierarchy, accessibility, colour and typography. Describe designs precisely (spacing, sizes, colours as hex) and explain the reasoning.",
    keywords: /\b(design|ui|ux|layout|logo|brand(ing)?|colou?r palette|wireframe|mockup|figma|font|typography|landing page)\b/i,
    color: "#f3efff",
    roof: "#8a6ce0",
    icon: "M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-5 4h-2a2 2 0 0 0-1 3.7A1.6 1.6 0 0 1 12 22zM7.5 10.5h.01M12 7.5h.01M16.5 10.5h.01",
  },
  {
    id: "lab",
    name: "Test Lab",
    blurb: "Code review, bug hunting, tests and QA.",
    expertise: "You're in the Test Lab. Look for bugs, edge cases and missing tests. Propose concrete test cases and fixes, ordered by severity.",
    keywords: /\b(test|tests|testing|bug|debug|qa|code review|review (my|this) code|edge cases?|unit tests?|e2e|crash|error)\b/i,
    color: "#e9f9fb",
    roof: "#2fb5c8",
    icon: "M9 3h6M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3L14 9V3M7 15h10",
  },
  {
    id: "launch",
    name: "Launch Pad",
    blurb: "Deploys, CI/CD, Docker, hosting and releases.",
    expertise: "You're at the Launch Pad doing DevOps. Cover build, CI/CD, containers, hosting, environment variables, monitoring and rollback. Give exact config files and commands.",
    keywords: /\b(deploy|deployment|ci|cd|pipeline|docker|kubernetes|k8s|hosting|vercel|netlify|release|launch|devops|github actions)\b/i,
    color: "#eef1f5",
    roof: "#f2913d",
    icon: "M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1zM12 15l-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z",
  },
  {
    id: "vault",
    name: "Security Vault",
    blurb: "Security reviews, threat models and hardening.",
    expertise: "You're in the Security Vault. Review for vulnerabilities (auth, injection, secrets, access control, dependencies), rate each by severity, and give safe, concrete fixes. Never help attack systems you don't own.",
    keywords: /\b(security|secure|vulnerab\w*|auth(entication|orization)?|password|encrypt\w*|threat|pentest|xss|csrf|injection|secrets?|permissions)\b/i,
    color: "#eceff3",
    roof: "#3d4a66",
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
  },
  {
    id: "observatory",
    name: "Data Observatory",
    blurb: "Data analysis, SQL queries, metrics and charts.",
    expertise: "You're in the Data Observatory. Work with data carefully: state assumptions, write correct SQL or code, suggest the right chart, and explain what the numbers mean.",
    keywords: /\b(data|analy[sz]e|analytics|metrics?|sql|query|chart|graph|spreadsheet|csv|kpi|dashboard|statistics|forecast)\b/i,
    color: "#eef3ff",
    roof: "#3f6fd8",
    icon: "M3 3v18h18M18 17V9M13 17V5M8 17v-3",
  },
];

export const buildingById = (id?: string) => BUILDINGS.find((b) => b.id === id);

/** Picks a building from what the task says (or the plaza desks if nothing matches). */
export function routeTask(text: string): string {
  // Score by how many of each building's keywords appear; earlier buildings win ties
  // (so "write tests" goes to the Test Lab, "write a blog post about APIs" to the Café).
  const order = ["repo", "calendar", "launch", "vault", "lab", "servers", "observatory", "studio", "cafe", "library"];
  let best = PLAZA_ID, bestScore = 0;
  for (const id of order) {
    const re = new RegExp(buildingById(id)!.keywords.source, "gi");
    const score = text.match(re)?.length ?? 0;
    if (score > bestScore) [best, bestScore] = [id, score];
  }
  return best;
}

/** Layout: buildings sit evenly round the ring road, facing the fountain. */
export const BUILDING_R = 21.5;
export function buildingSpot(id: string) {
  const i = BUILDINGS.findIndex((b) => b.id === id);
  const a = (i / BUILDINGS.length) * Math.PI * 2 + Math.PI / 2 + Math.PI / BUILDINGS.length;
  const x = Math.cos(a) * BUILDING_R, z = Math.sin(a) * BUILDING_R;
  const door = { x: Math.cos(a) * (BUILDING_R - 3.2), z: Math.sin(a) * (BUILDING_R - 3.2) };
  // Rotation so the building's front (+Z) faces the centre.
  const rotY = Math.atan2(-x, -z);
  return { x, z, door, rotY, angle: a };
}
