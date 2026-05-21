// managed-by: opencode-novel-production-line

import { tool } from "@opencode-ai/plugin";

import { readActiveBranchDraftPreview } from "../../src/novel-production/reader";
import { createNovelBranch, switchNovelBranch } from "../../src/novel-production/branches";
import { buildNovelBranchStatus } from "../../src/novel-production/branch-status";

type PluginShape = {
  tool: Record<string, ReturnType<typeof tool>>;
};

const schema = tool.schema;

export default async function novelProductionPlugin(_context?: unknown): Promise<PluginShape> {
  return {
    tool: {
      novel_production_status: tool({
        description: "Read the local novel production workspace status summary.",
        args: {
          root: schema.string().optional(),
        },
        async execute(input) {
          return {
            output: JSON.stringify({
              workspace: typeof input.root === "string" ? input.root : ".novel-production",
              note: "Use /novel-status for the full command-driven report.",
            }),
          };
        },
      }),
      novel_read: tool({
        description: "Read the active branch draft preview for a unit.",
        args: {
          unitId: schema.string(),
          root: schema.string().optional(),
          offset: schema.number().optional(),
          limit: schema.number().optional(),
        },
        async execute(input) {
          if ("branchId" in input) {
            throw new Error("novel_read does not accept branchId");
          }

          if (typeof input.unitId !== "string") {
            throw new Error("unitId must be a string");
          }

          if ("root" in input && typeof input.root !== "string") {
            throw new Error("root must be a string");
          }

          if ("offset" in input && typeof input.offset !== "number") {
            throw new Error("offset must be a number");
          }

          if ("limit" in input && typeof input.limit !== "number") {
            throw new Error("limit must be a number");
          }

          const root = typeof input.root === "string" ? input.root : process.cwd();
          const options: { offset?: number; limit?: number } = {};

          if (typeof input.offset === "number") {
            options.offset = input.offset;
          }

          if (typeof input.limit === "number") {
            options.limit = input.limit;
          }

          const preview = await readActiveBranchDraftPreview(root, input.unitId, options);

          return {
            output: JSON.stringify({
              branchId: preview.branchId,
              unitId: preview.unitId,
              path: preview.draftPath,
              offset: preview.offset,
              limit: preview.limit,
              text: preview.text,
            }),
          };
        },
      }),
      novel_branch_create: tool({
        description: "Create a novel production branch and make it active.",
        args: {
          branchId: schema.string(),
          root: schema.string().optional(),
          title: schema.string().optional(),
        },
        async execute(input) {
          const branchId = input.branchId;

          if (typeof branchId !== "string") {
            throw new Error("branchId must be a string");
          }

          if ("root" in input && typeof input.root !== "string") {
            throw new Error("root must be a string");
          }

          if ("title" in input && typeof input.title !== "string") {
            throw new Error("title must be a string");
          }

          const root = typeof input.root === "string" ? input.root : process.cwd();
          const options = typeof input.title === "string" ? { title: input.title } : {};

          await createNovelBranch(root, branchId, options);

          return { output: JSON.stringify({ branchId }) };
        },
      }),
      novel_branch_switch: tool({
        description: "Switch to an existing novel production branch.",
        args: {
          branchId: schema.string(),
          root: schema.string().optional(),
        },
        async execute(input) {
          const branchId = input.branchId;

          if (typeof branchId !== "string") {
            throw new Error("branchId must be a string");
          }

          if ("root" in input && typeof input.root !== "string") {
            throw new Error("root must be a string");
          }

          const root = typeof input.root === "string" ? input.root : process.cwd();

          await switchNovelBranch(root, branchId);

          return { output: JSON.stringify({ branchId }) };
        },
      }),
      novel_branch_status: tool({
        description: "Read the core novel branch status report.",
        args: {
          root: schema.string().optional(),
        },
        async execute(input) {
          if ("root" in input && typeof input.root !== "string") {
            throw new Error("root must be a string");
          }

          const root = typeof input.root === "string" ? input.root : process.cwd();

          return { output: JSON.stringify(await buildNovelBranchStatus(root)) };
        },
      }),
    },
  };
}
