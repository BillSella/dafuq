import type { AppModuleId } from "../moduleTypes";

export type HelpDocSection = {
  id: string;
  title: string;
  bullets: string[];
};

export type ModuleHelpDoc = {
  moduleId: AppModuleId | "application";
  title: string;
  summary: string;
  sections: HelpDocSection[];
};
