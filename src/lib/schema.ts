import { z } from "zod";

export const projectStatuses = ["draft", "published", "closed"] as const;
export const buckets = ["Yes", "Maybe", "No"] as const;
export const decisions = ["shortlist", "hold", "reject"] as const;
export const categories = {
  must_have: "Must-have skill",
  nice_to_have: "Nice-to-have skill",
  qualification: "Basic qualification",
  coursework: "Relevant coursework",
  experience: "Projects and experience",
} as const;

const bounded = (length: number) => z.string().trim().min(1).max(length);
export const idSchema = z.uuid();
export const profileSchema = z.object({
  name: bounded(100),
  student_id: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$/, "Enter a valid student ID."),
});

export const criterionSchema = z.strictObject({
  id: idSchema,
  category: z.enum(Object.keys(categories) as [keyof typeof categories, ...(keyof typeof categories)[]]),
  label: bounded(120),
  description: z.string().trim().max(320),
  weight: z.number().int().min(1).max(100),
});

export const projectSchema = z.strictObject({
  name: z.string().trim().min(3).max(100),
  short_description: z.string().trim().min(10).max(220),
  description: z.string().trim().min(20).max(8000),
  required_skills: z.array(bounded(80)).min(1).max(20),
  requirements: z.string().trim().max(2500),
  questions: z.array(bounded(240)).max(6),
  rubric: z.array(criterionSchema).min(1).max(12),
  maybe_threshold: z.number().int().min(1).max(99),
  yes_threshold: z.number().int().min(2).max(100),
  deadline: z.iso.datetime(),
  status: z.enum(projectStatuses),
}).superRefine((project, context) => {
  if (project.yes_threshold <= project.maybe_threshold) {
    context.addIssue({ code: "custom", path: ["yes_threshold"], message: "Yes must start above Maybe." });
  }
  const labels = new Set(project.rubric.map((item) => item.label.toLowerCase()));
  const ids = new Set(project.rubric.map((item) => item.id));
  if (labels.size !== project.rubric.length || ids.size !== project.rubric.length) {
    context.addIssue({ code: "custom", path: ["rubric"], message: "Rubric criteria must be distinct." });
  }
});

export const uploadSchema = z.strictObject({
  projectId: idSchema,
  size: z.number().int().positive(),
  mediaType: z.literal("application/pdf"),
});

export const submissionSchema = z.strictObject({
  projectId: idSchema,
  path: z.string().max(160),
  expectedVersion: z.number().int().nonnegative(),
  questions: z.array(bounded(240)).max(6),
  answers: z.array(bounded(1000)).max(6),
  links: z.array(z.url({ protocol: /^https?$/ }).max(2048).refine((value) => {
    const url = new URL(value);
    return !url.username && !url.password;
  }, "Use HTTP or HTTPS without credentials.")).max(5),
});

export const decisionSchema = z.object({
  applicationId: idSchema,
  version: z.coerce.number().int().min(1).max(2147483647),
  decision: z.enum(decisions),
  note: z.string().trim().max(2000),
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type Criterion = z.infer<typeof criterionSchema>;
export type Bucket = (typeof buckets)[number];
export type Decision = (typeof decisions)[number];
