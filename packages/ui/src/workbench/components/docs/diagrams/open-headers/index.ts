/**
 * Open Headers — top-level group diagrams.
 *
 * "What do we do (differently)" page:
 *   ParadigmShiftDiagram         — two-column us-vs-them comparison.
 *   ParadigmConvergenceDiagram   — three legacy categories collapsing into one extension.
 *   ParadigmRuleEngineDiagram    — DNR + Script engine columns, rule types, conditions + scopes.
 *   ParadigmApiCatalogDiagram    — request-editor mockup + protocol chips + capability strip.
 *   ParadigmLocalFirstDiagram    — back-end chooser: in-browser / desktop / daemon / VM.
 *   ParadigmFrontEndsDiagram     — front-end chooser: extension / desktop / CLI / web.
 *   ParadigmFieldSyncDiagram     — per-field sync across two surfaces, both edits land.
 *
 * Comparison page:
 *   ComparisonMatrixDiagram         — three product categories vs us.
 *   ComparisonVsCloudDiagram        — data-location flow (vs cloud API platforms).
 *   ComparisonVsProxyDiagram        — request-path + setup-cost (vs desktop proxies).
 *   ComparisonVsHeaderOnlyDiagram   — 9-tile capability grid (vs header-only).
 *
 * Roadmap page:
 *   RoadmapMilestonesDiagram        — overview: six ordered cards in a browser frame.
 *   RoadmapGitWorkspacesDiagram     — workspaces as Git repos.
 *   RoadmapDesktopAppDiagram        — native window over the same store.
 *   RoadmapServerDiagram            — daemon as the LAN sync hub.
 *   RoadmapCliDiagram               — headless terminal UI.
 *   RoadmapMcpArchitectureDiagram   — MCP Server wiring: AI client → MCP → OH → workbench.
 *   RoadmapMcpToolsDiagram          — MCP Server tools catalog (six domain cards).
 *   RoadmapWebAppDiagram            — self-hosted web bundle on your origin.
 *   RoadmapImportersDiagram         — collection-format funnel.
 */

export { ComparisonMatrixDiagram } from './comparison-matrix';
export { ComparisonVsCloudDiagram } from './comparison-vs-cloud';
export { ComparisonVsHeaderOnlyDiagram } from './comparison-vs-header-only';
export { ComparisonVsProxyDiagram } from './comparison-vs-proxy';
export { ParadigmApiCatalogDiagram } from './paradigm-api-catalog';
export { ParadigmConvergenceDiagram } from './paradigm-convergence';
export { ParadigmFieldSyncDiagram } from './paradigm-field-sync';
export { ParadigmFrontEndsDiagram } from './paradigm-front-ends';
export { ParadigmLocalFirstDiagram } from './paradigm-local-first';
export { ParadigmRuleEngineDiagram } from './paradigm-rule-engine';
export { ParadigmShiftDiagram } from './paradigm-shift';
export { RoadmapCliDiagram } from './roadmap-cli';
export { RoadmapDesktopAppDiagram } from './roadmap-desktop-app';
export { RoadmapGitWorkspacesDiagram } from './roadmap-git-workspaces';
export { RoadmapImportersDiagram } from './roadmap-importers';
export { RoadmapMcpArchitectureDiagram } from './roadmap-mcp-architecture';
export { RoadmapMcpToolsDiagram } from './roadmap-mcp-tools';
export { RoadmapMilestonesDiagram } from './roadmap-milestones';
export { RoadmapServerDiagram } from './roadmap-server';
export { RoadmapWebAppDiagram } from './roadmap-web-app';
