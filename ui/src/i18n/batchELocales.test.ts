import { describe, expect, it } from "vitest";
import { resources } from "./resources";

describe("Batch E locale resources", () => {
  it("adds the remaining onboarding and command palette translations to common", () => {
    expect(resources.en.common).toMatchObject({
      onboarding: {
        wizard: {
          steps: {
            company: "Company",
            agent: "Agent",
            task: "Task",
            launch: "Launch",
          },
        },
      },
      commandPalette: {
        groups: {
          actions: "Actions",
          pages: "Pages",
          issues: "Issues",
          agents: "Agents",
          projects: "Projects",
        },
      },
    });

    expect(resources["zh-CN"].common).toMatchObject({
      onboarding: {
        wizard: {
          steps: {
            company: "公司",
            agent: "代理",
            task: "任务",
            launch: "启动",
          },
        },
      },
      commandPalette: {
        groups: {
          actions: "操作",
          pages: "页面",
          issues: "议题",
          agents: "代理",
          projects: "项目",
        },
      },
    });
  });

  it("adds company and workspaces namespaces for the remaining Batch E pages", () => {
    expect(resources.en).toHaveProperty("company");
    expect(resources["zh-CN"]).toHaveProperty("company");
    expect(resources.en).toHaveProperty("workspaces");
    expect(resources["zh-CN"]).toHaveProperty("workspaces");

    expect(resources.en.company).toMatchObject({
      settings: {
        title: "Company Settings",
      },
      import: {
        title: "Import source",
      },
      export: {
        packageFiles: "Package files",
      },
      skills: {
        title: "Skills",
      },
    });

    expect(resources["zh-CN"].company).toMatchObject({
      settings: {
        title: "公司设置",
      },
      import: {
        title: "导入来源",
      },
      export: {
        packageFiles: "包文件",
      },
      skills: {
        title: "技能",
      },
    });

    expect(resources.en.workspaces).toMatchObject({
      closeDialog: {
        actions: {
          closeWorkspace: "Close workspace",
        },
      },
    });

    expect(resources["zh-CN"].workspaces).toMatchObject({
      closeDialog: {
        actions: {
          closeWorkspace: "关闭工作区",
        },
      },
    });
  });
});
