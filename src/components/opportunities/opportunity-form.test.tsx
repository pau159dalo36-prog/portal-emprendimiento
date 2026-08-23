// Tests del formulario de oportunidades. Cubre el caso límite de los turnos de
// un día: el selector de visibilidad no se renderiza, pero el valor debe viajar
// igualmente en el FormData o la validación lo rechazaría (visibilityInvalid).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initialFormState } from "@/actions/form-state";
import { emptyOpportunityFormData } from "@/opportunities/map";

const { saveOpportunityActionMock } = vi.hoisted(() => ({
  saveOpportunityActionMock: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock("@/actions/opportunity", () => ({
  saveOpportunityAction: saveOpportunityActionMock,
}));

import { OpportunityForm } from "@/components/opportunities/opportunity-form";

afterEach(cleanup);

beforeEach(() => {
  saveOpportunityActionMock.mockReset();
  saveOpportunityActionMock.mockResolvedValue(initialFormState);
});

async function fillShiftForm(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText("opportunityForm.typeLabel"), "one_day_shift");
  await user.type(screen.getByLabelText("opportunityForm.titleLabel"), "Turno en feria");
  await user.type(
    screen.getByLabelText("opportunityForm.descriptionLabel"),
    "Descripcion del turno con detalle suficiente",
  );
  fireEvent.change(screen.getByLabelText("opportunityForm.startsAtLabel"), {
    target: { value: "2099-06-01T09:00" },
  });
  fireEvent.change(screen.getByLabelText("opportunityForm.endsAtLabel"), {
    target: { value: "2099-06-01T13:00" },
  });
  fireEvent.change(screen.getByLabelText("opportunityForm.slotsLabel"), {
    target: { value: "3" },
  });
}

describe("OpportunityForm — one_day_shift", () => {
  it("envía visibility='public' al crear un turno aunque el selector no esté", async () => {
    const user = userEvent.setup();
    render(<OpportunityForm mode="create" />);

    await fillShiftForm(user);
    await user.click(screen.getByRole("button", { name: "opportunityForm.saveButton" }));

    expect(saveOpportunityActionMock).toHaveBeenCalledTimes(1);
    const formData = saveOpportunityActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("visibility")).toBe("public");
    expect(formData.get("opportunity_type")).toBe("one_day_shift");
  });

  it("conserva la visibilidad existente al editar un turno", async () => {
    const user = userEvent.setup();
    render(
      <OpportunityForm
        mode="edit"
        opportunityId="0b8f9d5a-1111-4222-8333-444455556666"
        initial={{
          ...emptyOpportunityFormData,
          opportunity_type: "one_day_shift",
          visibility: "registered_users",
          title: "Turno existente",
          description: "Descripcion existente del turno",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "opportunityForm.saveButton" }));

    expect(saveOpportunityActionMock).toHaveBeenCalledTimes(1);
    const formData = saveOpportunityActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("visibility")).toBe("registered_users");
    expect(formData.get("opportunity_id")).toBe(
      "0b8f9d5a-1111-4222-8333-444455556666",
    );
  });
});
