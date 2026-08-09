import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  followOrganization,
  followProfile,
  followProject,
  getFollowedOrganizationIds,
  getFollowedProfileIds,
  getFollowedProjectIds,
  getOrganizationFollowCount,
  getProfileFollowCounts,
  getProjectFollowCount,
  isFollowingOrganization,
  isFollowingProfile,
  isFollowingProject,
  unfollowOrganization,
  unfollowProfile,
  unfollowProject,
} from "@/follows/data";
import { isFollowTargetId } from "@/validations/follows";
import type { Database } from "@/types/database.types";

function createQuerySpy(options: { data?: unknown; error?: unknown } = {}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const result = { data: options.data, error: options.error ?? null };

  const builder = {
    select(...args: unknown[]) {
      calls.push({ method: "select", args });
      return builder;
    },
    eq(...args: unknown[]) {
      calls.push({ method: "eq", args });
      return builder;
    },
    maybeSingle() {
      calls.push({ method: "maybeSingle", args: [] });
      return builder;
    },
    delete() {
      calls.push({ method: "delete", args: [] });
      return builder;
    },
    upsert(...args: unknown[]) {
      calls.push({ method: "upsert", args });
      return builder;
    },
    then(
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      if (options.error) {
        return Promise.resolve(onRejected?.(options.error));
      }
      return Promise.resolve(onFulfilled(result));
    },
  };

  const supabase = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
    rpc(...args: unknown[]) {
      calls.push({ method: "rpc", args });
      return builder;
    },
  };

  return {
    supabase: supabase as unknown as SupabaseClient<Database>,
    calls,
  };
}

function eqCall(calls: { method: string; args: unknown[] }[], column: string) {
  return calls.find((call) => call.method === "eq" && call.args[0] === column)?.args;
}

function tableCall(calls: { method: string; args: unknown[] }[], table: string) {
  return calls.find((call) => call.method === "from" && call.args[0] === table);
}

describe("follows (capa de datos)", () => {
  it("isFollowingProfile consulta el follow con maybeSingle", async () => {
    const { supabase, calls } = createQuerySpy();
    await isFollowingProfile(supabase, "me", "other");

    expect(tableCall(calls, "profile_follows")).toBeDefined();
    expect(eqCall(calls, "profile_id")?.[1]).toBe("me");
    expect(eqCall(calls, "following_id")?.[1]).toBe("other");
    expect(calls.some((call) => call.method === "maybeSingle")).toBe(true);
  });

  it("isFollowingProfile no consulta cuando es auto-follow", async () => {
    const { supabase, calls } = createQuerySpy();
    const following = await isFollowingProfile(supabase, "me", "me");

    expect(following).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("isFollowingProject/isFollowingOrganization consultan su tabla", async () => {
    const { supabase, calls } = createQuerySpy();
    await isFollowingProject(supabase, "me", "proj-1");
    expect(tableCall(calls, "project_follows")).toBeDefined();
    expect(eqCall(calls, "project_id")?.[1]).toBe("proj-1");

    calls.length = 0;
    await isFollowingOrganization(supabase, "me", "org-1");
    expect(tableCall(calls, "organization_follows")).toBeDefined();
    expect(eqCall(calls, "organization_id")?.[1]).toBe("org-1");
  });

  it("followProfile usa upsert idempotente sobre el UNIQUE compuesto", async () => {
    const { supabase, calls } = createQuerySpy();
    await followProfile(supabase, "me", "other");

    const upsert = calls.find((call) => call.method === "upsert");
    expect(upsert?.args[0]).toEqual({ profile_id: "me", following_id: "other" });
    expect(upsert?.args[1]).toEqual({
      onConflict: "profile_id, following_id",
      ignoreDuplicates: true,
    });
  });

  it("followProfile rechaza el auto-follow sin consultar", async () => {
    const { supabase, calls } = createQuerySpy();
    const result = await followProfile(supabase, "me", "me");

    expect(result.error).toBe("SELF_FOLLOW");
    expect(calls).toHaveLength(0);
  });

  it("unfollowProfile borra solo el par propio", async () => {
    const { supabase, calls } = createQuerySpy();
    await unfollowProfile(supabase, "me", "other");

    expect(tableCall(calls, "profile_follows")).toBeDefined();
    expect(calls.some((call) => call.method === "delete")).toBe(true);
    expect(eqCall(calls, "profile_id")?.[1]).toBe("me");
    expect(eqCall(calls, "following_id")?.[1]).toBe("other");
  });

  it("followProject/unfollowProject consultan project_follows", async () => {
    const { supabase, calls } = createQuerySpy();
    await followProject(supabase, "me", "proj-1");

    const upsert = calls.find((call) => call.method === "upsert");
    expect(tableCall(calls, "project_follows")).toBeDefined();
    expect(upsert?.args[1]).toEqual({
      onConflict: "profile_id, project_id",
      ignoreDuplicates: true,
    });

    calls.length = 0;
    await unfollowProject(supabase, "me", "proj-1");
    expect(eqCall(calls, "project_id")?.[1]).toBe("proj-1");
    expect(calls.some((call) => call.method === "delete")).toBe(true);
  });

  it("followOrganization/unfollowOrganization consultan organization_follows", async () => {
    const { supabase, calls } = createQuerySpy();
    await followOrganization(supabase, "me", "org-1");

    const upsert = calls.find((call) => call.method === "upsert");
    expect(tableCall(calls, "organization_follows")).toBeDefined();
    expect(upsert?.args[1]).toEqual({
      onConflict: "profile_id, organization_id",
      ignoreDuplicates: true,
    });

    calls.length = 0;
    await unfollowOrganization(supabase, "me", "org-1");
    expect(eqCall(calls, "organization_id")?.[1]).toBe("org-1");
  });

  it("getProfileFollowCounts usa las RPC de conteo", async () => {
    const { supabase, calls } = createQuerySpy();
    await getProfileFollowCounts(supabase, "me");

    const rpcCalls = calls.filter((call) => call.method === "rpc");
    expect(rpcCalls.some((call) => call.args[0] === "count_profile_followers")).toBe(true);
    expect(rpcCalls.some((call) => call.args[0] === "count_profile_following")).toBe(true);
  });

  it("getProjectFollowCount/getOrganizationFollowCount usan las RPC de conteo", async () => {
    const { supabase, calls } = createQuerySpy();
    await getProjectFollowCount(supabase, "proj-1");
    expect(
      calls.find((call) => call.method === "rpc" && call.args[0] === "count_project_followers")
        ?.args[1],
    ).toEqual({ p_project_id: "proj-1" });

    calls.length = 0;
    await getOrganizationFollowCount(supabase, "org-1");
    expect(
      calls.find(
        (call) => call.method === "rpc" && call.args[0] === "count_organization_followers",
      )?.args[1],
    ).toEqual({ p_organization_id: "org-1" });
  });

  it("getFollowedProfileIds devuelve los ids seguidos", async () => {
    const { supabase, calls } = createQuerySpy({
      data: [{ following_id: "a" }, { following_id: "b" }],
    });
    const ids = await getFollowedProfileIds(supabase, "me");

    expect(ids).toEqual(["a", "b"]);
    expect(tableCall(calls, "profile_follows")).toBeDefined();
    expect(eqCall(calls, "profile_id")?.[1]).toBe("me");
    expect(
      calls.find((call) => call.method === "select" && call.args[0] === "following_id"),
    ).toBeDefined();
  });

  it("getFollowedProjectIds devuelve los proyectos seguidos", async () => {
    const { supabase, calls } = createQuerySpy({
      data: [{ project_id: "proj-1" }],
    });
    const ids = await getFollowedProjectIds(supabase, "me");

    expect(ids).toEqual(["proj-1"]);
    expect(tableCall(calls, "project_follows")).toBeDefined();
    expect(eqCall(calls, "profile_id")?.[1]).toBe("me");
    expect(
      calls.find((call) => call.method === "select" && call.args[0] === "project_id"),
    ).toBeDefined();
  });

  it("getFollowedOrganizationIds devuelve las organizaciones seguidas", async () => {
    const { supabase, calls } = createQuerySpy({
      data: [{ organization_id: "org-1" }],
    });
    const ids = await getFollowedOrganizationIds(supabase, "me");

    expect(ids).toEqual(["org-1"]);
    expect(tableCall(calls, "organization_follows")).toBeDefined();
    expect(eqCall(calls, "profile_id")?.[1]).toBe("me");
    expect(
      calls.find((call) => call.method === "select" && call.args[0] === "organization_id"),
    ).toBeDefined();
  });

  it("isFollowTargetId solo admite UUID válidos", () => {
    expect(isFollowTargetId("00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isFollowTargetId("no-uuid")).toBe(false);
    expect(isFollowTargetId(null)).toBe(false);
    expect(isFollowTargetId(42)).toBe(false);
  });
});
