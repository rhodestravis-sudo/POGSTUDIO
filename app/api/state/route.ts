import { getDb } from "../../../db";
import { planogramState, userWorkspaceState } from "../../../db/schema";
import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { OWNER_EMAIL, recordBetaEvent } from "@/app/lib/analytics";
import { ownerWorkspaceKey, resolveRequestIdentity } from "@/app/lib/app-auth";
import { inspectWorkspaceStructure, sliceWorkspace } from "@/app/lib/recovery-stream";

type StoredPlanogram = {
  id?: string;
  title?: string;
  products?: unknown[];
  sections?: unknown[];
  sourcePsaText?: string;
  sourcePsaKey?: string;
};
type StoredWorkspace = {
  activeId?: string;
  planograms?: StoredPlanogram[];
  [key: string]: unknown;
};

type PlanCacheEntry = {
  id: string;
  title: string;
  productCount: number;
  sectionCount: number;
  r2Key?: string;
};
type StatePointer = {
  r2Key: string;
  encoding?: "gzip";
  activeId?: string;
  planograms?: PlanCacheEntry[];
};
const noStoreHeaders = { "cache-control": "no-store" };
const jsonHeaders = {
  ...noStoreHeaders,
  "content-type": "application/json",
};
const streamedStateHeader = "workspace-json";
const encoder = new TextEncoder();
const ownerRetainedWorkspaceData =
  '{"r2Key":"workspace/EuxVKjCkUK5XHrnr8KdeFSToz3Rw9hunZGYDJXzTNKLaSfuYMn5LWh/state-1790012704323.json","encoding":"gzip"}';

const safeUserKey = (userKey: string) => userKey.replace(/[^a-zA-Z0-9_-]/g, "");

const workspaceStateKey = (userKey: string, revision: number) =>
  `workspace/${safeUserKey(userKey)}/state-${revision}.json`;

const workspacePlanKey = (userKey: string, planId: string, revision: number) =>
  `workspace/${safeUserKey(userKey)}/plans/${planId.replace(/[^a-zA-Z0-9_-]/g, "") || "pog"}-${revision}.json`;

const isOwnedWorkspaceKey = (userKey: string, r2Key: string) =>
  r2Key.startsWith(`workspace/${safeUserKey(userKey)}/`);

const statePointer = (data: string): StatePointer | null => {
  try {
    const parsed = JSON.parse(data) as Partial<StatePointer>;
    if (typeof parsed.r2Key !== "string") return null;
    return {
      r2Key: parsed.r2Key,
      encoding: parsed.encoding === "gzip" ? "gzip" : undefined,
      activeId: typeof parsed.activeId === "string" ? parsed.activeId : undefined,
      planograms: Array.isArray(parsed.planograms)
        ? parsed.planograms
            .map((item) => {
              const value = item as Partial<PlanCacheEntry>;
              if (typeof value.id !== "string") return null;
              return {
                id: value.id,
                title: typeof value.title === "string" ? value.title : "Untitled POG",
                productCount: typeof value.productCount === "number" ? value.productCount : 0,
                sectionCount: typeof value.sectionCount === "number" ? value.sectionCount : 0,
                r2Key: typeof value.r2Key === "string" ? value.r2Key : undefined,
              };
            })
            .filter((item): item is PlanCacheEntry => !!item)
        : undefined,
    };
  } catch {
    return null;
  }
};

async function readState(data: string) {
  const pointer = statePointer(data);
  if (!pointer) return JSON.parse(data);
  const object = await env.BUCKET.get(pointer.r2Key);
  if (!object) throw new Error("Saved workspace is unavailable");
  const body =
    pointer.encoding === "gzip"
      ? object.body.pipeThrough(new DecompressionStream("gzip"))
      : object.body;
  return JSON.parse(await new Response(body).text());
}

const streamFromText = (value: string) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(value));
      controller.close();
    },
  });

async function stateBodyStream(data: string) {
  const pointer = statePointer(data);
  if (!pointer) return streamFromText(data);
  const object = await env.BUCKET.get(pointer.r2Key);
  if (!object) throw new Error("Saved workspace is unavailable");
  return pointer.encoding === "gzip"
    ? object.body.pipeThrough(new DecompressionStream("gzip"))
    : object.body;
}

function streamJsonStateEnvelope(
  stateStream: ReadableStream<Uint8Array>,
  meta: Record<string, unknown>,
) {
  const metaJson = JSON.stringify(meta),
    suffix = metaJson === "{}" ? "}" : `,${metaJson.slice(1)}`;
  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode('{"state":'));
        const reader = stateStream.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) controller.enqueue(value);
          }
        } finally {
          reader.releaseLock();
        }
        controller.enqueue(encoder.encode(suffix));
        controller.close();
      },
    }),
    { headers: jsonHeaders },
  );
}

async function streamStateResponse(
  data: string,
  meta: Record<string, unknown>,
) {
  return streamJsonStateEnvelope(await stateBodyStream(data), meta);
}

async function cachedPlanStream(pointer: StatePointer, requestedPlanogramId?: string | null) {
  const entry = requestedPlanogramId
    ? pointer.planograms?.find((item) => item.id === requestedPlanogramId)
    : pointer.planograms?.find((item) => item.id === pointer.activeId) ??
      pointer.planograms?.find((item) => item.r2Key);
  if (!entry?.r2Key) return null;
  const object = await env.BUCKET.get(entry.r2Key);
  if (!object) return null;
  return {
    entry,
    summaries: pointer.planograms ?? [],
    stream: object.body,
  };
}

function singlePlanStateStream(planStream: ReadableStream<Uint8Array>, planId: string) {
  const output = new TransformStream<Uint8Array, Uint8Array>(),
    writer = output.writable.getWriter();
  void (async () => {
    const reader = planStream.getReader();
    try {
      await writer.write(encoder.encode(`{"activeId":${JSON.stringify(planId)},"planograms":[`));
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) await writer.write(value);
      }
      await writer.write(encoder.encode("]}"));
      await writer.close();
    } catch (error) {
      await writer.abort(error);
    } finally {
      reader.releaseLock();
    }
  })();
  return output.readable;
}

async function cacheActivePlan(
  data: string,
  userKey: string | undefined,
  baseRevision: number | undefined,
  activePlan: { id: string; title: string; productCount: number; sectionCount?: number; start: number; end: number },
  summaries: PlanCacheEntry[],
  summariesAreComplete: boolean,
) {
  if (!userKey || baseRevision === undefined || !activePlan.id) return null;
  const pointer = statePointer(data);
  if (!pointer) return null;
  const r2Key = workspacePlanKey(userKey, activePlan.id, baseRevision);
  await env.BUCKET.put(
    r2Key,
    sliceWorkspace(await stateBodyStream(data), activePlan.start, activePlan.end),
    { httpMetadata: { contentType: "application/json" } },
  );
  const existingCacheById = new Map(
      (pointer.planograms ?? [])
        .filter((item) => item.r2Key)
        .map((item) => [item.id, item.r2Key]),
    ),
    sourceSummaries = summariesAreComplete
      ? summaries.map((item) => ({
          ...item,
          r2Key: existingCacheById.get(item.id),
        }))
      : pointer.planograms?.length && pointer.planograms.length >= summaries.length
        ? pointer.planograms
        : summaries,
    cachedActive = {
      id: activePlan.id,
      title: activePlan.title,
      productCount: activePlan.productCount,
      sectionCount: activePlan.sectionCount ?? 0,
      r2Key,
    },
    mergedSummaries = sourceSummaries.some((item) => item.id === activePlan.id)
      ? sourceSummaries.map((item) =>
          item.id === activePlan.id ? { ...item, ...cachedActive } : item,
        )
      : [...sourceSummaries, cachedActive];
  const nextPointer: StatePointer = {
    ...pointer,
    activeId: activePlan.id,
    planograms: mergedSummaries,
  };
  await getDb()
    .update(userWorkspaceState)
    .set({ data: JSON.stringify(nextPointer) })
    .where(and(eq(userWorkspaceState.userKey, userKey), eq(userWorkspaceState.updatedAt, baseRevision)));
  return nextPointer;
}

async function activeStateResponse(
  data: string,
  meta: Record<string, unknown>,
  requestedPlanogramId?: string | null,
  requestedPlanogramIndex?: number | null,
  cache?: { userKey?: string; revision?: number },
  cacheOnly = false,
) {
  const pointer = statePointer(data),
    indexedPlanogramId =
      pointer &&
      !requestedPlanogramId &&
      Number.isInteger(requestedPlanogramIndex) &&
      requestedPlanogramIndex !== null &&
      requestedPlanogramIndex >= 0
        ? pointer.planograms?.[requestedPlanogramIndex]?.id
        : undefined,
    resolvedPlanogramId = requestedPlanogramId || indexedPlanogramId,
    cached = pointer && resolvedPlanogramId
      ? await cachedPlanStream(pointer, resolvedPlanogramId)
      : null;
  if (cached && cacheOnly)
    return Response.json(
      {
        ok: true,
        cached: true,
        planogramSummaries: cached.summaries,
        partialWorkspace: true,
        ...meta,
      },
      { headers: jsonHeaders },
    );
  if (cached)
    return streamJsonStateEnvelope(
      singlePlanStateStream(cached.stream, cached.entry.id),
      {
        planogramSummaries: cached.summaries,
        partialWorkspace: true,
        ...meta,
      },
    );
  const quickStructure = Number.isInteger(requestedPlanogramIndex) && requestedPlanogramIndex !== null && requestedPlanogramIndex >= 0
      ? await inspectWorkspaceStructure(await stateBodyStream(data), {
          stopAfterPlanIndex: requestedPlanogramIndex,
        })
      : null,
    quickPlan = quickStructure?.plans[requestedPlanogramIndex ?? -1] ?? null,
    useQuickPlan =
      quickPlan &&
      (!resolvedPlanogramId || quickPlan.id === resolvedPlanogramId),
    structure = useQuickPlan
      ? quickStructure
      : await inspectWorkspaceStructure(await stateBodyStream(data)),
    summaries = structure.plans
      .map((item) => ({
        id: item.id,
        title: item.title,
        productCount: item.productCount,
        sectionCount: item.sectionCount ?? 0,
      }))
      .filter((item) => item.id),
    activeId = resolvedPlanogramId || structure.activeId || summaries[0]?.id,
    activePlan = useQuickPlan
      ? quickPlan
      : structure.plans.find((item) => item.id === activeId) ?? structure.plans[0] ?? null,
    includeSummaries = !useQuickPlan;
  if (!activePlan)
    return Response.json(
      {
        state: { activeId: "", planograms: [] },
        ...(includeSummaries ? { planogramSummaries: summaries } : {}),
        partialWorkspace: true,
        ...meta,
      },
      { headers: jsonHeaders },
    );
  const cachePointer = await cacheActivePlan(
    data,
    cache?.userKey,
    cache?.revision,
    activePlan,
    summaries,
    includeSummaries,
  ).catch(() => null);
  if (cacheOnly)
    return Response.json(
      {
        ok: true,
        cached: Boolean(cachePointer),
        planogramId: activePlan.id,
        planogramSummaries: cachePointer?.planograms ?? summaries,
        partialWorkspace: true,
        ...meta,
      },
      { headers: jsonHeaders },
    );
  const rawPlanStream = cachePointer?.planograms?.find((item) => item.id === activePlan.id)?.r2Key
    ? (await env.BUCKET.get(cachePointer.planograms.find((item) => item.id === activePlan.id)!.r2Key!))?.body
    : sliceWorkspace(
    await stateBodyStream(data),
    activePlan.start,
    activePlan.end,
  );
  if (!rawPlanStream) throw new Error("Saved POG is unavailable");
  return streamJsonStateEnvelope(singlePlanStateStream(rawPlanStream, activePlan.id), {
    planogramSummaries: cachePointer?.planograms ?? (includeSummaries ? summaries : undefined),
    partialWorkspace: true,
    ...meta,
  });
}

async function externalizePsaSources(state: unknown) {
  const compacted = structuredClone(state) as {
    planograms?: StoredPlanogram[];
    versions?: Array<{ planogram?: StoredPlanogram }>;
    trash?: Array<{ planogram?: StoredPlanogram }>;
  };
  const plans = [
    ...(compacted.planograms ?? []),
    ...(compacted.versions ?? []).map((item) => item.planogram),
    ...(compacted.trash ?? []).map((item) => item.planogram),
  ].filter((item): item is StoredPlanogram => !!item);
  const keys: Record<string, string> = {};
  for (const plan of plans) {
    if (!plan.id || !plan.sourcePsaText) continue;
    const knownKey = keys[plan.id] || plan.sourcePsaKey;
    const key =
      knownKey ||
      `psa/${plan.id.replace(/[^a-zA-Z0-9_-]/g, "")}-${Date.now()}.psa`;
    if (!knownKey)
      await env.BUCKET.put(key, plan.sourcePsaText, {
        httpMetadata: { contentType: "text/plain" },
      });
    keys[plan.id] = key;
    plan.sourcePsaKey = key;
    delete plan.sourcePsaText;
  }
  return { compacted, keys };
}

async function readStateRequest(request: Request) {
  if (request.headers.get("x-planogram-compression") !== "gzip")
    return request.json();
  if (!request.body) throw new Error("Missing compressed workspace");
  const decompressed = request.body.pipeThrough(new DecompressionStream("gzip"));
  return new Response(decompressed).json();
}

async function readWorkspaceRequest(request: Request) {
  if (request.headers.get("x-planogram-compression") !== "gzip")
    return request.json();
  if (!request.body) throw new Error("Missing compressed workspace");
  const decompressed = request.body.pipeThrough(new DecompressionStream("gzip"));
  return new Response(decompressed).json();
}

const headerRevision = (request: Request) => {
  const raw = request.headers.get("x-planogram-base-revision");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

const headerForce = (request: Request) =>
  request.headers.get("x-planogram-force") === "1";

const headerCount = (request: Request, name: string) => {
  const value = Number(request.headers.get(name));
  return Number.isFinite(value) ? value : null;
};

async function writeStreamedState(request: Request, userKey: string, revision: number) {
  if (!request.body) throw new Error("Missing workspace");
  const r2Key = workspaceStateKey(userKey, revision),
    compression = request.headers.get("x-planogram-compression");
  await env.BUCKET.put(r2Key, request.body, {
    httpMetadata: { contentType: "application/json" },
  });
  return compression === "gzip"
    ? { r2Key, encoding: "gzip" as const }
    : { r2Key };
}

type WorkspaceEdit = { start: number; end: number; text: string };

function rewriteWorkspace(
  body: ReadableStream<Uint8Array>,
  edits: WorkspaceEdit[],
  finalEnd: number,
) {
  const ordered = edits
      .slice()
      .sort((a, b) => a.start - b.start || a.end - b.end)
      .map((edit) => ({ ...edit, emitted: false })),
    output = new TransformStream<Uint8Array, Uint8Array>(),
    writer = output.writable.getWriter();
  void (async () => {
    const reader = body.pipeThrough(new TextDecoderStream()).getReader();
    try {
      let offset = 0, editIndex = 0;
      const writeText = async (value: string) => {
        if (!value) return;
        await writer.ready;
        await writer.write(encoder.encode(value));
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const sourceChunkStart = offset,
          sourceChunkEnd = offset + value.length;
        offset = sourceChunkEnd;
        if (sourceChunkStart >= finalEnd) {
          await reader.cancel();
          break;
        }
        const chunkEnd = Math.min(sourceChunkEnd, finalEnd),
          chunk = value.slice(0, chunkEnd - sourceChunkStart);
        let position = sourceChunkStart;
        while (
          position < chunkEnd ||
          (editIndex < ordered.length &&
            ordered[editIndex].start === position &&
            ordered[editIndex].end === position)
        ) {
          const edit = ordered[editIndex];
          if (!edit) {
            await writeText(chunk.slice(position - sourceChunkStart));
            position = chunkEnd;
            break;
          }
          if (edit.end < position || (edit.end === position && edit.end !== edit.start)) {
            editIndex++;
            continue;
          }
          if (edit.start > position) {
            const copyEnd = Math.min(edit.start, chunkEnd);
            await writeText(chunk.slice(position - sourceChunkStart, copyEnd - sourceChunkStart));
            position = copyEnd;
            continue;
          }
          if (!edit.emitted) {
            await writeText(edit.text);
            edit.emitted = true;
          }
          if (edit.start === edit.end) {
            editIndex++;
            continue;
          }
          position = Math.min(edit.end, chunkEnd);
          if (position >= edit.end) editIndex++;
        }
        if (sourceChunkEnd >= finalEnd) {
          await reader.cancel();
          break;
        }
      }
      await writer.close();
    } catch (error) {
      await writer.abort(error);
    } finally {
      reader.releaseLock();
    }
  })();
  return output.readable;
}

async function writeActivePlanState(
  existingData: string,
  incomingPlan: StoredPlanogram,
  userKey: string,
  revision: number,
) {
  const existingPointer = statePointer(existingData),
    structure = await inspectWorkspaceStructure(await stateBodyStream(existingData));
  if (
    structure.rootEnd === undefined ||
    structure.planogramsStart === undefined ||
    structure.planogramsEnd === undefined
  )
    throw new Error("Saved workspace structure is unavailable");
  const planJson = JSON.stringify(incomingPlan),
    edits: WorkspaceEdit[] = [],
    currentPlan = structure.plans.find((item) => item.id === incomingPlan.id);
  if (incomingPlan.id) {
    const nextActiveId = JSON.stringify(incomingPlan.id);
    if (structure.activeIdStart !== undefined && structure.activeIdEnd !== undefined)
      edits.push({
        start: structure.activeIdStart,
        end: structure.activeIdEnd,
        text: nextActiveId,
      });
    else if (structure.rootStart !== undefined)
      edits.push({
        start: structure.rootStart + 1,
        end: structure.rootStart + 1,
        text: `"activeId":${nextActiveId},`,
      });
  }
  if (currentPlan)
    edits.push({ start: currentPlan.start, end: currentPlan.end, text: planJson });
  else {
    const insertAt = structure.planogramsEnd - 1,
      comma = structure.plans.length ? "," : "";
    edits.push({ start: insertAt, end: insertAt, text: `${comma}${planJson}` });
  }
  const r2Key = workspaceStateKey(userKey, revision);
  await env.BUCKET.put(
    r2Key,
    rewriteWorkspace(await stateBodyStream(existingData), edits, structure.rootEnd),
    { httpMetadata: { contentType: "application/json" } },
  );
  const planCacheKey = workspacePlanKey(userKey, incomingPlan.id, revision);
  await env.BUCKET.put(planCacheKey, planJson, {
    httpMetadata: { contentType: "application/json" },
  });
  const scannedSummaries = structure.plans.map((item) => ({
      id: item.id,
      title: item.title,
      productCount: item.productCount,
      sectionCount: item.sectionCount ?? 0,
    })),
    existingSummaries = existingPointer?.planograms?.length
      ? existingPointer.planograms
      : scannedSummaries,
    incomingSummary = {
      id: incomingPlan.id,
      title: incomingPlan.title ?? "Untitled POG",
      productCount: incomingPlan.products?.length ?? 0,
      sectionCount: incomingPlan.sections?.length ?? 0,
      r2Key: planCacheKey,
    },
    nextSummaries = existingSummaries.some((item) => item.id === incomingPlan.id)
      ? existingSummaries.map((item) => item.id === incomingPlan.id ? { ...item, ...incomingSummary } : item)
      : [...existingSummaries, incomingSummary];
  return {
    r2Key,
    activeId: incomingPlan.id,
    planograms: nextSummaries,
  };
}

async function legacyWorkspaceData() {
  const [legacy] = await getDb()
    .select()
    .from(planogramState)
    .where(eq(planogramState.id, 1))
    .limit(1);
  return legacy?.data ?? null;
}

async function workspaceStructureOrNull(data: string) {
  try {
    return await inspectWorkspaceStructure(await stateBodyStream(data));
  } catch {
    return null;
  }
}

async function readPlanSlice(data: string, start: number, end: number) {
  return new Response(sliceWorkspace(await stateBodyStream(data), start, end)).json() as Promise<StoredPlanogram>;
}

async function persistRecoveredWorkspace(
  data: string,
  identity: NonNullable<Awaited<ReturnType<typeof resolveRequestIdentity>>>,
  revision: number,
) {
  await getDb()
    .update(userWorkspaceState)
    .set({ data })
    .where(and(eq(userWorkspaceState.userKey, identity.userKey), eq(userWorkspaceState.updatedAt, revision)));
  return { data, revision, repaired: true };
}

async function repairOwnerWorkspaceIfNeeded(
  data: string,
  identity: NonNullable<Awaited<ReturnType<typeof resolveRequestIdentity>>>,
  revision: number,
) {
  if (identity.email !== OWNER_EMAIL)
    return { data, revision, repaired: false };
  const pointer = statePointer(data);
  if ((pointer?.planograms?.length ?? 0) > 1)
    return { data, revision, repaired: false };

  const currentStructure = await workspaceStructureOrNull(data);
  if (currentStructure && currentStructure.plans.length > 1)
    return { data, revision, repaired: false };

  const legacy = await legacyWorkspaceData(),
    candidates = [ownerRetainedWorkspaceData, legacy].filter((item): item is string => !!item);
  let bestData: string | null = null,
    bestCount = currentStructure?.plans.length ?? 0;
  for (const candidate of candidates) {
    const structure = await workspaceStructureOrNull(candidate);
    if (structure && structure.plans.length > bestCount) {
      bestData = candidate;
      bestCount = structure.plans.length;
    }
  }
  if (!bestData) return { data, revision, repaired: false };
  if (!currentStructure)
    return persistRecoveredWorkspace(bestData, identity, revision);

  const currentPlan = currentStructure.plans[0]
    ? await readPlanSlice(data, currentStructure.plans[0].start, currentStructure.plans[0].end).catch(() => null)
    : null;
  if (!currentPlan?.id) return persistRecoveredWorkspace(bestData, identity, revision);

  try {
    const nextRevision = Date.now(),
      pointer = await writeActivePlanState(bestData, currentPlan, identity.userKey, nextRevision),
      pointerData = JSON.stringify(pointer);
    const repairedStructure = await workspaceStructureOrNull(pointerData);
    if (!repairedStructure || repairedStructure.plans.length < bestCount)
      return { data: bestData, revision, repaired: false };
    const updated = await getDb()
        .update(userWorkspaceState)
        .set({ data: pointerData, updatedAt: nextRevision })
        .where(and(eq(userWorkspaceState.userKey, identity.userKey), eq(userWorkspaceState.updatedAt, revision)))
        .returning({ revision: userWorkspaceState.updatedAt });
    if (updated.length) return { data: pointerData, revision: nextRevision, repaired: true };
  } catch {
    // Showing the retained full workspace is safer than failing the entire load.
  }
  return persistRecoveredWorkspace(bestData, identity, revision);
}

async function saveStreamedState(request: Request, identity: NonNullable<Awaited<ReturnType<typeof resolveRequestIdentity>>>) {
  const db = getDb(),
    [existing] = await db
      .select()
      .from(userWorkspaceState)
      .where(eq(userWorkspaceState.userKey, identity.userKey))
      .limit(1),
    baseRevision = headerRevision(request),
    force = headerForce(request),
    revision = Date.now();
  if (request.headers.get("x-planogram-active-only") === "1") {
    const incoming = (await readWorkspaceRequest(request)) as StoredWorkspace,
      incomingPlan = incoming.planograms?.find((item) => item.id === incoming.activeId) ?? incoming.planograms?.[0];
    if (!incomingPlan?.id)
      return Response.json({ error: "Active planogram is required" }, { status: 400 });
    if (existing && !force && baseRevision !== existing.updatedAt) {
      await recordBetaEvent(request, {
        eventType: "save",
        action: "workspace_conflict",
        outcome: "friction",
      }).catch(() => {});
      return Response.json(
        { error: "A newer cloud version exists.", revision: existing.updatedAt },
        { status: 409 },
      );
    }
    const pointer = existing
      ? await writeActivePlanState(
          existing.data,
          incomingPlan,
          identity.userKey,
          revision,
        )
      : { r2Key: workspaceStateKey(identity.userKey, revision) };
    if (!existing)
      await env.BUCKET.put(
        pointer.r2Key,
        JSON.stringify({
          ...incoming,
          activeId: incomingPlan.id,
          planograms: [incomingPlan],
        }),
        { httpMetadata: { contentType: "application/json" } },
      );
    if (!existing) {
      await db.insert(userWorkspaceState).values({
        userKey: identity.userKey,
        data: JSON.stringify(pointer),
        updatedAt: revision,
      });
    } else {
      const updated = await db.update(userWorkspaceState)
        .set({ data: JSON.stringify(pointer), updatedAt: revision })
        .where(
          force
            ? eq(userWorkspaceState.userKey, identity.userKey)
            : and(eq(userWorkspaceState.userKey, identity.userKey), eq(userWorkspaceState.updatedAt, baseRevision)),
        )
        .returning({ revision: userWorkspaceState.updatedAt });
      if (!updated.length) {
        await env.BUCKET.delete(pointer.r2Key);
        return Response.json({ error: "A newer cloud version exists." }, { status: 409 });
      }
      // Retain previous saved objects for recovery; a successful save is not a backup deletion request.
    }
    await recordBetaEvent(request, { eventType: "save", action: "workspace_save_active_pog", outcome: "success" }).catch(() => {});
    return Response.json({ ok: true, revision, psaSources: {} });
  }
  if (existing && !force && baseRevision !== existing.updatedAt) {
    await recordBetaEvent(request, {
      eventType: "save",
      action: "workspace_conflict",
      outcome: "friction",
    }).catch(() => {});
    return Response.json(
      { error: "A newer cloud version exists.", revision: existing.updatedAt },
      { status: 409 },
    );
  }
  const loadedPlanCount = headerCount(request, "x-planogram-planogram-count"),
    knownPlanCount = headerCount(request, "x-planogram-summary-count");
  if (
    existing &&
    knownPlanCount !== null &&
    loadedPlanCount !== null &&
    knownPlanCount > loadedPlanCount
  ) {
    await recordBetaEvent(request, {
      eventType: "save",
      action: "partial_workspace_full_save_blocked",
      outcome: "friction",
    }).catch(() => {});
    return Response.json(
      { error: "Only one POG is loaded. Open or save this POG before replacing the full workspace." },
      { status: 409 },
    );
  }
  const pointer = await writeStreamedState(request, identity.userKey, revision);
  if (!existing) {
    await db.insert(userWorkspaceState).values({
      userKey: identity.userKey,
      data: JSON.stringify(pointer),
      updatedAt: revision,
    });
    await recordBetaEvent(request, { eventType: "save", action: "workspace_save", outcome: "success" }).catch(() => {});
    return Response.json({ ok: true, revision, psaSources: {} });
  }
  const updated = await db
    .update(userWorkspaceState)
    .set({ data: JSON.stringify(pointer), updatedAt: revision })
    .where(
      force
        ? eq(userWorkspaceState.userKey, identity.userKey)
        : and(
            eq(userWorkspaceState.userKey, identity.userKey),
            eq(userWorkspaceState.updatedAt, baseRevision),
          ),
    )
    .returning({ revision: userWorkspaceState.updatedAt });
  if (!updated.length) {
    await env.BUCKET.delete(pointer.r2Key);
    const [latest] = await db
      .select()
      .from(userWorkspaceState)
      .where(eq(userWorkspaceState.userKey, identity.userKey))
      .limit(1);
    await recordBetaEvent(request, {
      eventType: "save",
      action: "workspace_conflict",
      outcome: "friction",
    }).catch(() => {});
    return Response.json(
      {
        error: "A newer cloud version exists.",
        revision: latest?.updatedAt ?? null,
      },
      { status: 409 },
    );
  }
  // Keep the prior revision recoverable.
  await recordBetaEvent(request, { eventType: "save", action: "workspace_save", outcome: "success" }).catch(() => {});
  return Response.json({ ok: true, revision, psaSources: {} });
}

async function readOwnerStarterData() {
  const db = getDb(),
    ownerKey = ownerWorkspaceKey();
  if (ownerKey) {
    const [ownerRow] = await db
      .select()
      .from(userWorkspaceState)
      .where(eq(userWorkspaceState.userKey, ownerKey))
      .limit(1);
    if (ownerRow) return ownerRow.data;
  }
  return legacyWorkspaceData();
}

async function cloneStateDataForUser(sourceData: string, userKey: string, revision: number) {
  const r2Key = workspaceStateKey(userKey, revision),
    pointer = statePointer(sourceData);
  if (pointer) {
    const object = await env.BUCKET.get(pointer.r2Key);
    if (!object) throw new Error("Starter workspace is unavailable");
    await env.BUCKET.put(r2Key, object.body, {
      httpMetadata: { contentType: "application/json" },
    });
  } else {
    await env.BUCKET.put(r2Key, sourceData, {
      httpMetadata: { contentType: "application/json" },
    });
  }
  return pointer?.encoding === "gzip"
    ? { r2Key, encoding: "gzip" as const }
    : { r2Key };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url),
      activeOnly = url.searchParams.get("active") === "1" || !!url.searchParams.get("planogramId"),
      requestedPlanogramId = url.searchParams.get("planogramId"),
      rawPlanogramIndex = url.searchParams.get("planogramIndex"),
      requestedPlanogramIndex = rawPlanogramIndex === null ? null : Number(rawPlanogramIndex),
      cacheOnly = url.searchParams.get("cacheOnly") === "1";
    const identity = await resolveRequestIdentity(request);
    if (!identity?.userKey)
      return Response.json(
        { error: "Sign in required" },
        { status: 401, headers: noStoreHeaders },
      );
    const db = getDb(),
      [row] = await db
      .select()
      .from(userWorkspaceState)
      .where(eq(userWorkspaceState.userKey, identity.userKey))
      .limit(1);
    if (!row && identity.email === OWNER_EMAIL) {
      const [legacy] = await db.select().from(planogramState)
        .where(eq(planogramState.id, 1)).limit(1);
      if (!legacy)
        return Response.json({
          state: null,
          revision: null,
          migratedFromLegacy: false,
          storageKey: identity.userKey,
        }, { headers: noStoreHeaders });
      const meta = {
        revision: legacy.updatedAt,
        migratedFromLegacy: true,
        storageKey: identity.userKey,
      };
      return activeOnly
        ? activeStateResponse(legacy.data, meta, requestedPlanogramId, requestedPlanogramIndex, undefined, cacheOnly)
        : streamStateResponse(legacy.data, meta);
    }
    if (!row && identity.email !== OWNER_EMAIL) {
      const starterData = await readOwnerStarterData();
      if (!starterData)
        return Response.json({
          state: null,
          revision: null,
          storageKey: identity.userKey,
        }, { headers: noStoreHeaders });
      const revision = Date.now(),
        pointer = await cloneStateDataForUser(
          starterData,
          identity.userKey,
          revision,
        );
      await db.insert(userWorkspaceState).values({
        userKey: identity.userKey,
        data: JSON.stringify(pointer),
        updatedAt: revision,
      });
      await recordBetaEvent(request, {
        eventType: "save",
        action: "workspace_seeded_from_master",
        outcome: "success",
      }).catch(() => {});
      const meta = {
        revision,
        seededFromMaster: true,
        storageKey: identity.userKey,
      };
      return activeOnly
        ? activeStateResponse(JSON.stringify(pointer), meta, requestedPlanogramId, requestedPlanogramIndex, {
            userKey: identity.userKey,
            revision,
          }, cacheOnly)
        : streamStateResponse(JSON.stringify(pointer), meta);
    }
    if (!row)
      return Response.json({
        state: null,
        revision: null,
        storageKey: identity.userKey,
      }, { headers: noStoreHeaders });
    const workspace = await repairOwnerWorkspaceIfNeeded(row.data, identity, row.updatedAt);
    const meta = {
      revision: workspace.revision,
      storageKey: identity.userKey,
      ...(workspace.repaired ? { repairedWorkspace: true } : {}),
    };
    return activeOnly
      ? activeStateResponse(workspace.data, meta, requestedPlanogramId, requestedPlanogramIndex, {
          userKey: identity.userKey,
          revision: workspace.revision,
        }, cacheOnly)
      : streamStateResponse(workspace.data, meta);
  } catch {
    return Response.json(
      { error: "Saved workspace could not be loaded. Open recovery; your saved data has not been replaced." },
      { status: 503, headers: noStoreHeaders },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const identity = await resolveRequestIdentity(request);
    if (!identity?.userKey)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    if (request.headers.get("x-planogram-state-payload") === streamedStateHeader)
      return saveStreamedState(request, identity);
    const body = (await readStateRequest(request)) as {
      state?: unknown;
      baseRevision?: number | null;
      force?: boolean;
    };
    if (!body.state)
      return Response.json({ error: "state is required" }, { status: 400 });
    const { compacted, keys } = await externalizePsaSources(body.state),
      db = getDb(),
      [existing] = await db
        .select()
        .from(userWorkspaceState)
        .where(eq(userWorkspaceState.userKey, identity.userKey))
        .limit(1),
      revision = Date.now();
    if (!existing) {
      const r2Key = workspaceStateKey(identity.userKey, revision);
      await env.BUCKET.put(r2Key, JSON.stringify(compacted), {
        httpMetadata: { contentType: "application/json" },
      });
      await db.insert(userWorkspaceState).values({
        userKey: identity.userKey,
        data: JSON.stringify({ r2Key }),
        updatedAt: revision,
      });
      await recordBetaEvent(request, { eventType: "save", action: "workspace_save", outcome: "success" }).catch(() => {});
      return Response.json({ ok: true, revision, psaSources: keys });
    }
    if (!body.force && body.baseRevision !== existing.updatedAt) {
      await recordBetaEvent(request, { eventType: "save", action: "workspace_conflict", outcome: "friction" }).catch(() => {});
      return Response.json(
        {
          error: "A newer cloud version exists.",
          state: await readState(existing.data),
          revision: existing.updatedAt,
        },
        { status: 409 },
      );
    }
    const r2Key = workspaceStateKey(identity.userKey, revision),
      previousPointer = statePointer(existing.data);
    await env.BUCKET.put(r2Key, JSON.stringify(compacted), {
      httpMetadata: { contentType: "application/json" },
    });
    const updated = await db
      .update(userWorkspaceState)
      .set({ data: JSON.stringify({ r2Key }), updatedAt: revision })
      .where(
        body.force
          ? eq(userWorkspaceState.userKey, identity.userKey)
          : and(
              eq(userWorkspaceState.userKey, identity.userKey),
              eq(userWorkspaceState.updatedAt, body.baseRevision),
            ),
      )
      .returning({ revision: userWorkspaceState.updatedAt });
    if (!updated.length) {
      await env.BUCKET.delete(r2Key);
      const [latest] = await db
        .select()
        .from(userWorkspaceState)
        .where(eq(userWorkspaceState.userKey, identity.userKey))
        .limit(1);
      await recordBetaEvent(request, { eventType: "save", action: "workspace_conflict", outcome: "friction" }).catch(() => {});
      return Response.json(
        {
          error: "A newer cloud version exists.",
          state: latest ? await readState(latest.data) : null,
          revision: latest?.updatedAt ?? null,
        },
        { status: 409 },
      );
    }
    // Keep the prior revision recoverable.
    await recordBetaEvent(request, { eventType: "save", action: "workspace_save", outcome: "success" }).catch(() => {});
    return Response.json({ ok: true, revision, psaSources: keys });
  } catch (error) {
    await recordBetaEvent(request, {
      eventType: "error",
      action: "workspace_save",
      outcome: "error",
      details: { message: error instanceof Error ? error.message : "Unable to save" },
    }).catch(() => {});
    return Response.json({ error: "Unable to save" }, { status: 500 });
  }
}
