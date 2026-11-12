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
import type { ShipmentRerateRate } from "../../store/shipmentRerateSlice";
import Charges from "./Charges";
import axios from "axios";
import { within } from "@testing-library/react";

const reduxMocks = vi.hoisted(() => ({
  isCorporate: true as boolean | null,
  clientCorporate: undefined as boolean | undefined,
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
      app: { isCorporate: boolean | null };
      customerLocation: { clients: Array<{ clientCode: string; isCorporate?: boolean }> };
      chargeAccessorials: { data: typeof reduxMocks.accessorials };
    }) => unknown,
  ) =>
    selector({
      app: { isCorporate: reduxMocks.isCorporate },
      customerLocation: { clients: [{ clientCode: "CLIENT-42", isCorporate: reduxMocks.clientCorporate }] },
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

const reratedRateBase: ShipmentRerateRate = {
  id: "FXFE-0-QUOTE-1",
  carrierName: "FEDEX FREIGHT-PRIORITY",
  scac: "FXFE",
  rateType: "Flat",
  statusCode: 1,
  errorMessage: null,
  totalShipmentCost: 0,
  transitDays: 2,
  deliveryDate: null,
  quoteExpirationDate: null,
  grossCharge: 0,
  discount: 0,
  fuelSurcharge: 0,
  accessorialCharges: [],
};

function renderCharges(
  shipmentDetails: ShipmentDetails = shipment,
  reratedRate: ShipmentRerateRate | null = null,
) {
  return render(
    <MemoryRouter>
      <Charges
        shipment={shipmentDetails}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
        reratedRate={reratedRate}
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

function enterNewChargeRates(buyCost: string, sellCost: string) {
  fireEvent.change(screen.getByLabelText("New buy charge"), {
    target: { value: buyCost },
  });
  fireEvent.change(screen.getByLabelText("New sell charge"), {
    target: { value: sellCost },
  });
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
  it("Charges_DefaultMode_DisablesUnsupportedEditors", () => {
    renderCharges(shipmentWithCharges);
    expect(screen.getByRole("button", { name: "Edit carrier liability" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Freight insurance actions" })).toHaveProperty("disabled", true);
  });

  it("Charges_AcceptedSellEdit_PublishesUpdatedRateSnapshot", () => {
    const onValuesChange = vi.fn();
    render(<MemoryRouter><Charges shipment={shipmentWithCharges} onChangeCommitted={vi.fn()} onEditorStateChange={vi.fn()} onValuesChange={onValuesChange} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    fireEvent.change(screen.getByLabelText("Sell charge"), { target: { value: "180" } });
    fireEvent.click(screen.getByRole("button", { name: "Save charge line" }));
    expect(onValuesChange).toHaveBeenLastCalledWith(expect.objectContaining({ sellRate: expect.objectContaining({ freight: 180 }) }));
  });

  it("Charges_CancelledSellEdit_DoesNotPublishDraft", () => {
    const onValuesChange = vi.fn();
    render(<MemoryRouter><Charges shipment={shipmentWithCharges} onChangeCommitted={vi.fn()} onEditorStateChange={vi.fn()} onValuesChange={onValuesChange} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    fireEvent.change(screen.getByLabelText("Sell charge"), { target: { value: "180" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel charge line editing" }));
    expect(onValuesChange).not.toHaveBeenCalled();
  });

  it("Charges_SelectedRerate_PublishesSelectedBuyAndSellAmounts", () => {
    const onValuesChange = vi.fn();
    render(<MemoryRouter><Charges shipment={shipmentWithCharges} onChangeCommitted={vi.fn()} onEditorStateChange={vi.fn()}
      reratedRate={{ ...reratedRateBase, grossCharge: 150, sellGrossCharge: 180 }} onValuesChange={onValuesChange} /></MemoryRouter>);
    expect(onValuesChange).toHaveBeenLastCalledWith(expect.objectContaining({
      buyRate: expect.objectContaining({ freight: 150 }), sellRate: expect.objectContaining({ freight: 180 }),
    }));
  });
  beforeEach(() => {
    localStorage.clear();
    reduxMocks.isCorporate = true;
    reduxMocks.clientCorporate = undefined;
    vi.spyOn(axios, "get").mockResolvedValue({ data: { isSuccess: false } });
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
          readOnlyUnsupported={false}
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

  it("Charges_whenRerated_updatesCoreBuyValuesAndPreservesSellValues", () => {
    renderCharges(shipmentWithCharges, {
      ...reratedRateBase,
      grossCharge: 150,
      discount: 25,
      fuelSurcharge: 35,
      accessorialCharges: [],
    });

    expect(screen.getByText("Freight").closest("tr")?.textContent).toContain(
      "$150.00$150.00",
    );
    expect(screen.getByText("Discount").closest("tr")?.textContent).toContain(
      "($25.00)($25.00)",
    );
    expect(
      screen.getByText("Fuel surcharge").closest("tr")?.textContent,
    ).toContain("$35.00$35.00");
  });

  it("Charges_whenReratedAccessorialExists_updatesBuyAndPreservesSell", () => {
    renderCharges(shipmentWithAccessorialCharges, {
      ...reratedRateBase,
      grossCharge: 100,
      discount: 10,
      fuelSurcharge: 20,
      accessorialCharges: [
        {
          accessorialCode: "idl",
          accessorialDescription: "INSIDE DELIVERY",
          accessorialCharge: 22,
        },
      ],
    });

    expect(
      screen.getByText("Inside delivery").closest("tr")?.textContent,
    ).toContain("$22.00$22.00");
  });

  it.each([
    ["Freight", { sellGrossCharge: 180 }, "$180.00"],
    ["Discount", { sellDiscount: 30 }, "($30.00)"],
    ["Discount", { sellDiscount: -30 }, "($30.00)"],
    ["Fuel surcharge", { sellFuelSurcharge: 45 }, "$45.00"],
    ["Freight", { sellGrossCharge: 0 }, "$0.00"],
    ["Discount", { sellDiscount: 0 }, "$0.00"],
    ["Fuel surcharge", { sellFuelSurcharge: 0 }, "$0.00"],
  ])("Charges_WhenReratedSellAmountExists_UsesSelectedSellAmount_%s_%j", (description, sellAmounts, expected) => {
    renderCharges(shipmentWithCharges, {
      ...reratedRateBase,
      grossCharge: 150,
      discount: 25,
      fuelSurcharge: 35,
      ...sellAmounts,
    });

    const cells = within(screen.getByText(description).closest("tr")!).getAllByRole("cell");
    expect(cells[3].textContent).toBe(expected);
  });

  it("Charges_WhenReratedCoreRowsAreMissing_AddsSelectedSellAmounts", () => {
    renderCharges(shipment, {
      ...reratedRateBase,
      grossCharge: 150,
      sellGrossCharge: 180,
    });

    const cells = within(screen.getByText("Freight").closest("tr")!).getAllByRole("cell");
    expect(cells[3].textContent).toBe("$180.00");
  });

  it("Charges_WhenReratedAccessorialIsUnmatched_PreservesItsAmounts", () => {
    renderCharges(shipmentWithAccessorialCharges, reratedRateBase);

    const cells = within(screen.getByText("Lift gate").closest("tr")!).getAllByRole("cell");
    expect(cells[2].textContent).toBe("$18.00");
    expect(cells[3].textContent).toBe("$18.00");
  });

  it("Charges_WhenReratedSellAmountsChange_RecalculatesTotalsAndMargin", () => {
    const { container } = renderCharges(shipmentWithCharges, {
      ...reratedRateBase,
      grossCharge: 150,
      discount: 25,
      fuelSurcharge: 35,
      sellGrossCharge: 180,
      sellDiscount: 30,
      sellFuelSurcharge: 45,
    });

    const cells = within(container.querySelector("tfoot")!).getAllByRole("cell");
    expect(cells[1].textContent).toBe("$160.00");
    expect(cells[2].textContent).toBe("$195.00");
    expect(cells[3].textContent).toBe("$35.00");
  });

  it("Charges_WhenAnotherRateIsSelected_ReplacesPreviousSellAmounts", () => {
    const props = { shipment: shipmentWithCharges, onChangeCommitted: vi.fn(), onEditorStateChange: vi.fn() };
    const view = render(<MemoryRouter><Charges {...props} reratedRate={{ ...reratedRateBase, sellGrossCharge: 180 }} /></MemoryRouter>);

    view.rerender(<MemoryRouter><Charges {...props} reratedRate={{ ...reratedRateBase, id: "second-rate", sellGrossCharge: 210 }} /></MemoryRouter>);

    const cells = within(screen.getByText("Freight").closest("tr")!).getAllByRole("cell");
    expect(cells[3].textContent).toBe("$210.00");
  });

  it("Charges_WhenReratedAfterManualSellEdit_ReplacesTheManualAmount", () => {
    const props = { shipment: shipmentWithCharges, onChangeCommitted: vi.fn(), onEditorStateChange: vi.fn() };
    const view = render(<MemoryRouter><Charges {...props} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    fireEvent.change(screen.getByLabelText("Sell charge"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Save charge line" }));

    view.rerender(<MemoryRouter><Charges {...props} reratedRate={{ ...reratedRateBase, sellGrossCharge: 180 }} /></MemoryRouter>);

    const cells = within(screen.getByText("Freight").closest("tr")!).getAllByRole("cell");
    expect(cells[3].textContent).toBe("$180.00");
  });

  it("Charges_whenReratedAccessorialsAreMissing_addsEveryRowWithEqualBuyAndSell", () => {
    const { container } = renderCharges(shipmentWithCharges, {
      ...reratedRateBase,
      grossCharge: 100,
      discount: 10,
      fuelSurcharge: 20,
      accessorialCharges: [
        {
          accessorialCode: "INS",
          accessorialDescription: "INSIDE DELIVERY",
          accessorialCharge: 10,
        },
        {
          accessorialCode: "RES",
          accessorialDescription: "RESIDENTIAL DELIVERY",
          accessorialCharge: 15,
        },
      ],
    });

    expect(getRenderedChargeDescriptions(container)).toEqual([
      "Freight",
      "Discount",
      "Fuel surcharge",
      "INSIDE DELIVERY",
      "RESIDENTIAL DELIVERY",
    ]);
    expect(screen.getByText("INSIDE DELIVERY").closest("tr")?.textContent).toContain(
      "$10.00$10.00",
    );
    expect(
      screen.getByText("RESIDENTIAL DELIVERY").closest("tr")?.textContent,
    ).toContain("$15.00$15.00");
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
      enterNewChargeRates("0", "0");
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
    enterNewChargeRates("0", "0");
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

    const deleteButton = screen.getByRole("button", {
      name: "Delete Fuel surcharge",
    });
    expect(deleteButton.className).toContain("ant-btn-dangerous");
    expect(
      container.querySelector(".shipment-charge-table tfoot")?.textContent,
    ).toContain("$110.00$135.00$25.00");

    fireEvent.click(deleteButton);
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Fuel surcharge")).toBeNull();
    });
    expect(
      container.querySelector(".shipment-charge-table tfoot")?.textContent,
    ).toContain("$90.00$105.00$15.00");
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

    fireEvent.click(
      screen.getByRole("button", { name: "Delete Fuel surcharge" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Fuel surcharge")).toBeTruthy();
    expect(container.querySelector(".shipment-charge-table tfoot")?.textContent).toContain(
      "$110.00$135.00",
    );
    expect(onChangeCommitted).not.toHaveBeenCalled();
  });

  it("Charges_whenFreightDescriptionIsLoaded_disablesDeletion", () => {
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

    expect(deleteButton).toHaveProperty("disabled", true);
    expect(deleteButton.getAttribute("title")).toBe(
      "Freight charge cannot be deleted",
    );
    fireEvent.click(deleteButton);

    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.getByText("Freight")).toBeTruthy();
    expect(
      container.querySelector(".shipment-charge-table tfoot")?.textContent,
    ).toContain("$110.00$135.00$25.00");
    expect(onChangeCommitted).not.toHaveBeenCalled();
  });

  it("Charges_whenFreightDescriptionIsAdded_disablesDeletion", () => {
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

    fireEvent.click(screen.getByRole("button", { name: /Add Line/ }));
    fireEvent.change(screen.getByLabelText("New charge description"), {
      target: { value: " Freight " },
    });
    enterNewChargeRates("10", "20");
    fireEvent.click(
      screen.getByRole("button", { name: "Save new charge line" }),
    );

    const deleteButton = screen.getByTitle(
      "Freight charge cannot be deleted",
    );
    expect(deleteButton).toHaveProperty("disabled", true);
    expect(onChangeCommitted).toHaveBeenCalledTimes(1);
  });

  it("Charges_whenDescriptionIsNotExactlyFreight_allowsDeletion", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: /Add Line/ }));
    fireEvent.change(screen.getByLabelText("New charge description"), {
      target: { value: "Freight Charge" },
    });
    enterNewChargeRates("10", "20");
    fireEvent.click(
      screen.getByRole("button", { name: "Save new charge line" }),
    );

    const deleteButton = screen.getByRole("button", {
      name: "Delete Freight Charge",
    });
    expect(deleteButton).toHaveProperty("disabled", false);
    fireEvent.click(deleteButton);
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Freight Charge")).toBeNull();
    });
    expect(onChangeCommitted).toHaveBeenCalledTimes(2);
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

  it.each([
    ["BuyAndSellRatesAreEmpty", null, null, "Buy and sell rates are required"],
    ["BuyRateIsEmpty", null, "25", "Buy rate is required"],
    ["SellRateIsEmpty", "20", null, "Sell rate is required"],
  ])(
    "Charges_when%s_blocksSavingTheNewLine",
    async (_scenario, buyCost, sellCost, expectedMessage) => {
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

      fireEvent.click(screen.getByRole("button", { name: /Add Line/ }));
      fireEvent.change(screen.getByLabelText("New charge description"), {
        target: { value: "Custom handling" },
      });
      if (buyCost !== null) {
        fireEvent.change(screen.getByLabelText("New buy charge"), {
          target: { value: buyCost },
        });
      }
      if (sellCost !== null) {
        fireEvent.change(screen.getByLabelText("New sell charge"), {
          target: { value: sellCost },
        });
      }

      fireEvent.click(
        screen.getByRole("button", { name: "Save new charge line" }),
      );

      expect(await screen.findByText(expectedMessage)).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Save new charge line" }),
      ).toBeTruthy();
      expect(onChangeCommitted).not.toHaveBeenCalled();
    },
  );

  it("Charges_whenAnExistingRateIsCleared_blocksSavingTheEditedLine", async () => {
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

    fireEvent.click(
      screen.getByRole("button", { name: "Edit Fuel surcharge" }),
    );
    fireEvent.change(screen.getByLabelText("Buy charge"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save charge line" }));

    expect(await screen.findByText("Buy rate is required")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Save charge line" }),
    ).toBeTruthy();
    expect(
      container.querySelector(".shipment-charge-table tfoot")?.textContent,
    ).toContain("$110.00$135.00$25.00");
    expect(onChangeCommitted).not.toHaveBeenCalled();
  });

  it("Charges_whenBuyAndSellRatesAreZero_savesTheNewLine", () => {
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

    fireEvent.click(screen.getByRole("button", { name: /Add Line/ }));
    fireEvent.change(screen.getByLabelText("New charge description"), {
      target: { value: "Zero handling" },
    });
    enterNewChargeRates("0", "0");
    fireEvent.click(
      screen.getByRole("button", { name: "Save new charge line" }),
    );

    expect(
      screen.queryByRole("button", { name: "Save new charge line" }),
    ).toBeNull();
    expect(screen.getByText("Zero handling").closest("tr")?.textContent).toContain(
      "$0.00$0.00",
    );
    expect(onChangeCommitted).toHaveBeenCalledTimes(1);
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
  it("Charges_FlatMarkupApplied_DistributesMarkupAcrossFreightAndFuel", () => {
    renderCharges(shipmentWithCharges);
    fireEvent.click(screen.getByRole("checkbox", { name: "Mark Up" }));
    fireEvent.change(screen.getByLabelText("Markup amount"), { target: { value: "150" } });
    expect(screen.getByLabelText("Minimum markup").hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByText("$222.73")).toBeTruthy();
    expect(screen.getByText("$47.27")).toBeTruthy();
    expect(screen.getByText("$260.00")).toBeTruthy();
  });

  it("Charges_NetSellApplied_ZeroesOnlyNonFreightSellAmounts", () => {
    renderCharges(shipmentWithCharges);
    fireEvent.click(screen.getByRole("checkbox", { name: "Net Sell Rate" }));
    fireEvent.change(screen.getByLabelText("Net sell amount"), { target: { value: "200" } });
    fireEvent.keyDown(screen.getByLabelText("Net sell amount"), { key: "Enter", code: "Enter" });
    for (const description of ["Discount", "Fuel surcharge"]) {
      const row = screen.getByText(description).closest("tr")!;
      expect(within(row).getAllByRole("cell")[3].textContent).toBe("$0.00");
    }
    expect(screen.getAllByText("$200.00")).toHaveLength(2);
  });

  it("Charges_NetSellDisabled_RestoresSourceBuyAmounts", () => {
    renderCharges(shipmentWithCharges);
    fireEvent.click(screen.getByRole("checkbox", { name: "Net Sell Rate" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Net Sell Rate" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    const fuel = screen.getByText("Fuel surcharge").closest("tr")!;
    expect(within(fuel).getAllByText("$20.00")).toHaveLength(2);
  });

  it.each([[true, true], [true, false], [false, true], [false, false]])(
    "Charges_CorporateFlagsAre_%s_%s_ShowsPricingAndEditing",
    (loginFlag, clientFlag) => {
      reduxMocks.isCorporate = loginFlag;
      reduxMocks.clientCorporate = clientFlag;
      renderCharges(shipmentWithCharges);
      expect(Boolean(screen.queryByRole("group", { name: "Charge pricing" }))).toBe(loginFlag);
      expect(Boolean(screen.queryByRole("button", { name: "Apply" }))).toBe(loginFlag);
      expect(Boolean(screen.queryByRole("columnheader", { name: "Buy" }))).toBe(loginFlag);
      expect(Boolean(screen.queryByRole("columnheader", { name: "Margin" }))).toBe(loginFlag);
      expect(screen.getByRole("button", { name: "Edit Freight" })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Add Line/ })).toBeTruthy();
    },
  );

  it("Charges_ConfigLoaded_PreservesExistingSellAmounts", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { isSuccess: true, data: [{ markupType: "Flat", rate: 150, minimum: 10 }] } });
    renderCharges(shipmentWithCharges);
    await waitFor(() => expect((screen.getByLabelText("Markup amount") as HTMLInputElement).value).toBe("150"));
    expect(screen.getByText("$120.00")).toBeTruthy();
    expect(screen.queryByText("$222.73")).toBeNull();
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/GetClientMarkup/CLIENT-42"), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("Charges_PricingDraftChanged_BlocksPageSaveUntilApplied", async () => {
    const onEditorStateChange = vi.fn();
    const onChangeCommitted = vi.fn();
    render(<MemoryRouter><Charges shipment={shipmentWithCharges} onChangeCommitted={onChangeCommitted} onEditorStateChange={onEditorStateChange} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("checkbox", { name: "Mark Up" }));
    await waitFor(() => expect(onEditorStateChange).toHaveBeenLastCalledWith(true));
    expect(onChangeCommitted).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(onEditorStateChange).toHaveBeenLastCalledWith(false));
    expect(onChangeCommitted).toHaveBeenCalledOnce();
  });

  it("Charges_InlineEditorOpen_DisablesApply", () => {
    renderCharges(shipmentWithCharges);
    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    expect(screen.getByRole("button", { name: "Apply" }).hasAttribute("disabled")).toBe(true);
  });

  it("Charges_ConfigArrivesAfterUserInput_PreservesUserDraft", async () => {
    let resolveConfig!: (value: unknown) => void;
    vi.mocked(axios.get).mockImplementationOnce(() => new Promise((resolve) => { resolveConfig = resolve; }));
    renderCharges(shipmentWithCharges);
    fireEvent.click(screen.getByRole("checkbox", { name: "Mark Up" }));
    fireEvent.change(screen.getByLabelText("Markup amount"), { target: { value: "75" } });
    resolveConfig({ data: { isSuccess: true, data: { markupType: "Flat", rate: 150 } } });
    await waitFor(() => expect((screen.getByLabelText("Markup amount") as HTMLInputElement).value).toBe("75"));
  });

  it("Charges_ConfigRequestFails_PreservesExistingSellAmounts", async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error("Unavailable"));
    renderCharges(shipmentWithCharges);
    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    expect(screen.getByText("$120.00")).toBeTruthy();
  });

  it("Charges_RerateAfterMarkup_PreservesSellAmountsUntilApply", () => {
    const props = { shipment: shipmentWithCharges, onChangeCommitted: vi.fn(), onEditorStateChange: vi.fn() };
    const view = render(<MemoryRouter><Charges {...props} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("checkbox", { name: "Mark Up" }));
    fireEvent.change(screen.getByLabelText("Markup amount"), { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    view.rerender(<MemoryRouter><Charges {...props} reratedRate={{ ...reratedRateBase, grossCharge: 200, discount: 10, fuelSurcharge: 40 }} /></MemoryRouter>);
    const freight = screen.getByText("Freight").closest("tr")!;
    expect(within(freight).getAllByText("$200.00")).toHaveLength(2);
    expect(within(freight).queryByText("$222.73")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(within(freight).getByText("$323.92")).toBeTruthy();
  });

  it("Charges_ApplyAfterManualSellEdit_ReplacesSellOverride", () => {
    renderCharges(shipmentWithCharges);
    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Sell charge" }), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Save charge line" }));
    expect(screen.getByText("$500.00")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Mark Up" }));
    fireEvent.change(screen.getByLabelText("Markup amount"), { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.queryByText("$500.00")).toBeNull();
    expect(screen.getByText("$222.73")).toBeTruthy();
  });

  it("Charges_ConfigRequestAfterUnmount_IsAborted", () => {
    const view = renderCharges(shipmentWithCharges);
    const signal = vi.mocked(axios.get).mock.calls.at(-1)?.[1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it.each([
    ["ManualFreightSellIsSaved", "Freight", "Sell charge", "250", "$250.00"],
    ["ManualFuelBuyIsSaved", "Fuel surcharge", "Buy charge", "30", "$30.00"],
    ["ManualFuelSellIsSaved", "Fuel surcharge", "Sell charge", "40", "$40.00"],
  ])("Charges_NetSellActive_%s", (_scenario, description, field, value, expected) => {
    renderCharges(shipmentWithCharges);
    fireEvent.click(screen.getByRole("checkbox", { name: "Net Sell Rate" }));
    fireEvent.change(screen.getByLabelText("Net sell amount"), {
      target: { value: "200" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(screen.getByRole("button", { name: `Edit ${description}` }));
    fireEvent.change(screen.getByRole("spinbutton", { name: field }), {
      target: { value },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save charge line" }));

    const row = screen.getByText(description).closest("tr")!;
    const cell = within(row).getAllByRole("cell")[field === "Buy charge" ? 2 : 3];
    expect(cell.textContent).toBe(expected);
  });

  it("Charges_MarkupActive_BuyEditPreservesExistingSell", () => {
    renderCharges(shipmentWithCharges);
    fireEvent.click(screen.getByRole("checkbox", { name: "Mark Up" }));
    fireEvent.change(screen.getByLabelText("Markup amount"), {
      target: { value: "150" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Buy charge" }), {
      target: { value: "125" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save charge line" }));

    const row = screen.getByText("Freight").closest("tr")!;
    expect(within(row).getByText("$125.00")).toBeTruthy();
    expect(within(row).getByText("$222.73")).toBeTruthy();
  });

  it("Charges_ManualEditSaved_ReopeningEditorRetainsAmounts", () => {
    renderCharges(shipmentWithCharges);
    fireEvent.click(screen.getByRole("checkbox", { name: "Net Sell Rate" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Fuel surcharge" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Buy charge" }), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Sell charge" }), {
      target: { value: "40" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save charge line" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Fuel surcharge" }));

    expect((screen.getByLabelText("Buy charge") as HTMLInputElement).value).toBe("30.00");
    expect((screen.getByLabelText("Sell charge") as HTMLInputElement).value).toBe("40.00");
  });

  it("Charges_ManualEditAfterNetSell_UpdatesTotalsAndNotifiesParent", () => {
    const onChangeCommitted = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <Charges shipment={shipmentWithCharges} onChangeCommitted={onChangeCommitted}
          onEditorStateChange={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Net Sell Rate" }));
    fireEvent.change(screen.getByLabelText("Net sell amount"), {
      target: { value: "200" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    onChangeCommitted.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Edit Fuel surcharge" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Buy charge" }), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Sell charge" }), {
      target: { value: "40" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save charge line" }));

    const totals = container.querySelector("tfoot")!;
    const cells = within(totals).getAllByRole("cell");
    expect(cells[1].textContent).toBe("$120.00");
    expect(cells[2].textContent).toBe("$240.00");
    expect(cells[3].textContent).toBe("$120.00");
    expect(onChangeCommitted).toHaveBeenCalledOnce();
  });

  it("Charges_NetSellDescriptionSaved_PreservesHiddenSourceBuy", () => {
    renderCharges(shipmentWithCharges);
    fireEvent.click(screen.getByRole("checkbox", { name: "Net Sell Rate" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Fuel surcharge" }));
    fireEvent.change(screen.getByLabelText("Charge description"), {
      target: { value: "Updated fuel description" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save charge line" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Net Sell Rate" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const row = screen.getByText("Updated fuel description").closest("tr")!;
    expect(within(row).getAllByText("$20.00")).toHaveLength(2);
  });

  it("Charges_NetSellApplied_SetsFreightSellToEnteredAmount", () => {
    renderCharges(shipmentWithCharges);
    fireEvent.click(screen.getByRole("checkbox", { name: "Net Sell Rate" }));
    fireEvent.change(screen.getByLabelText("Net sell amount"), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    const row = screen.getByText("Freight").closest("tr")!;
    expect(within(row).getAllByRole("cell")[3].textContent).toBe("$200.00");
  });

  it.each([
    ["Freight", "125", "$125.00"],
    ["Discount", "15", "($15.00)"],
    ["Fuel surcharge", "35", "$35.00"],
    ["Inside delivery", "55", "$55.00"],
  ])("Charges_NetSellApplied_PreservesManuallyEditedBuyAmounts_%s", (description, amount, expected) => {
    renderCharges(shipmentWithAccessorialCharges);
    fireEvent.click(screen.getByRole("button", { name: `Edit ${description}` }));
    fireEvent.change(screen.getByLabelText("Buy charge"), { target: { value: amount } });
    fireEvent.click(screen.getByRole("button", { name: "Save charge line" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Net Sell Rate" }));
    fireEvent.change(screen.getByLabelText("Net sell amount"), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const row = screen.getByText(description).closest("tr")!;
    expect(within(row).getAllByRole("cell")[2].textContent).toBe(expected);
  });

  it("Charges_NetSellReapplied_PreservesCurrentBuyAmounts", () => {
    renderCharges(shipmentWithCharges);
    fireEvent.click(screen.getByRole("checkbox", { name: "Net Sell Rate" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Fuel surcharge" }));
    fireEvent.change(screen.getByLabelText("Buy charge"), { target: { value: "35" } });
    fireEvent.click(screen.getByRole("button", { name: "Save charge line" }));
    fireEvent.change(screen.getByLabelText("Net sell amount"), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const row = screen.getByText("Fuel surcharge").closest("tr")!;
    expect(within(row).getAllByRole("cell")[2].textContent).toBe("$35.00");
  });

  it("Charges_NetSellApplied_PreservesBuyTotalsAndUpdatesSellAndMargin", () => {
    const { container } = renderCharges({
      ...shipmentWithCharges,
      buyRate: { ...shipmentWithCharges.buyRate!, accesorialCostDetails: [
        { accCode: "LFG", description: "Lift gate", ratedCost: 40, billedCost: 40 },
      ] },
      sellRate: { ...shipmentWithCharges.sellRate!, accesorialCostDetails: [
        { accCode: "LFG", description: "Lift gate", ratedCost: 45, billedCost: 45 },
      ] },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Net Sell Rate" }));
    fireEvent.change(screen.getByLabelText("Net sell amount"), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const cells = within(container.querySelector("tfoot")!).getAllByRole("cell");
    expect(cells[1].textContent).toBe("$150.00");
    expect(cells[2].textContent).toBe("$200.00");
    expect(cells[3].textContent).toBe("$50.00");
  });

  it.each([
    [true, "false", true],
    [false, "true", false],
    [null, "true", false],
    [null, "false", false],
    [null, null, false],
  ])("Charges_LoginFlag_%s_StoredFlag_%s_ResolvesVisibility", (loginFlag, storedFlag, expected) => {
    reduxMocks.isCorporate = loginFlag;
    if (storedFlag !== null) localStorage.setItem("isCorporate", storedFlag);
    renderCharges(shipmentWithCharges);
    expect(Boolean(screen.queryByRole("columnheader", { name: "Buy" }))).toBe(expected);
  });

  it("Charges_UnknownLoginFlagWithCorporateClient_HidesCorporatePricing", () => {
    reduxMocks.isCorporate = null;
    reduxMocks.clientCorporate = true;
    localStorage.setItem("isCorporate", "true");
    renderCharges(shipmentWithCharges);

    expect(screen.queryByRole("group", { name: "Charge pricing" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Buy" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Margin" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Sell" })).toBeTruthy();
  });

  it("Charges_LoginFlagBecomesNonCorporate_KeepsSellEditorActive", () => {
    const onEditorStateChange = vi.fn();
    const props = { shipment: shipmentWithCharges, onChangeCommitted: vi.fn(), onEditorStateChange };
    const { rerender } = render(<MemoryRouter><Charges {...props} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    reduxMocks.isCorporate = false;
    rerender(<MemoryRouter><Charges {...props} /></MemoryRouter>);

    expect(screen.queryByLabelText("Buy charge")).toBeNull();
    expect(screen.getByLabelText("Sell charge")).toBeTruthy();
    expect(onEditorStateChange).toHaveBeenLastCalledWith(true);
  });

  it("Charges_CorporateDraftBecomesNonCorporate_DiscardsDraftAndUnblocksSave", () => {
    const onEditorStateChange = vi.fn();
    const props = { shipment: shipmentWithCharges, onChangeCommitted: vi.fn(), onEditorStateChange };
    const { rerender } = render(<MemoryRouter><Charges {...props} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("checkbox", { name: "Mark Up" }));
    fireEvent.change(screen.getByLabelText("Markup amount"), { target: { value: "999" } });
    expect(onEditorStateChange).toHaveBeenLastCalledWith(true);
    reduxMocks.isCorporate = false;
    rerender(<MemoryRouter><Charges {...props} /></MemoryRouter>);
    expect(onEditorStateChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("group", { name: "Charge pricing" })).toBeNull();
    expect(screen.getByText("$120.00")).toBeTruthy();
    reduxMocks.isCorporate = true;
    rerender(<MemoryRouter><Charges {...props} /></MemoryRouter>);
    expect(screen.queryByLabelText("Markup amount")).toBeNull();
  });

  it("Charges_ClientFlagBecomesNonCorporate_KeepsLineEditorActive", () => {
    const onEditorStateChange = vi.fn();
    const props = { shipment: shipmentWithCharges, onChangeCommitted: vi.fn(), onEditorStateChange };
    const { rerender } = render(<MemoryRouter><Charges {...props} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    reduxMocks.clientCorporate = false;
    rerender(<MemoryRouter><Charges {...props} /></MemoryRouter>);
    expect(screen.getByLabelText("Buy charge")).toBeTruthy();
    expect(screen.getByLabelText("Sell charge")).toBeTruthy();
    expect(onEditorStateChange).toHaveBeenLastCalledWith(true);
  });

  it("Charges_NonCorporateExistingBuyNull_SavesSellWithoutRequiringBuy", () => {
    reduxMocks.isCorporate = false;
    const onChangeCommitted = vi.fn();
    const props = { shipment: { ...shipmentWithCharges, buyRate: null }, onChangeCommitted, onEditorStateChange: vi.fn() };
    const { rerender } = render(<MemoryRouter><Charges {...props} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
    fireEvent.change(screen.getByLabelText("Sell charge"), { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "Save charge line" }));
    expect(onChangeCommitted).toHaveBeenCalledOnce();
    reduxMocks.isCorporate = true;
    rerender(<MemoryRouter><Charges {...props} /></MemoryRouter>);
    expect(within(screen.getByText("Freight").closest("tr")!).getAllByRole("cell")[2].textContent).toBe("");
  });

  it("Charges_NonCorporateNewSellMissing_BlocksSave", async () => {
    reduxMocks.isCorporate = false;
    renderCharges(shipmentWithCharges);
    fireEvent.click(screen.getByRole("button", { name: /Add Line/ }));
    fireEvent.change(screen.getByLabelText("New charge description"), { target: { value: "Custom handling" } });
    fireEvent.click(screen.getByRole("button", { name: "Save new charge line" }));
    expect(await screen.findByText("Sell rate is required")).toBeTruthy();
    expect(screen.getByLabelText("New sell charge")).toBeTruthy();
  });

  describe("noncorporate users", () => {
    beforeEach(() => {
      reduxMocks.isCorporate = false;
      reduxMocks.clientCorporate = false;
    });

    it("Charges_NonCorporateUser_ShowsBuyAndMarginAmountsAndTotals", async () => {
      const { container } = renderCharges(shipmentWithCharges);
      expect(screen.queryByRole("columnheader", { name: "Buy" })).toBeNull();
      expect(screen.queryByRole("columnheader", { name: "Margin" })).toBeNull();
      expect(screen.getByText("Freight").closest("tr")!.children).toHaveLength(4);
      const totals = within(container.querySelector("tfoot")!).getAllByRole("cell");
      expect(totals).toHaveLength(3);
      expect(totals[1].textContent).toBe("$135.00");
    });

    it("Charges_NonCorporateUser_CanApplyMarkup", async () => {
      renderCharges(shipmentWithCharges);
      expect(screen.queryByRole("checkbox", { name: "Mark Up" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    });

    it("Charges_NonCorporateUser_CanApplyNetSell", async () => {
      renderCharges(shipmentWithCharges);
      expect(screen.queryByRole("checkbox", { name: "Net Sell Rate" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    });

    it("Charges_NonCorporateUser_CanSaveManualRowEdits", async () => {
      const { rerender } = renderCharges(shipmentWithCharges);
      fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
      expect(screen.queryByLabelText("Buy charge")).toBeNull();
      fireEvent.change(screen.getByLabelText("Sell charge"), { target: { value: "250" } });
      fireEvent.click(screen.getByRole("button", { name: "Save charge line" }));
      expect(screen.getByText("$250.00")).toBeTruthy();
      reduxMocks.isCorporate = true;
      rerender(<MemoryRouter><Charges shipment={shipmentWithCharges} onChangeCommitted={vi.fn()} onEditorStateChange={vi.fn()} /></MemoryRouter>);
      const cells = within(screen.getByText("Freight").closest("tr")!).getAllByRole("cell");
      expect(cells[2].textContent).toBe("$100.00");
    });

    it("Charges_NonCorporateUser_CanAddAccessorialRow", async () => {
      const { rerender } = renderCharges(shipmentWithCharges);
      fireEvent.click(screen.getByRole("button", { name: /Add Line/ }));
      expect(screen.queryByLabelText("New buy charge")).toBeNull();
      expect(screen.getByLabelText("New sell charge").closest("tr")!.children).toHaveLength(4);
      fireEvent.change(screen.getByLabelText("New charge description"), { target: { value: "Custom handling" } });
      fireEvent.change(screen.getByLabelText("New sell charge"), { target: { value: "15" } });
      fireEvent.click(screen.getByRole("button", { name: "Save new charge line" }));
      reduxMocks.isCorporate = true;
      rerender(<MemoryRouter><Charges shipment={shipmentWithCharges} onChangeCommitted={vi.fn()} onEditorStateChange={vi.fn()} /></MemoryRouter>);
      const cells = within(screen.getByText("Custom handling").closest("tr")!).getAllByRole("cell");
      expect(cells[2].textContent).toBe("$15.00");
      expect(cells[3].textContent).toBe("$15.00");
    });

    it("Charges_NonCorporateUser_CanDeleteAccessorialRow", async () => {
      renderCharges(shipmentWithAccessorialCharges);
      fireEvent.click(screen.getByRole("button", { name: "Delete Inside delivery" }));
      fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
      await waitFor(() => expect(screen.queryByText("Inside delivery")).toBeNull());
    });

    it("Charges_NonCorporateUser_FreightDeletionRemainsDisabled", () => {
      renderCharges(shipmentWithCharges);
      expect(screen.getByRole("button", { name: "Delete Freight" }).hasAttribute("disabled")).toBe(true);
    });

    it("Charges_NonCorporateUser_MissingRateBlocksRowSave", async () => {
      renderCharges(shipmentWithCharges);
      fireEvent.click(screen.getByRole("button", { name: "Edit Freight" }));
      fireEvent.change(screen.getByLabelText("Sell charge"), { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: "Save charge line" }));
      expect(await screen.findByText("Sell rate is required")).toBeTruthy();
      expect(screen.getByLabelText("Sell charge")).toBeTruthy();
    });

    it("Charges_NonCorporatePricingDraft_BlocksSaveUntilApplied", async () => {
      const onEditorStateChange = vi.fn();
      render(<MemoryRouter><Charges shipment={shipmentWithCharges}
        onChangeCommitted={vi.fn()} onEditorStateChange={onEditorStateChange} /></MemoryRouter>);
      expect(screen.queryByRole("group", { name: "Charge pricing" })).toBeNull();
      expect(onEditorStateChange).toHaveBeenLastCalledWith(false);
    });

    it("Charges_NonCorporateUser_LoadsClientMarkupDefaultsWithoutApplying", async () => {
      renderCharges(shipmentWithCharges);
      expect(screen.queryByLabelText("Markup amount")).toBeNull();
      expect(axios.get).not.toHaveBeenCalled();
      expect(screen.getByText("$120.00")).toBeTruthy();
    });

    it("Charges_NonCorporateUser_EmptyTableKeepsSixColumnStructure", () => {
      renderCharges();
      expect(screen.getByText("No charges were returned.").getAttribute("colspan")).toBe("4");
    });
  });

});
