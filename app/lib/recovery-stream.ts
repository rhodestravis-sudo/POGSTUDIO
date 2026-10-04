// Inspect workspace structure without retaining image strings or whole POGs.
export type RecoveryPlan = {
  id: string; title: string; start: number; end: number;
  productCount: number; imageCount: number; sectionCount?: number;
  productsStart?: number; productsEnd?: number;
};
export type WorkspaceStructure = {
  plans: RecoveryPlan[];
  activeId?: string;
  activeIdStart?: number;
  activeIdEnd?: number;
  planogramsStart?: number;
  planogramsEnd?: number;
  rootStart?: number;
  rootEnd?: number;
};
type Frame = {
  type: string; key: string; wantsKey: boolean; count: number;
  role: string; plan?: RecoveryPlan;
};

export async function inspectWorkspaceStructure(
  body: ReadableStream<Uint8Array>,
  options: { stopAfterPlanIndex?: number } = {},
): Promise<WorkspaceStructure> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  const frames: Frame[] = [], structure: WorkspaceStructure = { plans: [] };
  let offset = 0, inString = false, escapeNext = false;
  let raw = "", stringStart = 0, primitive = false, rootClosed = false;
  const append = (part: string) => { if (raw.length <= 4096) raw += part.slice(0, 4097); };
  const valueStarted = () => {
    const parent = frames.at(-1);
    if (parent?.type === "[") parent.count++;
  };
  const stringDone = (end: number) => {
    const parent = frames.at(-1);
    if (!parent) throw new Error("Invalid workspace");
    const small = raw.length <= 4096 ? JSON.parse(raw) as string : "";
    if (parent.type === "{" && parent.wantsKey) {
      parent.key = small; parent.wantsKey = false;
    } else {
      valueStarted();
      if (parent.role === "root" && parent.key === "activeId") {
        structure.activeId = small;
        structure.activeIdStart = stringStart;
        structure.activeIdEnd = end;
      }
      if (parent.role === "plan" && parent.plan) {
        if (parent.key === "title") parent.plan.title = small;
        if (parent.key === "id") parent.plan.id = small;
      }
      if (parent.role === "product" && parent.key === "image" && end - stringStart > 2)
        parent.plan!.imageCount++;
    }
  };
  try {
    for (;;) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      let i = 0;
      while (i < chunk.length) {
        if (inString) {
          const begin = i;
          if (escapeNext) { i++; escapeNext = false; }
          const marks = /["\\]/g;
          marks.lastIndex = i;
          let match: RegExpExecArray | null;
          let closed = false;
          while ((match = marks.exec(chunk))) {
            i = match.index;
            if (chunk[i] === "\\") {
              if (i + 1 === chunk.length) { escapeNext = true; i++; break; }
              i += 2; marks.lastIndex = i;
            } else { i++; closed = true; break; }
          }
          if (!match) i = chunk.length;
          append(chunk.slice(begin, i));
          if (closed) { inString = false; stringDone(offset + i); raw = ""; }
          continue;
        }
        const c = chunk[i], position = offset + i;
        if (/\s/.test(c)) { primitive = false; i++; continue; }
        if (c === '"') {
          inString = true; raw = '"'; stringStart = position; primitive = false; i++; continue;
        }
        if (c === "{" || c === "[") {
          primitive = false;
          const parent = frames.at(-1);
          valueStarted();
          let role = "other", plan = parent?.plan;
          if (!parent && c === "{") {
            role = "root";
            structure.rootStart = position;
          }
          else if (parent?.role === "root" && parent.key === "planograms" && c === "[") {
            role = "plans";
            structure.planogramsStart = position;
          }
          else if (parent?.role === "plans" && c === "{") {
            role = "plan";
            plan = { id: "", title: "Untitled POG", start: position, end: 0, productCount: 0, imageCount: 0 };
          } else if (parent?.role === "plan" && parent.key === "products" && c === "[") {
            role = "products"; plan!.productsStart = position;
          } else if (parent?.role === "plan" && parent.key === "sections" && c === "[") {
            role = "sections";
          } else if (parent?.role === "products" && c === "{") role = "product";
          frames.push({ type: c, key: "", wantsKey: c === "{", count: 0, role, plan });
          i++; continue;
        }
        if (c === "}" || c === "]") {
          primitive = false;
          const frame = frames.pop();
          if (!frame || frame.type !== (c === "}" ? "{" : "[")) throw new Error("Incomplete workspace");
          if (frame.role === "products") {
            frame.plan!.productsEnd = position + 1; frame.plan!.productCount = frame.count;
          }
          if (frame.role === "sections") frame.plan!.sectionCount = frame.count;
          if (frame.role === "plans") structure.planogramsEnd = position + 1;
          if (frame.role === "plan") {
            frame.plan!.end = position + 1;
            structure.plans.push(frame.plan!);
            if (structure.plans.length - 1 === options.stopAfterPlanIndex) {
              await reader.cancel();
              return structure;
            }
          }
          if (frame.role === "root") {
            rootClosed = true;
            structure.rootEnd = position + 1;
          }
          i++; continue;
        }
        if (c === "," || c === ":") {
          primitive = false;
          if (c === "," && frames.at(-1)?.type === "{") frames.at(-1)!.wantsKey = true;
          i++; continue;
        }
        if (!primitive) { valueStarted(); primitive = true; }
        i++;
      }
      offset += chunk.length;
    }
    if (inString || frames.length || !rootClosed) throw new Error("Incomplete workspace; original preserved");
    return structure;
  } finally { reader.releaseLock(); }
}

export async function inspectWorkspace(body: ReadableStream<Uint8Array>) {
  return (await inspectWorkspaceStructure(body)).plans;
}

// Honor backpressure, including when a browser pauses or cancels a download.
export function sliceWorkspace(body: ReadableStream<Uint8Array>, start: number, end: number, prefix = "", suffix = "") {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  const encoder = new TextEncoder();
  let offset = 0, first = true, finished = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (first) { first = false; if (prefix) { controller.enqueue(encoder.encode(prefix)); return; } }
      if (finished) { if (suffix) controller.enqueue(encoder.encode(suffix)); controller.close(); return; }
      for (;;) {
        const { done, value } = await reader.read();
        if (done) { controller.error(new Error("Saved copy ended unexpectedly")); return; }
        const from = Math.max(0, start - offset), to = Math.min(value.length, end - offset);
        offset += value.length;
        if (offset >= end) { finished = true; await reader.cancel(); }
        if (to > from) { controller.enqueue(encoder.encode(value.slice(from, to))); return; }
        if (finished) { controller.error(new Error("Invalid recovery range")); return; }
      }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
}
