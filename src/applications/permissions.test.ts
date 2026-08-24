import { describe, expect, it } from "vitest";

import type { ApplicationStatus } from "@/applications/config";
import {
  canDecide,
  canWithdraw,
  isPendingStatus,
  isTerminalStatus,
  isValidTransition,
  nextStatusesForActor,
} from "@/applications/permissions";

const ALL: ApplicationStatus[] = [
  "submitted",
  "viewed",
  "accepted",
  "rejected",
  "withdrawn",
];

describe("applications — máquina de estados", () => {
  it("submitted solo avanza a viewed/accepted/rejected/withdrawn", () => {
    expect(isValidTransition("submitted", "viewed")).toBe(true);
    expect(isValidTransition("submitted", "accepted")).toBe(true);
    expect(isValidTransition("submitted", "rejected")).toBe(true);
    expect(isValidTransition("submitted", "withdrawn")).toBe(true);
    expect(isValidTransition("submitted", "submitted")).toBe(false);
  });

  it("viewed no vuelve a submitted", () => {
    expect(isValidTransition("viewed", "submitted")).toBe(false);
    expect(isValidTransition("viewed", "accepted")).toBe(true);
    expect(isValidTransition("viewed", "rejected")).toBe(true);
    expect(isValidTransition("viewed", "withdrawn")).toBe(true);
  });

  it("los estados terminales no tienen transiciones", () => {
    for (const terminal of ["accepted", "rejected", "withdrawn"] as const) {
      for (const target of ALL) {
        expect(isValidTransition(terminal, target)).toBe(false);
      }
      expect(isTerminalStatus(terminal)).toBe(true);
    }
  });

  it("submitted y viewed son pendientes; el resto no", () => {
    expect(isPendingStatus("submitted")).toBe(true);
    expect(isPendingStatus("viewed")).toBe(true);
    expect(isPendingStatus("accepted")).toBe(false);
    expect(isPendingStatus("rejected")).toBe(false);
    expect(isPendingStatus("withdrawn")).toBe(false);
  });
});

describe("applications — permisos por actor", () => {
  const applicant = "user-applicant";
  const other = "user-other";

  it("el applicant puede retirar solo lo suyo y solo estando pendiente", () => {
    expect(canWithdraw(applicant, applicant, "submitted")).toBe(true);
    expect(canWithdraw(applicant, applicant, "viewed")).toBe(true);
    expect(canWithdraw(applicant, applicant, "accepted")).toBe(false);
    expect(canWithdraw(other, applicant, "submitted")).toBe(false);
  });

  it("el manager decide sobre candidaturas pendientes", () => {
    expect(canDecide(true, "submitted")).toBe(true);
    expect(canDecide(true, "viewed")).toBe(true);
    expect(canDecide(true, "accepted")).toBe(false);
    expect(canDecide(false, "submitted")).toBe(false);
  });

  it("nextStatusesForActor: applicant solo withdrawn; manager viewed/accept/reject", () => {
    expect(nextStatusesForActor("applicant", "submitted")).toEqual(["withdrawn"]);
    expect(nextStatusesForActor("applicant", "viewed")).toEqual(["withdrawn"]);
    expect([...nextStatusesForActor("manager", "submitted")].sort()).toEqual([
      "accepted",
      "rejected",
      "viewed",
    ]);
    expect([...nextStatusesForActor("manager", "viewed")].sort()).toEqual([
      "accepted",
      "rejected",
    ]);
    // Terminales: nadie mueve nada.
    for (const status of ALL.filter((s) => isTerminalStatus(s))) {
      expect(nextStatusesForActor("applicant", status)).toEqual([]);
      expect(nextStatusesForActor("manager", status)).toEqual([]);
    }
  });
});
