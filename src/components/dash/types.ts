export type Decision = "shortlist" | "hold" | "reject";
export type MatchBucket = "Strong" | "Possible" | "Weak";

export type RoleMatch = {
  score: number;
  matched: string[];
  missing: string[];
  reasoning: string;
  flags: string[];
};

export type RoleDecision = { status: Decision | "unreviewed"; note: string };

export type Candidate = {
  id: string;
  name: string;
  email: string;
  studentId: string;
  year: string;
  interests: string[];
  skills: string[];
  experience: string;
  links: { label: string; url: string }[];
  notes: string;
  resumeName: string;
  extraFiles: string[];
  source: "upload" | "import";
  matches: Record<string, RoleMatch>;
  decisions: Record<string, RoleDecision>;
};

export type Role = {
  id: string;
  name: string;
  description: string;
  openings: number;
  mustHave: string[];
  niceToHave: string[];
  interestTags: string[];
};

export type Project = {
  id: string;
  name: string;
  description: string;
  deadline: string;
  status: "Open" | "Draft" | "Closed";
  roles: Role[];
  candidates: Candidate[];
  confirmedTeam: Record<string, string[]>;
};

export type CandidateDraft = Pick<Candidate, "name" | "email" | "studentId" | "resumeName" | "extraFiles" | "source"> & {
  notes: string;
  links: Candidate["links"];
};

const roles: Role[] = [
  {
    id: "role-research",
    name: "Product research",
    description: "Interview students and turn early signals into clear product opportunities.",
    openings: 2,
    mustHave: ["User interviews", "Synthesis", "Research"],
    niceToHave: ["Figma", "Survey design"],
    interestTags: ["Consumer apps", "Product strategy"],
  },
  {
    id: "role-growth",
    name: "Growth & community",
    description: "Build a repeatable student-acquisition loop and nurture early adopters.",
    openings: 1,
    mustHave: ["Community building", "Experiment design", "Communication"],
    niceToHave: ["Analytics", "Partnerships"],
    interestTags: ["Startups", "Community"],
  },
  {
    id: "role-content",
    name: "Brand & content",
    description: "Shape the voice and create useful content for an early-stage team.",
    openings: 1,
    mustHave: ["Writing", "Storytelling", "Content strategy"],
    niceToHave: ["Canva", "Social media"],
    interestTags: ["Design", "Creator economy"],
  },
];

function match(score: number, matched: string[], missing: string[], reasoning: string, flags: string[] = []): RoleMatch {
  return { score, matched, missing, reasoning, flags };
}

export const sampleProjects: Project[] = [
  {
    id: "project-signal",
    name: "Campus Signal",
    description: "A student-led discovery platform helping campus builders learn what their peers need.",
    deadline: "2026-12-02",
    status: "Open",
    roles,
    confirmedTeam: {},
    candidates: [
      {
        id: "candidate-mira", name: "Mira S.", email: "mira@applicant.example", studentId: "SYN-4021", year: "Year 2",
        interests: ["Consumer apps", "Product strategy"], skills: ["User interviews", "Synthesis", "Figma", "Research"],
        experience: "Led 12 discovery interviews for a student marketplace; synthesized themes into a prototype tested with 20 students.",
        links: [{ label: "Portfolio", url: "https://portfolio.example/mira" }, { label: "LinkedIn", url: "https://linkedin.example/mira" }],
        notes: "Interested in product discovery and early-stage teams.", resumeName: "mira_resume.pdf", extraFiles: [], source: "upload",
        matches: {
          "role-research": match(88, ["User interviews", "Synthesis", "Research"], ["Survey design"], "Strong evidence of hands-on discovery and synthesis; experience maps directly to this role."),
          "role-growth": match(51, ["Communication"], ["Community building", "Experiment design"], "Clear communicator, though the sample profile has limited community-growth evidence."),
          "role-content": match(44, ["Storytelling"], ["Writing", "Content strategy"], "Some narrative experience is present, but sustained content work is not shown.", ["Needs manual review"]),
        }, decisions: { "role-research": { status: "shortlist", note: "Great discovery examples." } },
      },
      {
        id: "candidate-kabir", name: "Kabir A.", email: "kabir@applicant.example", studentId: "SYN-4056", year: "Year 3",
        interests: ["Startups", "Community"], skills: ["Community building", "Experiment design", "Analytics", "Communication"],
        experience: "Organized a founder circle across three clubs and ran weekly activation experiments with a 24% increase in repeat attendance.",
        links: [{ label: "GitHub", url: "https://github.example/kabir" }], notes: "Would like a role with people-facing work.",
        resumeName: "kabir_resume.pdf", extraFiles: ["community-project.pdf"], source: "import",
        matches: {
          "role-research": match(72, ["User interviews", "Synthesis"], ["Research", "Survey design"], "Strong communication and structured experimentation translate well to interviewing."),
          "role-growth": match(91, ["Community building", "Experiment design", "Communication", "Analytics"], ["Partnerships"], "Repeated community programs and measurable experiments are a strong fit for growth."),
          "role-content": match(62, ["Storytelling", "Social media"], ["Writing", "Content strategy"], "Community storytelling is visible, but strategic writing samples are limited."),
        }, decisions: { "role-growth": { status: "shortlist", note: "Strong outcomes and ownership." } },
      },
      {
        id: "candidate-anaya", name: "Anaya R.", email: "anaya@applicant.example", studentId: "SYN-4108", year: "Year 1",
        interests: ["Design", "Creator economy"], skills: ["Writing", "Storytelling", "Canva", "Social media"],
        experience: "Created a campus newsletter and short-form campaign for a student arts festival, reaching 1,800 subscribers.",
        links: [{ label: "Portfolio", url: "https://portfolio.example/anaya" }], notes: "Shared a writing sample in the application.",
        resumeName: "anaya_resume.pdf", extraFiles: ["writing-sample.pdf"], source: "upload",
        matches: {
          "role-research": match(55, ["User interviews", "Synthesis"], ["Research", "Survey design"], "The candidate demonstrates empathy but has limited structured research experience."),
          "role-growth": match(63, ["Community building", "Communication"], ["Experiment design", "Analytics"], "Audience-building experience is relevant, though growth measurement is unclear."),
          "role-content": match(94, ["Writing", "Storytelling", "Content strategy", "Canva"], ["Social media"], "A consistent publishing record and clear audience outcomes make this a standout content fit."),
        }, decisions: {},
      },
      {
        id: "candidate-omar", name: "Omar K.", email: "omar@applicant.example", studentId: "SYN-4132", year: "Year 2",
        interests: ["Consumer apps", "Startups"], skills: ["Research", "Analytics", "Survey design", "Figma"],
        experience: "Built a survey dashboard for a campus society and helped a small team prioritize its first three product changes.",
        links: [{ label: "GitHub", url: "https://github.example/omar" }], notes: "Prefers analytical and product-focused projects.",
        resumeName: "omar_resume.pdf", extraFiles: [], source: "import",
        matches: {
          "role-research": match(78, ["Research", "Survey design", "Synthesis"], ["User interviews"], "Strong survey and analysis skills; interview depth should be explored in a conversation."),
          "role-growth": match(69, ["Experiment design", "Analytics"], ["Community building", "Partnerships"], "Comfortable measuring outcomes, with less evidence of community ownership."),
          "role-content": match(34, ["Content strategy"], ["Writing", "Storytelling"], "The sample profile focuses on analysis rather than producing content.", ["Needs manual review"]),
        }, decisions: { "role-research": { status: "hold", note: "Ask about interview facilitation." } },
      },
      {
        id: "candidate-leela", name: "Leela P.", email: "leela@applicant.example", studentId: "SYN-4157", year: "Year 4",
        interests: ["Community", "Creator economy"], skills: ["Writing", "Community building", "Partnerships", "Storytelling"],
        experience: "Partnered with five campus groups on a volunteer campaign and wrote profiles that doubled event sign-ups.",
        links: [], notes: "Can support multiple teams if schedules align.", resumeName: "leela_resume.pdf", extraFiles: [], source: "upload",
        matches: {
          "role-research": match(66, ["User interviews", "Synthesis"], ["Research", "Survey design"], "Strong listening and synthesis skills are suggested, but formal research examples are limited."),
          "role-growth": match(83, ["Community building", "Communication", "Partnerships"], ["Experiment design", "Analytics"], "Cross-club partnerships and sign-up outcomes show promising community-growth experience."),
          "role-content": match(86, ["Writing", "Storytelling", "Content strategy"], ["Canva"], "Published profiles with an audience outcome provide direct evidence for content work.", ["Check schedule"]),
        }, decisions: {},
      },
      {
        id: "candidate-dev", name: "Dev N.", email: "dev@applicant.example", studentId: "SYN-4196", year: "Year 1",
        interests: ["Product strategy", "Design"], skills: ["Figma", "Research", "Canva"],
        experience: "Designed two student-club flows and ran informal usability sessions with classmates.",
        links: [{ label: "Portfolio", url: "https://portfolio.example/dev" }], notes: "Very early-career; portfolio includes class projects.", resumeName: "dev_resume.pdf", extraFiles: [], source: "upload",
        matches: {
          "role-research": match(59, ["Research", "Synthesis"], ["User interviews", "Survey design"], "Useful early research exposure, but the examples would benefit from more depth."),
          "role-growth": match(39, ["Experiment design"], ["Community building", "Communication"], "Design work is visible; community operations are not demonstrated."),
          "role-content": match(57, ["Canva", "Content strategy"], ["Writing", "Storytelling"], "Visual content skills are relevant, though written work is missing."),
        }, decisions: {},
      },
    ],
  },
  {
    id: "project-fieldnotes",
    name: "Founder Fieldnotes",
    description: "A fresh research sprint exploring the earliest challenges faced by campus founders.",
    deadline: "2027-01-12",
    status: "Draft",
    roles: [],
    candidates: [],
    confirmedTeam: {},
  },
];

export function bucketFor(score: number): MatchBucket {
  return score >= 70 ? "Strong" : score >= 40 ? "Possible" : "Weak";
}

export function scoreClass(score: number) {
  return score >= 70 ? "score-strong" : score >= 40 ? "score-possible" : "score-weak";
}
