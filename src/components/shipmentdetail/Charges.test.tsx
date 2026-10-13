// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ShipmentDetails } from "../../types/shipment.types";
import Charges from "./Charges";

const reduxMocks = vi.hoisted(() => ({
  abort: vi.fn(),
  dispatch: vi.fn(),
  accessorials: [] as Array<{
    clientID: number;
    accessorialID: number;
    accesorialCode: string;
    description: string;
    status: boolean;
    accesorialGroupID: number;
    isSystem: boolean;
    isSelect: boolean;
  }>,
}));

vi.mock("../../app/hooks", () => ({
  useAppDispatch: () => reduxMocks.dispatch,
  useAppSelector: (
    selector: (state: {
      chargeAccessorials: { data: typeof reduxMocks.accessorials };
    }) => unknown,
  ) =>
    selector({
      chargeAccessorials: { data: reduxMocks.accessorials },
    }),
}));

const shipment = {
  loadNumber: "LOAD-100",
  clientCode: "CLIENT-42",
  products: [],
  accessorials: [],
  buyRate: null,
  sellRate: null,
} as unknown as ShipmentDetails;

const shipmentWithCharges = {
  ...shipment,
  buyRate: {
    freight: 100,
    fuel: 20,
    discount: -10,
    accesorialCostDetails: [],
  },
  sellRate: {
    freight: 120,
    fuel: 30,
    discount: -15,
    accesorialCostDetails: [],
  },
} as ShipmentDetails;

const shipmentWithPositiveDiscounts = {
  ...shipmentWithCharges,
  buyRate: {
    ...shipmentWithCharges.buyRate,
    discount: 10,
  },
  sellRate: {
    ...shipmentWithCharges.sellRate,
    discount: 15,
  },
} as ShipmentDetails;

const accessorialCostDetails = [
  {
    accCode: "IDL",
    ratedCost: 12,
    description: "Inside delivery",
    billedCost: null,
  },
  {
    accCode: "LFG",
    ratedCost: 18,
    description: "Lift gate",
    billedCost: null,
  },
];

const shipmentWithAccessorialCharges = {
  ...shipmentWithCharges,
  buyRate: {
    ...shipmentWithCharges.buyRate,
    accesorialCostDetails: accessorialCostDetails,
  },
  sellRate: {
    ...shipmentWithCharges.sellRate,
    accesorialCostDetails: accessorialCostDetails,
  },
} as ShipmentDetails;

const detentionUnloading = {
  clientID: 1132,
  accessorialID: 3980,
  accesorialCode: "DEI",
  description: "DETENTION UNLOADING",
  status: true,
  accesorialGroupID: 63,
  isSystem: false,
  isSelect: false,
};

const discountAccessorial = {
  ...detentionUnloading,
  accessorialID: 3982,
  accesorialCode: "DSC",
  description: "DISCOUNT",
};

function renderCharges(shipmentDetails: ShipmentDetails = shipment) {
  return render(
    <MemoryRouter>
      <Charges
        shipment={shipmentDetails}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />
    </MemoryRouter>,
  );
}

function getRenderedChargeDescriptions(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll(".shipment-charge-table tbody tr"),
  )
    .map((row) => row.children[1]?.textContent?.trim() ?? "")
    .filter((description) => description.length > 0);
}

function createShipmentWithChargeTotals(
  buyTotal: number,
  sellTotal: number,
) {
  return {
    ...shipment,
    buyRate: {
      freight: Math.max(buyTotal, 0),
      fuel: 0,
      discount: Math.min(buyTotal, 0),
      accesorialCostDetails: [],
    },
    sellRate: {
      freight: Math.max(sellTotal, 0),
      fuel: 0,
      discount: Math.min(sellTotal, 0),
      accesorialCostDetails: [],
    },
  } as ShipmentDetails;
}

describe("Charges", () => {
  beforeEach(() => {
    reduxMocks.abort.mockReset();
    reduxMocks.dispatch.mockReset();
    reduxMocks.dispatch.mockReturnValue({ abort: reduxMocks.abort });
    reduxMocks.accessorials.splice(0);
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}

        unobserve() {}

        disconnect() {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("Charges_whenChangedLiabilityIsAccepted_notifiesTheParent", () => {
    const onChangeCommitted = vi.fn();
    render(
      <MemoryRouter>
        <Charges
          shipment={shipment}
          onChangeCommitted={onChangeCommitted}
          onEditorStateChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Edit carrier liability" }),
    );
    fireEvent.change(screen.getByLabelText("Carrier liability new"), {
      target: { value: "25000" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save carrier liability" }),
    );

    expect(onChangeCommitted).toHaveBeenCalledTimes(1);
  });

  it("Charges_whenRendered_doesNotShowDuplicateFooterSaveOrCancel", () => {
    render(
      <MemoryRouter>
        <Charges
          shipment={shipment}
          onChangeCommitted={vi.fn()}
          onEditorStateChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(
      screen.getByRole("button", { name: /View Quote Details/ }),
    ).toBeTruthy();
  });

  it("Charges_whenLoaded_ordersPriorityChargesBeforeOtherChargesWithoutReorderingOthers", () => {
    const { container } = renderCharges(shipmentWithAccessorialCharges);

    expect(getRenderedChargeDescriptions(container)).toEqual([
      "Freight",
      "Discount",
      "Fuel surcharge",
      "Inside delivery",
      "Lift gate",
    ]);
  });

  it("Charges_whenAnEditedChargeBecomesFuel_reordersTheSavedLineIntoTheFuelPriorityGroup", () => {
    const { container } = renderCharges(shipmentWithAccessorialCharges);

    fireEvent.click(
      screen.getByRole("button", { name: "Edit Inside delivery" }),
    );
    fireEvent.change(screen.getByLabelText("Charge description"), {
      target: { value: "Fuel" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save charge line" }));

    expect(getRenderedChargeDescriptions(container)).toEqual([
      "Freight",
      "Discount",
      "Fuel",
      "Fuel surcharge",
      "Lift gate",
    ]);
  });

  it.each([
    ["FUEL", "FSC"],
    [".FUEL.", "FSC"],
    ["fuel", "FSC"],
    ["Fuel accessorial", "FUEL"],
  ])(
    "Charges_whenApiFuelSuggestionIs%s_placesItBeforeFuelSurcharge",
    async (description, accesorialCode) => {
      reduxMocks.accessorials.push({
        ...detentionUnloading,
        accessorialID: 3990,
        accesorialCode,
        description,
      });
      const { container } = renderCharges(shipmentWithAccessorialCharges);

      fireEvent.click(screen.getByRole("button", { name: /Add Line/ }));
      fireEvent.change(screen.getByLabelText("New charge description"), {
        target: { value: "fue" },
      });
      fireEvent.click(await screen.findByText(description));
      fireEvent.click(
        screen.getByRole("button", { name: "Save new charge line" }),
      );

      expect(getRenderedChargeDescriptions(container)).toEqual([
        "Freight",
        "Discount",
        description,
        "Fuel surcharge",
        "Inside delivery",
        "Lift gate",
      ]);
    },
  );

  it("Charges_whenPriorityChargeIsDeletedAndReadded_restoresThePriorityOrder", async () => {
    reduxMocks.accessorials.push(discountAccessorial);
    const { container } = renderCharges(shipmentWithAccessorialCharges);

    fireEvent.click(screen.getByRole("button", { name: "Delete Discount" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(getRenderedChargeDescriptions(container)).toEqual([
        "Freight",
        "Fuel surcharge",
        "Inside delivery",
        "Lift gate",
      ]);
    });

    fireEvent.click(screen.getByRole("button", { name: /Add Line/ }));
    fireEvent.change(screen.getByLabelText("New charge description"), {
      target: { value: "dis" },
    });
    fireEvent.click(await screen.findByText("DISCOUNT"));
    fireEvent.click(
      screen.getByRole("button", { name: "Save new charge line" }),
    );

    expect(getRenderedChargeDescriptions(container)).toEqual([
      "Freight",
      "DISCOUNT",
      "Fuel surcharge",
      "Inside delivery",
      "Lift gate",
    ]);
  });

  it("Charges_whenChargeDeletionIsConfirmed_removesTheLineRecalculatesTotalsAndNotifiesTheParent", async () => {
    const onChangeCommitted = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <Charges
          shipment={shipmentWithCharges}
          onChangeCommitted={onChangeCommitted}
          onEditorStateChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    const deleteButton = screen.getByRole("button", { name: "Delete Freight" });
    expect(deleteButton.className).toContain("ant-btn-dangerous");
    expect(
      container.querySelector(".shipment-charge-table tfoot")?.textContent,
    ).toContain("$110.00$135.00$25.00");

    fireEvent.click(deleteButton);
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Freight")).toBeNull();
    });
    expect(
      container.querySelector(".shipment-charge-table tfoot")?.textContent,
    ).toContain("$10.00$15.00$5.00");
    expect(onChangeCommitted).toHaveBeenCalledTimes(1);
  });

  it("Charges_whenChargeDeletionIsCancelled_keepsTheLineAndTotals", async () => {
    const onChangeCommitted = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <Charges
          shipment={shipmentWithCharges}
          onChangeCommitted={onChangeCommitted}
          onEditorStateChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete Freight" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Freight")).toBeTruthy();
    expect(container.querySelector(".shipment-charge-table tfoot")?.textContent).toContain(
      "$110.00$135.00",
    );
    expect(onChangeCommitted).not.toHaveBeenCalled();
  });

  it("Charges_whenPositiveDiscountIsLoaded_normalizesBuyAndSellValuesAndTotals", () => {
    const { container } = renderCharges(shipmentWithPositiveDiscounts);

    const discountRow = screen.getByText("Discount").closest("tr");

    expect(discountRow?.textContent).toContain("($10.00)($15.00)");
    expect(
      container.querySelector(".shipment-charge-table tfoot")?.textContent,
    ).toContain("$110.00$135.00");
  });

  it.each([
    ["BuyIsNegativeAndSellIsPositive", -10, 20, true, false],
    ["BuyIsPositiveAndSellIsNegative", 20, -10, false, true],
    ["BuyAndSellAreNegative", -10, -20, true, true],
  ])(
    "Charges_when%s_appliesNegativeTextColorOnlyToNegativeTotals",
    (_scenario, buyTotal, sellTotal, buyIsNegative, sellIsNegative) => {
      const { container } = renderCharges(
        createShipmentWithChargeTotals(buyTotal, sellTotal),
      );
      const footerCells = container.querySelectorAll(
        ".shipment-charge-table tfoot td",
      );
      const buyTotalCell = footerCells[1];
      const sellTotalCell = footerCells[2];

      expect(
        buyTotalCell.classList.contains("shipment-charge-total-negative"),
      ).toBe(buyIsNegative);
      expect(
        sellTotalCell.classList.contains("shipment-charge-total-negative"),
      ).toBe(sellIsNegative);
    },
  );

  it.each([
    ["Positive", 110, 135, "$25.00", false],
    ["Zero", 20, 20, "$0.00", false],
    ["Negative", 35, 20, "($15.00)", true],
  ])(
    "Charges_whenMarginIs%s_displaysSellMinusBuyWithExpectedTextColor",
    (_scenario, buyTotal, sellTotal, expectedMargin, isNegative) => {
      const { container } = renderCharges(
        createShipmentWithChargeTotals(buyTotal, sellTotal),
      );
      const marginHeader = screen.getByRole("columnheader", {
        name: "Margin",
      });
      const marginTotalCell = container.querySelector(
        ".shipment-charge-table tfoot td:nth-child(4)",
      );

      expect(marginHeader.textContent).toBe("Margin");
      expect(marginTotalCell?.textContent).toBe(expectedMargin);
      expect(
        marginTotalCell?.classList.contains(
          "shipment-charge-total-negative",
        ),
      ).toBe(isNegative);
    },
  );

  it("Charges_whenTableRowsChangeState_preservesTheSixColumnStructure", () => {
    const populated = renderCharges(shipmentWithCharges);
    const freightRow = screen.getByText("Freight").closest("tr");

    expect(freightRow?.children).toHaveLength(6);

    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    expect(screen.getByLabelText("Charge description").closest("tr")?.children).toHaveLength(
      6,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Cancel charge line editing" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Add Line/ }));
    expect(screen.getByLabelText("New charge description").closest("tr")?.children).toHaveLength(
      6,
    );

    populated.unmount();

    const empty = renderCharges();
    const emptyCell = screen.getByText("No charges were returned.").closest(
      "td",
    );

    expect(emptyCell?.getAttribute("colspan")).toBe("6");
    empty.unmount();
  });

  it("Charges_whenPositiveDiscountIsEntered_displaysNegativeValueImmediately", () => {
    renderCharges(shipmentWithCharges);

    fireEvent.click(screen.getByRole("button", { name: "Edit Discount" }));
    const buyChargeInput = screen.getByLabelText(
      "Buy charge",
    ) as HTMLInputElement;
    fireEvent.change(buyChargeInput, { target: { value: "25" } });

    expect(Number(buyChargeInput.value.replaceAll(",", ""))).toBe(-25);
  });

  it("Charges_whenPositiveNonDiscountChargeIsEntered_keepsPositiveValue", () => {
    renderCharges(shipmentWithCharges);

    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    const buyChargeInput = screen.getByLabelText(
      "Buy charge",
    ) as HTMLInputElement;
    fireEvent.change(buyChargeInput, { target: { value: "25" } });

    expect(Number(buyChargeInput.value.replaceAll(",", ""))).toBe(25);
  });

  it("Charges_whenNegativeFreightBuyCostIsEntered_rejectsTheValue", async () => {
    renderCharges(shipmentWithCharges);

    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    const buyChargeInput = screen.getByLabelText(
      "Buy charge",
    ) as HTMLInputElement;

    fireEvent.change(buyChargeInput, { target: { value: "-25" } });
    fireEvent.blur(buyChargeInput);

    await waitFor(() => {
      expect(Number(buyChargeInput.value.replaceAll(",", ""))).toBe(100);
    });
  });

  it("Charges_whenNegativeFuelSellCostIsEntered_rejectsTheValue", async () => {
    renderCharges(shipmentWithCharges);

    fireEvent.click(
      screen.getByRole("button", { name: "Edit Fuel surcharge" }),
    );
    const sellChargeInput = screen.getByLabelText(
      "Sell charge",
    ) as HTMLInputElement;

    fireEvent.change(sellChargeInput, { target: { value: "-25" } });
    fireEvent.blur(sellChargeInput);

    await waitFor(() => {
      expect(Number(sellChargeInput.value.replaceAll(",", ""))).toBe(30);
    });
  });

  it("Charges_whenNegativeNewAccessorialCostIsEntered_rejectsTheValue", async () => {
    renderCharges();

    fireEvent.click(screen.getByRole("button", { name: /Add Line/ }));
    fireEvent.change(screen.getByLabelText("New charge description"), {
      target: { value: "Custom handling" },
    });
    const buyChargeInput = screen.getByLabelText(
      "New buy charge",
    ) as HTMLInputElement;
    const sellChargeInput = screen.getByLabelText(
      "New sell charge",
    ) as HTMLInputElement;

    fireEvent.change(buyChargeInput, { target: { value: "-25" } });
    fireEvent.blur(buyChargeInput);
    fireEvent.change(sellChargeInput, { target: { value: "-30" } });
    fireEvent.blur(sellChargeInput);

    await waitFor(() => {
      expect(buyChargeInput.value).toBe("");
      expect(sellChargeInput.value).toBe("");
    });
  });

  it("Charges_whenAddingDiscountLine_normalizesAmountsEnteredBeforeAndAfterSelection", async () => {
    reduxMocks.accessorials.push(discountAccessorial);
    renderCharges();

    fireEvent.click(screen.getByRole("button", { name: /Add Line/ }));
    const buyChargeInput = screen.getByLabelText(
      "New buy charge",
    ) as HTMLInputElement;
    const sellChargeInput = screen.getByLabelText(
      "New sell charge",
    ) as HTMLInputElement;
    fireEvent.change(buyChargeInput, { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText("New charge description"), {
      target: { value: "dis" },
    });
    fireEvent.click(await screen.findByText("DISCOUNT"));
    fireEvent.change(sellChargeInput, { target: { value: "30" } });

    expect(Number(buyChargeInput.value.replaceAll(",", ""))).toBe(-25);
    expect(Number(sellChargeInput.value.replaceAll(",", ""))).toBe(-30);

    fireEvent.click(
      screen.getByRole("button", { name: "Save new charge line" }),
    );

    const discountRow = screen.getByText("DISCOUNT").closest("tr");
    expect(discountRow?.textContent).toContain("($25.00)($30.00)");
  });

  it("Charges_whenDiscountBecomesNonDiscount_convertsCostsToPositiveValues", async () => {
    reduxMocks.accessorials.push(discountAccessorial);
    renderCharges();

    fireEvent.click(screen.getByRole("button", { name: /Add Line/ }));
    const descriptionInput = screen.getByLabelText("New charge description");
    const buyChargeInput = screen.getByLabelText(
      "New buy charge",
    ) as HTMLInputElement;
    const sellChargeInput = screen.getByLabelText(
      "New sell charge",
    ) as HTMLInputElement;
    fireEvent.change(descriptionInput, { target: { value: "dis" } });
    fireEvent.click(await screen.findByText("DISCOUNT"));
    fireEvent.change(buyChargeInput, { target: { value: "25" } });
    fireEvent.change(sellChargeInput, { target: { value: "30" } });

    expect(Number(buyChargeInput.value.replaceAll(",", ""))).toBe(-25);
    expect(Number(sellChargeInput.value.replaceAll(",", ""))).toBe(-30);

    fireEvent.change(descriptionInput, {
      target: { value: "Custom handling" },
    });

    expect(Number(buyChargeInput.value.replaceAll(",", ""))).toBe(25);
    expect(Number(sellChargeInput.value.replaceAll(",", ""))).toBe(30);
  });

  it("Charges_whenDuplicateDescriptionIsSelected_showsErrorAndKeepsEditorOpen", async () => {
    const onChangeCommitted = vi.fn();
    reduxMocks.accessorials.push(discountAccessorial);
    render(
      <MemoryRouter>
        <Charges
          shipment={shipmentWithCharges}
          onChangeCommitted={onChangeCommitted}
          onEditorStateChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Add Line/ }));
    const descriptionInput = screen.getByLabelText("New charge description");
    fireEvent.change(descriptionInput, { target: { value: "dis" } });
    fireEvent.click(await screen.findByText("DISCOUNT"));

    expect(await screen.findByText("Duplicate value not allowed")).toBeTruthy();
    expect((descriptionInput as HTMLInputElement).value).toBe("DISCOUNT");
    expect(
      screen.getByRole("button", { name: "Save new charge line" }),
    ).toBeTruthy();
    expect(onChangeCommitted).not.toHaveBeenCalled();
  });

  it("Charges_whenDuplicateFreeTextDescriptionIsSaved_rejectsCaseAndWhitespaceVariation", async () => {
    const onChangeCommitted = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <Charges
          shipment={shipmentWithCharges}
          onChangeCommitted={onChangeCommitted}
          onEditorStateChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    fireEvent.change(screen.getByLabelText("Charge description"), {
      target: { value: " discount " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save charge line" }));

    expect(await screen.findByText("Duplicate value not allowed")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Save charge line" }),
    ).toBeTruthy();
    expect(
      container.querySelector(".shipment-charge-table tfoot")?.textContent,
    ).toContain("$110.00$135.00");
    expect(onChangeCommitted).not.toHaveBeenCalled();
  });

  it("Charges_whenExistingLineRetainsItsOwnDescription_allowsTheEdit", () => {
    const onChangeCommitted = vi.fn();
    render(
      <MemoryRouter>
        <Charges
          shipment={shipmentWithCharges}
          onChangeCommitted={onChangeCommitted}
          onEditorStateChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Discount" }));
    fireEvent.change(screen.getByLabelText("Buy charge"), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save charge line" }));

    expect(
      screen.queryByRole("button", { name: "Save charge line" }),
    ).toBeNull();
    expect(screen.getByText("Discount").closest("tr")?.textContent).toContain(
      "($25.00)",
    );
    expect(onChangeCommitted).toHaveBeenCalledTimes(1);
  });

  it("Charges_whenDescriptionHasFewerThanThreeCharacters_doesNotShowSuggestions", () => {
    reduxMocks.accessorials.push(detentionUnloading);
    renderCharges(shipmentWithCharges);

    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    fireEvent.change(screen.getByLabelText("Charge description"), {
      target: { value: "de" },
    });

    expect(screen.queryByText("DETENTION UNLOADING")).toBeNull();
  });

  it("Charges_whenOneSuggestionIsAvailable_selectsItOnTabAndPopulatesReadOnlyCode", async () => {
    reduxMocks.accessorials.push(detentionUnloading);
    renderCharges(shipmentWithCharges);

    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    const descriptionInput = screen.getByLabelText("Charge description");
    const codeInput = screen.getByLabelText("Charge code") as HTMLInputElement;

    expect(codeInput.readOnly).toBe(true);
    fireEvent.change(descriptionInput, { target: { value: "det" } });
    await screen.findByText("DETENTION UNLOADING");
    fireEvent.keyDown(descriptionInput, {
      key: "Tab",
      code: "Tab",
      keyCode: 9,
      which: 9,
    });

    await waitFor(() => {
      expect((descriptionInput as HTMLInputElement).value).toBe(
        "DETENTION UNLOADING",
      );
      expect(codeInput.value).toBe("DEI");
    });
  });

  it("Charges_whenMultipleSuggestionsAreAvailable_selectsTheKeyboardActiveSuggestionOnTab", async () => {
    reduxMocks.accessorials.push(detentionUnloading, {
      ...detentionUnloading,
      accessorialID: 3981,
      accesorialCode: "DEL",
      description: "DETENTION LOADING",
    });
    renderCharges(shipmentWithCharges);

    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    const descriptionInput = screen.getByLabelText("Charge description");
    fireEvent.change(descriptionInput, { target: { value: "det" } });
    await screen.findByText("DETENTION LOADING");
    fireEvent.keyDown(descriptionInput, {
      key: "ArrowDown",
      code: "ArrowDown",
      keyCode: 40,
      which: 40,
    });
    fireEvent.keyDown(descriptionInput, {
      key: "Tab",
      code: "Tab",
      keyCode: 9,
      which: 9,
    });

    await waitFor(() => {
      expect((descriptionInput as HTMLInputElement).value).toBe(
        "DETENTION LOADING",
      );
      expect(
        (screen.getByLabelText("Charge code") as HTMLInputElement).value,
      ).toBe("DEL");
    });
  });

  it("Charges_whenSuggestionIsClicked_populatesDescriptionAndCode", async () => {
    reduxMocks.accessorials.push(detentionUnloading);
    renderCharges(shipmentWithCharges);

    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    const descriptionInput = screen.getByLabelText("Charge description");
    fireEvent.change(descriptionInput, { target: { value: "det" } });
    fireEvent.click(await screen.findByText("DETENTION UNLOADING"));

    expect((descriptionInput as HTMLInputElement).value).toBe(
      "DETENTION UNLOADING",
    );
    expect(
      (screen.getByLabelText("Charge code") as HTMLInputElement).value,
    ).toBe("DEI");
  });

  it("Charges_whenSelectedDescriptionIsEdited_clearsTheCodeAndAllowsFreeText", async () => {
    reduxMocks.accessorials.push(detentionUnloading);
    renderCharges(shipmentWithCharges);

    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    const descriptionInput = screen.getByLabelText("Charge description");
    fireEvent.change(descriptionInput, { target: { value: "det" } });
    fireEvent.click(await screen.findByText("DETENTION UNLOADING"));
    fireEvent.change(descriptionInput, {
      target: { value: "Custom handling" },
    });

    expect((descriptionInput as HTMLInputElement).value).toBe(
      "Custom handling",
    );
    expect(
      (screen.getByLabelText("Charge code") as HTMLInputElement).value,
    ).toBe("");
  });

  it("Charges_whenAddingANewLine_usesTheSameAutocompleteBehavior", async () => {
    reduxMocks.accessorials.push(detentionUnloading);
    renderCharges();

    fireEvent.click(screen.getByRole("button", { name: /Add Line/ }));
    const descriptionInput = screen.getByLabelText("New charge description");
    const codeInput = screen.getByLabelText(
      "New charge code",
    ) as HTMLInputElement;
    fireEvent.change(descriptionInput, { target: { value: "det" } });
    await screen.findByText("DETENTION UNLOADING");
    fireEvent.keyDown(descriptionInput, {
      key: "Tab",
      code: "Tab",
      keyCode: 9,
      which: 9,
    });

    await waitFor(() => {
      expect((descriptionInput as HTMLInputElement).value).toBe(
        "DETENTION UNLOADING",
      );
      expect(codeInput.value).toBe("DEI");
      expect(codeInput.readOnly).toBe(true);
    });
  });
});
