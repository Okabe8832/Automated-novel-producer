export type IsoTimestamp = string;

export type GenerationMode = "sequential" | "selected_units";
export type ReviewMode = "manual" | "agent_assisted" | "both";
export type ApprovedUnitPolicy = "locked" | "repair_with_confirmation";
export type RepairIntensity = "light" | "medium" | "strong";

export type PlotUnitStatus =
  | "planned"
  | "ready_to_produce"
  | "producing"
  | "drafted"
  | "reviewing"
  | "approved"
  | "rejected"
  | "repair_requested"
  | "repairing";

export type GenerationRunStatus = "pending" | "running" | "succeeded" | "failed";
export type ReviewResult = "pass" | "fail";
export type RepairTaskStatus = "open" | "in_progress" | "completed" | "cancelled";

export interface NovelRequirements {
  schemaVersion: 1;
  id: string;
  title: string;
  originalBrief: string;
  language: string;
  genre: string;
  targetAudience: string;
  style: string;
  pointOfView: string;
  lengthTarget: {
    totalWords: number;
    unitWords: number;
  };
  mustInclude: string[];
  mustAvoid: string[];
  referenceNotes: string[];
  qualityBar: string[];
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface ProductionControls {
  schemaVersion: 1;
  generationMode: GenerationMode;
  reviewMode: ReviewMode;
  approvedUnitPolicy: ApprovedUnitPolicy;
  defaultRepairIntensity: RepairIntensity;
  allowProduceUnreviewedNextUnit: boolean;
  maxPreviousApprovedUnitsInPrompt: number;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface StoryBible {
  schemaVersion: 1;
  premise: string;
  world: string;
  themes: string[];
  characters: StoryBibleCharacter[];
  scenes: StoryBibleScene[];
  timeline: StoryBibleTimeEntry[];
  continuityRules: string[];
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface PrototypeRecord {
  id: string;
  type: "genre" | "plot_unit" | "character" | "scene" | "style" | "custom";
  name: string;
  description: string;
  defaultElements: string[];
  defaultConstraints: string[];
  promptNotes: string[];
  source: "manual" | "imported_text" | "generated";
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface ElementPoolRecord {
  id: string;
  kind: "genre" | "plot" | "character" | "scene" | "time" | "global" | "unit_local" | "custom";
  name: string;
  elements: ElementPoolElement[];
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface ProductionPlan {
  schemaVersion: 1;
  logline: string;
  structure: string;
  acts: string[];
  productionNotes: string[];
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface PlotUnitRecord {
  id: string;
  orderIndex: number;
  title: string;
  purpose: string;
  summary: string;
  targetWords: number;
  status: PlotUnitStatus;
  prototypeIds: string[];
  inheritedElementPoolIds: string[];
  localElements: ElementPoolElement[];
  bindings: {
    characterIds: string[];
    sceneIds: string[];
    timeEntryIds: string[];
  };
  constraints: string[];
  draftPath: string;
  currentRepairTaskId: string;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface ReviewRecord {
  id: string;
  plotUnitId: string;
  result: ReviewResult;
  reviewMode: ReviewMode;
  checklist: {
    matchesRequirements: boolean;
    matchesUnitPurpose: boolean;
    continuityOk: boolean;
    characterBehaviorOk: boolean;
    styleOk: boolean;
    chineseProseOk: boolean;
  };
  issues: string[];
  decisionNotes: string;
  createdAt: IsoTimestamp;
}

export interface RepairTaskRecord {
  id: string;
  targetType: "plot_unit" | "draft" | "character" | "scene" | "timeline" | "requirements" | "story_bible" | "global_elements";
  targetId: string;
  createdFromReviewId: string;
  reason: string;
  scope: "local_text" | "unit" | "forward_units" | "global_plan";
  intensity: RepairIntensity;
  instructions: string;
  status: RepairTaskStatus;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface GenerationRunRecord {
  id: string;
  plotUnitId: string;
  status: GenerationRunStatus;
  agent: string;
  model: string;
  promptSnapshot: {
    requirements: unknown;
    productionControls: unknown;
    storyBible: unknown;
    plan: unknown;
    previousApprovedUnits: unknown[];
    currentUnit: unknown;
    prototypes: unknown[];
    elementPools: unknown[];
    repairTask: unknown | null;
    branchPrompt: string;
    templateVersion: string;
  };
  outputPath: string;
  errorMessage: string;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface StoryBibleCharacter {
  id: string;
  name: string;
  role: string;
  appearance: string;
  personality: string;
  motivation: string;
  arc: string;
}

export interface StoryBibleScene {
  id: string;
  name: string;
  description: string;
}

export interface StoryBibleTimeEntry {
  id: string;
  label: string;
  description: string;
}

export interface ElementPoolElement {
  id: string;
  category: string;
  name: string;
  description: string;
}

const generationModes = ["sequential", "selected_units"] as const;
const reviewModes = ["manual", "agent_assisted", "both"] as const;
const approvedUnitPolicies = ["locked", "repair_with_confirmation"] as const;
const repairIntensities = ["light", "medium", "strong"] as const;
const plotUnitStatuses = [
  "planned",
  "ready_to_produce",
  "producing",
  "drafted",
  "reviewing",
  "approved",
  "rejected",
  "repair_requested",
  "repairing",
] as const;
const generationRunStatuses = ["pending", "running", "succeeded", "failed"] as const;
const reviewResults = ["pass", "fail"] as const;
const repairTaskStatuses = ["open", "in_progress", "completed", "cancelled"] as const;
const prototypeTypes = ["genre", "plot_unit", "character", "scene", "style", "custom"] as const;
const prototypeSources = ["manual", "imported_text", "generated"] as const;
const elementPoolKinds = ["genre", "plot", "character", "scene", "time", "global", "unit_local", "custom"] as const;
const repairTargetTypes = [
  "plot_unit",
  "draft",
  "character",
  "scene",
  "timeline",
  "requirements",
  "story_bible",
  "global_elements",
] as const;
const repairScopes = ["local_text", "unit", "forward_units", "global_plan"] as const;

const allowedTransitions: Record<PlotUnitStatus, PlotUnitStatus[]> = {
  planned: ["ready_to_produce"],
  ready_to_produce: ["producing"],
  producing: ["drafted", "ready_to_produce"],
  drafted: ["reviewing", "rejected"],
  reviewing: ["approved", "rejected"],
  approved: [],
  rejected: ["repair_requested"],
  repair_requested: ["repairing"],
  repairing: ["drafted"],
};

export function parseRequirements(value: unknown): NovelRequirements {
  const record = expectRecord(value, "requirements");
  expectExactKeys(
    record,
    [
      "schemaVersion",
      "id",
      "title",
      "originalBrief",
      "language",
      "genre",
      "targetAudience",
      "style",
      "pointOfView",
      "lengthTarget",
      "mustInclude",
      "mustAvoid",
      "referenceNotes",
      "qualityBar",
      "createdAt",
      "updatedAt",
    ],
    "requirements",
  );
  return {
    schemaVersion: expectSchemaVersion(record, "requirements.schemaVersion"),
    id: expectString(record.id, "requirements.id"),
    title: expectString(record.title, "requirements.title"),
    originalBrief: expectString(record.originalBrief, "requirements.originalBrief"),
    language: expectString(record.language, "requirements.language"),
    genre: expectString(record.genre, "requirements.genre"),
    targetAudience: expectString(record.targetAudience, "requirements.targetAudience"),
    style: expectString(record.style, "requirements.style"),
    pointOfView: expectString(record.pointOfView, "requirements.pointOfView"),
    lengthTarget: parseLengthTarget(record.lengthTarget),
    mustInclude: expectStringArray(record.mustInclude, "requirements.mustInclude"),
    mustAvoid: expectStringArray(record.mustAvoid, "requirements.mustAvoid"),
    referenceNotes: expectStringArray(record.referenceNotes, "requirements.referenceNotes"),
    qualityBar: expectStringArray(record.qualityBar, "requirements.qualityBar"),
    createdAt: expectString(record.createdAt, "requirements.createdAt"),
    updatedAt: expectString(record.updatedAt, "requirements.updatedAt"),
  };
}

export function parseProductionControls(value: unknown): ProductionControls {
  const record = expectRecord(value, "productionControls");
  expectExactKeys(
    record,
    [
      "schemaVersion",
      "generationMode",
      "reviewMode",
      "approvedUnitPolicy",
      "defaultRepairIntensity",
      "allowProduceUnreviewedNextUnit",
      "maxPreviousApprovedUnitsInPrompt",
      "createdAt",
      "updatedAt",
    ],
    "productionControls",
  );
  return {
    schemaVersion: expectSchemaVersion(record, "productionControls.schemaVersion"),
    generationMode: expectOneOf(record.generationMode, generationModes, "productionControls.generationMode"),
    reviewMode: expectOneOf(record.reviewMode, reviewModes, "productionControls.reviewMode"),
    approvedUnitPolicy: expectOneOf(record.approvedUnitPolicy, approvedUnitPolicies, "productionControls.approvedUnitPolicy"),
    defaultRepairIntensity: expectOneOf(
      record.defaultRepairIntensity,
      repairIntensities,
      "productionControls.defaultRepairIntensity",
    ),
    allowProduceUnreviewedNextUnit: expectBoolean(
      record.allowProduceUnreviewedNextUnit,
      "productionControls.allowProduceUnreviewedNextUnit",
    ),
    maxPreviousApprovedUnitsInPrompt: expectNumber(
      record.maxPreviousApprovedUnitsInPrompt,
      "productionControls.maxPreviousApprovedUnitsInPrompt",
    ),
    createdAt: expectString(record.createdAt, "productionControls.createdAt"),
    updatedAt: expectString(record.updatedAt, "productionControls.updatedAt"),
  };
}

export function parseStoryBible(value: unknown): StoryBible {
  const record = expectRecord(value, "storyBible");
  expectExactKeys(
    record,
    ["schemaVersion", "premise", "world", "themes", "characters", "scenes", "timeline", "continuityRules", "createdAt", "updatedAt"],
    "storyBible",
  );
  return {
    schemaVersion: expectSchemaVersion(record, "storyBible.schemaVersion"),
    premise: expectString(record.premise, "storyBible.premise"),
    world: expectString(record.world, "storyBible.world"),
    themes: expectStringArray(record.themes, "storyBible.themes"),
    characters: expectArray(record.characters, "storyBible.characters").map((item, index) =>
      parseStoryBibleCharacter(item, `storyBible.characters[${index}]`),
    ),
    scenes: expectArray(record.scenes, "storyBible.scenes").map((item, index) => parseStoryBibleScene(item, `storyBible.scenes[${index}]`)),
    timeline: expectArray(record.timeline, "storyBible.timeline").map((item, index) =>
      parseStoryBibleTimeEntry(item, `storyBible.timeline[${index}]`),
    ),
    continuityRules: expectStringArray(record.continuityRules, "storyBible.continuityRules"),
    createdAt: expectString(record.createdAt, "storyBible.createdAt"),
    updatedAt: expectString(record.updatedAt, "storyBible.updatedAt"),
  };
}

export function parsePrototypes(value: unknown): PrototypeRecord[] {
  return expectArray(value, "prototypes").map((item, index) => parsePrototypeRecord(item, `prototypes[${index}]`));
}

export function parseElementPools(value: unknown): ElementPoolRecord[] {
  return expectArray(value, "elementPools").map((item, index) => parseElementPoolRecord(item, `elementPools[${index}]`));
}

export function parseProductionPlan(value: unknown): ProductionPlan {
  const record = expectRecord(value, "productionPlan");
  expectExactKeys(
    record,
    ["schemaVersion", "logline", "structure", "acts", "productionNotes", "createdAt", "updatedAt"],
    "productionPlan",
  );
  return {
    schemaVersion: expectSchemaVersion(record, "productionPlan.schemaVersion"),
    logline: expectString(record.logline, "productionPlan.logline"),
    structure: expectString(record.structure, "productionPlan.structure"),
    acts: expectStringArray(record.acts, "productionPlan.acts"),
    productionNotes: expectStringArray(record.productionNotes, "productionPlan.productionNotes"),
    createdAt: expectString(record.createdAt, "productionPlan.createdAt"),
    updatedAt: expectString(record.updatedAt, "productionPlan.updatedAt"),
  };
}

export function parsePlotUnits(value: unknown): PlotUnitRecord[] {
  return expectArray(value, "plotUnits").map((item, index) => parsePlotUnitRecord(item, `plotUnits[${index}]`));
}

export function parseReviewRecord(value: unknown): ReviewRecord {
  const record = expectRecord(value, "review");
  expectExactKeys(record, ["id", "plotUnitId", "result", "reviewMode", "checklist", "issues", "decisionNotes", "createdAt"], "review");
  return {
    id: expectString(record.id, "review.id"),
    plotUnitId: expectString(record.plotUnitId, "review.plotUnitId"),
    result: expectOneOf(record.result, reviewResults, "review.result"),
    reviewMode: expectOneOf(record.reviewMode, reviewModes, "review.reviewMode"),
    checklist: parseReviewChecklist(record.checklist),
    issues: expectStringArray(record.issues, "review.issues"),
    decisionNotes: expectString(record.decisionNotes, "review.decisionNotes"),
    createdAt: expectString(record.createdAt, "review.createdAt"),
  };
}

export function parseRepairTask(value: unknown): RepairTaskRecord {
  const record = expectRecord(value, "repairTask");
  expectExactKeys(
    record,
    [
      "id",
      "targetType",
      "targetId",
      "createdFromReviewId",
      "reason",
      "scope",
      "intensity",
      "instructions",
      "status",
      "createdAt",
      "updatedAt",
    ],
    "repairTask",
  );
  return {
    id: expectString(record.id, "repairTask.id"),
    targetType: expectOneOf(record.targetType, repairTargetTypes, "repairTask.targetType"),
    targetId: expectString(record.targetId, "repairTask.targetId"),
    createdFromReviewId: expectString(record.createdFromReviewId, "repairTask.createdFromReviewId"),
    reason: expectString(record.reason, "repairTask.reason"),
    scope: expectOneOf(record.scope, repairScopes, "repairTask.scope"),
    intensity: expectOneOf(record.intensity, repairIntensities, "repairTask.intensity"),
    instructions: expectString(record.instructions, "repairTask.instructions"),
    status: expectOneOf(record.status, repairTaskStatuses, "repairTask.status"),
    createdAt: expectString(record.createdAt, "repairTask.createdAt"),
    updatedAt: expectString(record.updatedAt, "repairTask.updatedAt"),
  };
}

export function parseGenerationRun(value: unknown): GenerationRunRecord {
  const record = expectRecord(value, "generationRun");
  expectExactKeys(
    record,
    ["id", "plotUnitId", "status", "agent", "model", "promptSnapshot", "outputPath", "errorMessage", "createdAt", "updatedAt"],
    "generationRun",
  );
  return {
    id: expectString(record.id, "generationRun.id"),
    plotUnitId: expectString(record.plotUnitId, "generationRun.plotUnitId"),
    status: expectOneOf(record.status, generationRunStatuses, "generationRun.status"),
    agent: expectString(record.agent, "generationRun.agent"),
    model: expectString(record.model, "generationRun.model"),
    promptSnapshot: parsePromptSnapshot(record.promptSnapshot),
    outputPath: expectString(record.outputPath, "generationRun.outputPath"),
    errorMessage: expectString(record.errorMessage, "generationRun.errorMessage"),
    createdAt: expectString(record.createdAt, "generationRun.createdAt"),
    updatedAt: expectString(record.updatedAt, "generationRun.updatedAt"),
  };
}

export function createDefaultProductionControls(now: () => IsoTimestamp = () => new Date().toISOString()): ProductionControls {
  const timestamp = now();
  return {
    schemaVersion: 1,
    generationMode: "sequential",
    reviewMode: "manual",
    approvedUnitPolicy: "locked",
    defaultRepairIntensity: "medium",
    allowProduceUnreviewedNextUnit: false,
    maxPreviousApprovedUnitsInPrompt: 3,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createEmptyPrototypes(): PrototypeRecord[] {
  return [];
}

export function createEmptyElementPools(): ElementPoolRecord[] {
  return [];
}

export function transitionPlotUnitStatus(current: PlotUnitStatus, next: PlotUnitStatus): PlotUnitStatus {
  if (!allowedTransitions[current].includes(next)) {
    throw new Error(`Invalid plot unit status transition from ${current} to ${next}`);
  }
  return next;
}

function parseLengthTarget(value: unknown): NovelRequirements["lengthTarget"] {
  const record = expectRecord(value, "requirements.lengthTarget");
  expectExactKeys(record, ["totalWords", "unitWords"], "requirements.lengthTarget");
  return {
    totalWords: expectNumber(record.totalWords, "requirements.lengthTarget.totalWords"),
    unitWords: expectNumber(record.unitWords, "requirements.lengthTarget.unitWords"),
  };
}

function parseStoryBibleCharacter(value: unknown, label: string): StoryBibleCharacter {
  const record = expectRecord(value, label);
  expectExactKeys(record, ["id", "name", "role", "appearance", "personality", "motivation", "arc"], label);
  return {
    id: expectString(record.id, `${label}.id`),
    name: expectString(record.name, `${label}.name`),
    role: expectString(record.role, `${label}.role`),
    appearance: expectString(record.appearance, `${label}.appearance`),
    personality: expectString(record.personality, `${label}.personality`),
    motivation: expectString(record.motivation, `${label}.motivation`),
    arc: expectString(record.arc, `${label}.arc`),
  };
}

function parseStoryBibleScene(value: unknown, label: string): StoryBibleScene {
  const record = expectRecord(value, label);
  expectExactKeys(record, ["id", "name", "description"], label);
  return {
    id: expectString(record.id, `${label}.id`),
    name: expectString(record.name, `${label}.name`),
    description: expectString(record.description, `${label}.description`),
  };
}

function parseStoryBibleTimeEntry(value: unknown, label: string): StoryBibleTimeEntry {
  const record = expectRecord(value, label);
  expectExactKeys(record, ["id", "label", "description"], label);
  return {
    id: expectString(record.id, `${label}.id`),
    label: expectString(record.label, `${label}.label`),
    description: expectString(record.description, `${label}.description`),
  };
}

function parsePrototypeRecord(value: unknown, label: string): PrototypeRecord {
  const record = expectRecord(value, label);
  expectExactKeys(
    record,
    ["id", "type", "name", "description", "defaultElements", "defaultConstraints", "promptNotes", "source", "createdAt", "updatedAt"],
    label,
  );
  return {
    id: expectString(record.id, `${label}.id`),
    type: expectOneOf(record.type, prototypeTypes, `${label}.type`),
    name: expectString(record.name, `${label}.name`),
    description: expectString(record.description, `${label}.description`),
    defaultElements: expectStringArray(record.defaultElements, `${label}.defaultElements`),
    defaultConstraints: expectStringArray(record.defaultConstraints, `${label}.defaultConstraints`),
    promptNotes: expectStringArray(record.promptNotes, `${label}.promptNotes`),
    source: expectOneOf(record.source, prototypeSources, `${label}.source`),
    createdAt: expectString(record.createdAt, `${label}.createdAt`),
    updatedAt: expectString(record.updatedAt, `${label}.updatedAt`),
  };
}

function parseElementPoolRecord(value: unknown, label: string): ElementPoolRecord {
  const record = expectRecord(value, label);
  expectExactKeys(record, ["id", "kind", "name", "elements", "createdAt", "updatedAt"], label);
  return {
    id: expectString(record.id, `${label}.id`),
    kind: expectOneOf(record.kind, elementPoolKinds, `${label}.kind`),
    name: expectString(record.name, `${label}.name`),
    elements: expectArray(record.elements, `${label}.elements`).map((item, index) =>
      parseElementPoolElement(item, `${label}.elements[${index}]`),
    ),
    createdAt: expectString(record.createdAt, `${label}.createdAt`),
    updatedAt: expectString(record.updatedAt, `${label}.updatedAt`),
  };
}

function parseElementPoolElement(value: unknown, label: string): ElementPoolElement {
  const record = expectRecord(value, label);
  expectExactKeys(record, ["id", "category", "name", "description"], label);
  return {
    id: expectString(record.id, `${label}.id`),
    category: expectString(record.category, `${label}.category`),
    name: expectString(record.name, `${label}.name`),
    description: expectString(record.description, `${label}.description`),
  };
}

function parsePlotUnitRecord(value: unknown, label: string): PlotUnitRecord {
  const record = expectRecord(value, label);
  expectExactKeys(
    record,
    [
      "id",
      "orderIndex",
      "title",
      "purpose",
      "summary",
      "targetWords",
      "status",
      "prototypeIds",
      "inheritedElementPoolIds",
      "localElements",
      "bindings",
      "constraints",
      "draftPath",
      "currentRepairTaskId",
      "createdAt",
      "updatedAt",
    ],
    label,
  );
  const status = expectOneOf(record.status, plotUnitStatuses, `${label}.status`);
  return {
    id: expectString(record.id, `${label}.id`),
    orderIndex: expectNumber(record.orderIndex, `${label}.orderIndex`),
    title: expectString(record.title, `${label}.title`),
    purpose: expectString(record.purpose, `${label}.purpose`),
    summary: expectString(record.summary, `${label}.summary`),
    targetWords: expectNumber(record.targetWords, `${label}.targetWords`),
    status,
    prototypeIds: expectStringArray(record.prototypeIds, `${label}.prototypeIds`),
    inheritedElementPoolIds: expectStringArray(record.inheritedElementPoolIds, `${label}.inheritedElementPoolIds`),
    localElements: expectArray(record.localElements, `${label}.localElements`).map((item, index) =>
      parseElementPoolElement(item, `${label}.localElements[${index}]`),
    ),
    bindings: parsePlotUnitBindings(record.bindings, `${label}.bindings`),
    constraints: expectStringArray(record.constraints, `${label}.constraints`),
    draftPath: expectString(record.draftPath, `${label}.draftPath`),
    currentRepairTaskId: expectString(record.currentRepairTaskId, `${label}.currentRepairTaskId`),
    createdAt: expectString(record.createdAt, `${label}.createdAt`),
    updatedAt: expectString(record.updatedAt, `${label}.updatedAt`),
  };
}

function parsePlotUnitBindings(value: unknown, label: string): PlotUnitRecord["bindings"] {
  const record = expectRecord(value, label);
  expectExactKeys(record, ["characterIds", "sceneIds", "timeEntryIds"], label);
  return {
    characterIds: expectStringArray(record.characterIds, `${label}.characterIds`),
    sceneIds: expectStringArray(record.sceneIds, `${label}.sceneIds`),
    timeEntryIds: expectStringArray(record.timeEntryIds, `${label}.timeEntryIds`),
  };
}

function parseReviewChecklist(value: unknown): ReviewRecord["checklist"] {
  const record = expectRecord(value, "review.checklist");
  expectExactKeys(
    record,
    ["matchesRequirements", "matchesUnitPurpose", "continuityOk", "characterBehaviorOk", "styleOk", "chineseProseOk"],
    "review.checklist",
  );
  return {
    matchesRequirements: expectBoolean(record.matchesRequirements, "review.checklist.matchesRequirements"),
    matchesUnitPurpose: expectBoolean(record.matchesUnitPurpose, "review.checklist.matchesUnitPurpose"),
    continuityOk: expectBoolean(record.continuityOk, "review.checklist.continuityOk"),
    characterBehaviorOk: expectBoolean(record.characterBehaviorOk, "review.checklist.characterBehaviorOk"),
    styleOk: expectBoolean(record.styleOk, "review.checklist.styleOk"),
    chineseProseOk: expectBoolean(record.chineseProseOk, "review.checklist.chineseProseOk"),
  };
}

function parsePromptSnapshot(value: unknown): GenerationRunRecord["promptSnapshot"] {
  const record = expectRecord(value, "generationRun.promptSnapshot");
  expectExactKeys(
    record,
    [
      "requirements",
      "productionControls",
      "storyBible",
      "plan",
      "previousApprovedUnits",
      "currentUnit",
      "prototypes",
      "elementPools",
      "repairTask",
      "branchPrompt",
      "templateVersion",
    ],
    "generationRun.promptSnapshot",
  );
  return {
    requirements: parseRequirements(record.requirements),
    productionControls: parseProductionControls(record.productionControls),
    storyBible: parseStoryBible(record.storyBible),
    plan: parseProductionPlan(record.plan),
    previousApprovedUnits: expectArray(record.previousApprovedUnits, "generationRun.promptSnapshot.previousApprovedUnits").map(
      (item, index) => parsePreviousApprovedUnit(item, `generationRun.promptSnapshot.previousApprovedUnits[${index}]`),
    ),
    currentUnit: parsePlotUnitRecord(record.currentUnit, "generationRun.promptSnapshot.currentUnit"),
    prototypes: parsePrototypes(record.prototypes),
    elementPools: parseElementPools(record.elementPools),
    repairTask: record.repairTask === null ? null : parseRepairTask(record.repairTask),
    branchPrompt: expectString(record.branchPrompt, "generationRun.promptSnapshot.branchPrompt"),
    templateVersion: expectString(record.templateVersion, "generationRun.promptSnapshot.templateVersion"),
  };
}

function parsePreviousApprovedUnit(value: unknown, label: string): { unit: PlotUnitRecord; draft: string } {
  const record = expectRecord(value, label);
  expectExactKeys(record, ["unit", "draft"], label);
  return {
    unit: parsePlotUnitRecord(record.unit, `${label}.unit`),
    draft: expectString(record.draft, `${label}.draft`),
  };
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function expectExactKeys(record: Record<string, unknown>, allowedKeys: readonly string[], label: string): void {
  for (const key of Object.keys(record)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`${label}.${key} is not allowed`);
    }
  }
}

function expectSchemaVersion(record: Record<string, unknown>, label: string): 1 {
  if (record.schemaVersion !== 1) {
    throw new Error(`${label} must be 1`);
  }
  return 1;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value;
}

function expectNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function expectBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
  return value;
}

function expectArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function expectStringArray(value: unknown, label: string): string[] {
  return expectArray(value, label).map((item, index) => expectString(item, `${label}[${index}]`));
}

function expectOneOf<const Values extends readonly string[]>(value: unknown, values: Values, label: string): Values[number] {
  if (typeof value !== "string" || !stringArrayIncludes(values, value)) {
    throw new Error(`${label} has invalid value`);
  }
  return value;
}

function stringArrayIncludes<const Values extends readonly string[]>(values: Values, value: string): value is Values[number] {
  return values.some((allowedValue) => allowedValue === value);
}
