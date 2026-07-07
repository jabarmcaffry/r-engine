import type { WorkerInitData } from "../server-common/worker-data.ts";


export const rewriteStackTraces = (workerData: WorkerInitData) => {
  if (!workerData.rewriteStackTraces) return;

  const original = Error.prepareStackTrace;
  if (typeof original !== "function") return;

  const { worldsDirectory, worldId } = workerData;
  const worldDirectory = `${worldsDirectory}/${worldId}`;

  const mapLine = (line: string): string => line.replace(`(${worldDirectory}`, "(res:/");

  // deno-lint-ignore no-explicit-any
  Error.prepareStackTrace = (error: Error, stack: any[]) => {
    const result = original(error, stack);
    return result.split("\n").map(mapLine).join("\n");
  };
};
