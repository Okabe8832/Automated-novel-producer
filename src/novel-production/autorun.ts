import type { NovelRequirements, PlotUnitRecord, ProductionPlan, StoryBible } from "./schema";

export type AutorunPhase = "branch" | "intake" | "planning" | "final_confirmation" | "production" | "review" | "repair" | "export";

export type AutorunReadinessInput = {
  activeBranchId?: string;
  requirements?: NovelRequirements;
  storyBible?: StoryBible;
  plan?: ProductionPlan;
  plotUnits?: PlotUnitRecord[];
  finalConfirmation?: boolean;
};

export type AutorunReadinessResult = {
  ready: boolean;
  activeBranchId?: string;
  phase: AutorunPhase;
  blocker?: string;
  nextAction: string;
  blueprint?: string;
};

export function evaluateAutorunReadiness(input: AutorunReadinessInput): AutorunReadinessResult {
  const requirements = input.requirements;
  const storyBible = input.storyBible;
  const plan = input.plan;
  const plotUnits = input.plotUnits;

  if (isBlank(input.activeBranchId ?? "")) {
    return {
      ready: false,
      phase: "branch",
      blocker: "No active branch is selected.",
      nextAction: "Run /novel-init or switch to an active branch before /novel-autorun.",
    };
  }

  if (requirements === undefined) {
    return {
      ready: false,
      activeBranchId: input.activeBranchId,
      phase: "intake",
      blocker: "Intake requirements are missing.",
      nextAction: "Run or continue /novel-intake with the missing core requirements.",
    };
  }

  const intakeIssues = getIntakeIssues(requirements);
  if (intakeIssues.length > 0) {
    return {
      ready: false,
      activeBranchId: input.activeBranchId,
      phase: "intake",
      blocker: `Intake is missing core requirements: ${intakeIssues.join(", ")}`,
      nextAction: "Run or continue /novel-intake with the missing core requirements.",
    };
  }

  const missingPlanning = getMissingPlanningArtifacts(input);
  if (missingPlanning.length > 0) {
    return {
      ready: false,
      activeBranchId: input.activeBranchId,
      phase: "planning",
      blocker: `Planning artifacts are missing: ${missingPlanning.join(", ")}`,
      nextAction: "Run or continue /novel-plan before final autorun confirmation.",
    };
  }

  const planningIssues = getPlanningIssues(storyBible, plan, plotUnits);
  if (planningIssues.length > 0) {
    return {
      ready: false,
      activeBranchId: input.activeBranchId,
      phase: "planning",
      blocker: `Planning is not production-ready: ${planningIssues.join(", ")}`,
      nextAction: "Revise /novel-plan outputs until the story bible and plot units are production-ready.",
    };
  }

  if (storyBible === undefined || plan === undefined || plotUnits === undefined) {
    return {
      ready: false,
      activeBranchId: input.activeBranchId,
      phase: "planning",
      blocker: "Planning artifacts are missing: storyBible, plan, plotUnits",
      nextAction: "Run or continue /novel-plan before final autorun confirmation.",
    };
  }

  const blueprint = buildAutorunBlueprint({
    requirements,
    storyBible,
    plan,
    plotUnits,
  });

  if (input.finalConfirmation !== true) {
    return {
      ready: false,
      activeBranchId: input.activeBranchId,
      phase: "final_confirmation",
      blocker: "Final production confirmation has not been granted.",
      nextAction: "Ask the user to approve the production blueprint before running /novel-auto.",
      blueprint,
    };
  }

  return {
    ready: true,
    activeBranchId: input.activeBranchId,
    phase: "production",
    nextAction: "Run the existing /novel-auto production loop.",
    blueprint,
  };
}

export function createAutorunBlockedReport(input: {
  activeBranchId?: string;
  phase: Exclude<AutorunPhase, "branch" | "intake" | "planning" | "final_confirmation">;
  blocker: string;
  nextAction: string;
}): AutorunReadinessResult {
  return {
    ready: false,
    ...(input.activeBranchId === undefined ? {} : { activeBranchId: input.activeBranchId }),
    phase: input.phase,
    blocker: input.blocker,
    nextAction: input.nextAction,
  };
}

export function buildAutorunBlueprint(input: {
  requirements: NovelRequirements;
  storyBible: StoryBible;
  plan: ProductionPlan;
  plotUnits: PlotUnitRecord[];
}): string {
  const characters = input.storyBible.characters
    .map((character) => `- ${character.name} (${character.role}): ${character.motivation}; arc: ${character.arc}`)
    .join("\n");
  const units = [...input.plotUnits]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((unit) => {
      const characterBindings = unit.bindings.characterIds.length === 0 ? "无角色绑定" : unit.bindings.characterIds.join(", ");
      return `- ${unit.orderIndex}. ${unit.title}: ${unit.purpose} (${unit.summary}); characters: ${characterBindings}`;
    })
    .join("\n");

  return [
    "# Production Blueprint",
    "",
    "## Intake",
    `- Title: ${input.requirements.title}`,
    `- Genre: ${input.requirements.genre}`,
    `- Length: ${input.requirements.lengthTarget.totalWords} total words; ${input.requirements.lengthTarget.unitWords} words per unit`,
    `- Audience: ${input.requirements.targetAudience}`,
    `- Style: ${input.requirements.style}`,
    `- Must include: ${joinList(input.requirements.mustInclude)}`,
    `- Must avoid: ${joinList(input.requirements.mustAvoid)}`,
    "",
    "## Story Bible",
    `- Premise: ${input.storyBible.premise}`,
    `- World: ${input.storyBible.world}`,
    `- Continuity: ${joinList(input.storyBible.continuityRules, "; ")}`,
    "",
    "## Major Characters",
    characters || "- None",
    "",
    "## Plot Nodes",
    units || "- None",
    "",
    "## Production Policy",
    "- Draft in plot-unit order.",
    "- Review every drafted unit.",
    "- Repair failed units with concrete instructions, then re-review.",
    "- Export only after every plot unit is approved.",
  ].join("\n");
}

function getIntakeIssues(requirements: NovelRequirements): string[] {
  const issues: string[] = [];
  if (isBlank(requirements.originalBrief)) issues.push("originalBrief");
  if (isBlank(requirements.genre)) issues.push("genre");
  if (isBlank(requirements.style)) issues.push("style");
  if (requirements.lengthTarget.totalWords <= 0) issues.push("lengthTarget.totalWords");
  if (requirements.lengthTarget.unitWords <= 0) issues.push("lengthTarget.unitWords");
  return issues;
}

function getMissingPlanningArtifacts(input: AutorunReadinessInput): string[] {
  const missing: string[] = [];
  if (input.storyBible === undefined) missing.push("storyBible");
  if (input.plan === undefined) missing.push("plan");
  if (input.plotUnits === undefined) missing.push("plotUnits");
  return missing;
}

function getPlanningIssues(storyBible: StoryBible | undefined, plan: ProductionPlan | undefined, plotUnits: PlotUnitRecord[] | undefined): string[] {
  if (storyBible === undefined || plan === undefined || plotUnits === undefined) {
    return [];
  }

  const issues: string[] = [];
  if (isBlank(storyBible.premise)) issues.push("storyBible.premise");
  if (isBlank(storyBible.world)) issues.push("storyBible.world");
  if (storyBible.characters.length === 0) issues.push("storyBible.characters");
  if (isBlank(plan.logline)) issues.push("plan.logline");
  if (plan.acts.length === 0) issues.push("plan.acts");
  if (plotUnits.length === 0) issues.push("plotUnits");

  const characterIds = new Set(storyBible.characters.map((character) => character.id));
  plotUnits.forEach((unit, index) => {
    if (isBlank(unit.purpose)) issues.push(`plotUnits[${index}].purpose`);
    if (isBlank(unit.summary)) issues.push(`plotUnits[${index}].summary`);
    for (const characterId of unit.bindings.characterIds) {
      if (!characterIds.has(characterId)) issues.push(`plotUnits[${index}].bindings.characterIds:${characterId}`);
    }
  });

  return issues;
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function joinList(items: string[], separator = ", "): string {
  return items.length === 0 ? "None" : items.join(separator);
}
