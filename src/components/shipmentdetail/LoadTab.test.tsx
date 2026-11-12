// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShipmentDetails } from "../../types/shipment.types";
import LoadTab from "./LoadTab";


const reduxMocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  fetchAccessorials: vi.fn((clientCode: string | null | undefined) => ({
    type: "accessorials/fetchAccessorials",
    payload: clientCode,
  })),
  fetchPackageTypes: vi.fn(() => ({
    type: "packageTypes/fetchPackageTypes",
  })),
  searchShipmentProducts: vi.fn(
    (payload: { clientCode: string; searchText: string }) => ({
      type: "shipmentProductSearch/searchShipmentProducts",
      payload,
    }),
  ),
  clearShipmentProductSearch: vi.fn(() => ({
    type: "shipmentProductSearch/clearShipmentProductSearch",
  })),
  accessorials: {
    data: [
      {
        accessorialID: 1,
        accessorialName: "Liftgate",
        accesorialCode: "LFG",
        status: true,
      },
      {
        accessorialID: 2,
        accessorialName: "Inside delivery",
        accesorialCode: "INS",
        status: true,
      },
      {
        accessorialID: 3,
        accessorialName: "Inactive service",
        status: false,
      },
    ],
    selectedAccessorialIds: [] as number[],
    loading: false,
    error: null as string | null,
  },
  packageTypes: {
    data: [
      { packageTypeId: 1, packageType: "Bag" },
      { packageTypeId: 3, packageType: "Pallet" },
    ],
    loading: false,
    error: null as string | null,
  },
  shipmentProductSearch: {
    data: [] as Array<{
      productId: number;
      description: string;
      freightClass: string;
      nmfc: string;
      weight: number | null;
      pallets: number | null;
      packageType: string;
      length: number | null;
      width: number | null;
      height: number | null;
      isHazmat: boolean;
      hazmatClass: string;
      hazmatUn: string;
      isActive: boolean | null;
    }>,
    loading: false,
    error: null as string | null,
    currentRequestId: null as string | null,
  },
}));

vi.mock("../../app/hooks", () => ({
  useAppDispatch: () => reduxMocks.dispatch,
  useAppSelector: (
    selector: (state: {
      accessorials: typeof reduxMocks.accessorials;
      packageTypes: typeof reduxMocks.packageTypes;
      shipmentProductSearch: typeof reduxMocks.shipmentProductSearch;
    }) => unknown,
  ) =>
    selector({
      accessorials: reduxMocks.accessorials,
      packageTypes: reduxMocks.packageTypes,
      shipmentProductSearch: reduxMocks.shipmentProductSearch,
    }),
}));

vi.mock("../../store/accessorialsSlice", () => ({
  fetchAccessorials: reduxMocks.fetchAccessorials,
}));

vi.mock("../../store/packageTypesSlice", () => ({
  fetchPackageTypes: reduxMocks.fetchPackageTypes,
}));

vi.mock("../../store/shipmentProductSearchSlice", () => ({
  searchShipmentProducts: reduxMocks.searchShipmentProducts,
  clearShipmentProductSearch: reduxMocks.clearShipmentProductSearch,
}));

vi.mock("./LoadInternalNotes", () => ({
  default: ({
    initialNotes,
    onNoteAdded,
    onEditorStateChange,
  }: {
    initialNotes: readonly string[] | null;
    onNoteAdded: () => void;
    onEditorStateChange: (isEditing: boolean) => void;
  }) => (
    <section className='shipment-load-internal-notes'>
      <h2>Internal Notes</h2>
      <span>{initialNotes?.join(" | ")}</span>
      <button type='button' onClick={onNoteAdded}>
        Add internal note
      </button>
      <button type='button' onClick={() => onEditorStateChange(true)}>
        Edit internal note draft
      </button>
      <button type='button' onClick={() => onEditorStateChange(false)}>
        Finish internal note draft
      </button>
    </section>
  ),
}));

const shipment = {
  loadNumber: "LOAD-100",
  products: [
    {
      productDescription: "Original freight",
      productClass: "70",
      productWeight: 100,
      pallets: 1,
      pieces: 1,
      nmfc: "12345",
      hazMat: false,
      length: 40,
      width: 48,
      height: 50,
      packageType: "Pallet",
    },
  ],
  clientCode: "CLIENT-42",
  accessorials: ["Liftgate"],
  bolDispatchNotes: ["Call before arrival", "Use dock 3"],
  buyRate: null,
  sellRate: null,
} as ShipmentDetails;

const productSearchResult = {
  productId: 14,
  description: "DO NOT SHIP",
  freightClass: "50",
  nmfc: "123456-00",
  weight: 1200,
  pallets: 2,
  packageType: "Carton",
  length: 48,
  width: 48,
  height: 48,
  isHazmat: false,
  hazmatClass: "",
  hazmatUn: "",
  isActive: true,
};

describe("LoadTab", () => {
  it("LoadTab_AcceptedWeightEdit_PreservesHiddenProductFields", () => {
    const onValuesChange = vi.fn();
    const shipmentWithMetadata = {
      ...shipment,
      products: [{ ...shipment.products[0], skuNumber: "SKU-42", accountNumber: "ACCOUNT-1", pcf: 12.5 }],
    };
    render(<LoadTab shipment={shipmentWithMetadata} onChangeCommitted={vi.fn()} onEditorStateChange={vi.fn()} onValuesChange={onValuesChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.change(screen.getByLabelText("Weight in pounds"), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    expect(onValuesChange).toHaveBeenLastCalledWith(expect.objectContaining({ products: [expect.objectContaining({
      productWeight: 250, skuNumber: "SKU-42", accountNumber: "ACCOUNT-1", pcf: 12.5,
    })] }));
  });

  it("LoadTab_CancelledWeightEdit_DoesNotPublishDraft", () => {
    const onValuesChange = vi.fn();
    render(<LoadTab shipment={shipment} onChangeCommitted={vi.fn()} onEditorStateChange={vi.fn()} onValuesChange={onValuesChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.change(screen.getByLabelText("Weight in pounds"), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel load line editing" }));
    expect(onValuesChange).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    reduxMocks.dispatch.mockReset();
    reduxMocks.fetchAccessorials.mockClear();
    reduxMocks.fetchPackageTypes.mockClear();
    reduxMocks.searchShipmentProducts.mockClear();
    reduxMocks.clearShipmentProductSearch.mockClear();
    reduxMocks.accessorials.data.splice(
      0,
      reduxMocks.accessorials.data.length,
      {
        accessorialID: 1,
        accessorialName: "Liftgate",
        accesorialCode: "LFG",
        status: true,
      },
      {
        accessorialID: 2,
        accessorialName: "Inside delivery",
        accesorialCode: "INS",
        status: true,
      },
      {
        accessorialID: 3,
        accessorialName: "Inactive service",
        status: false,
      },
    );
    reduxMocks.accessorials.loading = false;
    reduxMocks.accessorials.error = null;
    reduxMocks.packageTypes.data.splice(
      0,
      reduxMocks.packageTypes.data.length,
      { packageTypeId: 1, packageType: "Bag" },
      { packageTypeId: 3, packageType: "Pallet" },
    );
    reduxMocks.packageTypes.loading = false;
    reduxMocks.packageTypes.error = null;
    reduxMocks.shipmentProductSearch.data.splice(0);
    reduxMocks.shipmentProductSearch.loading = false;
    reduxMocks.shipmentProductSearch.error = null;
    reduxMocks.shipmentProductSearch.currentRequestId = null;
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}

        unobserve() {}

        disconnect() {}
      },
    );
  });

  it("LoadTab_whenRendered_dispatchesThePackageTypeLookup", () => {
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    expect(reduxMocks.fetchPackageTypes).toHaveBeenCalledTimes(1);
    expect(reduxMocks.dispatch).toHaveBeenCalledWith({
      type: "packageTypes/fetchPackageTypes",
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("LoadTab_whenRendered_placesDescriptionInTheFirstLoadColumn", () => {
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader")[0].textContent).toBe(
      "Description",
    );
    const loadRow = screen.getByText("Original freight").closest("tr");
    if (!loadRow) throw new Error("Load line was not rendered.");
    expect(loadRow.cells[0].textContent).toBe("Original freight");
  });

  it("LoadTab_whenOneDescriptionCharacterIsTyped_doesNotDispatchAProductSearch", () => {
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "D" },
    });

    expect(reduxMocks.searchShipmentProducts).not.toHaveBeenCalled();
  });

  it("LoadTab_whenTwoDescriptionCharactersAreTyped_dispatchesTheDebouncedShipmentClientSearch", () => {
    vi.useFakeTimers();
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: " DO " },
    });
    expect(reduxMocks.searchShipmentProducts).not.toHaveBeenCalled();

    vi.advanceTimersByTime(350);

    expect(reduxMocks.searchShipmentProducts).toHaveBeenCalledWith({
      clientCode: "CLIENT-42",
      searchText: "DO",
    });
  });

  it("LoadTab_whenShipmentClientIsEmpty_usesTheDefaultClientForProductSearch", () => {
    vi.useFakeTimers();
    render(
      <LoadTab
        shipment={{ ...shipment, clientCode: " " }}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "DO" },
    });
    vi.advanceTimersByTime(350);

    expect(reduxMocks.searchShipmentProducts).toHaveBeenCalledWith({
      clientCode: "DEVTS",
      searchText: "DO",
    });
  });

  it("LoadTab_whenChangedLineIsAccepted_notifiesTheParent", () => {
    const onChangeCommitted = vi.fn();
    const onRateInputsChange = vi.fn();
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={onChangeCommitted}
        onEditorStateChange={vi.fn()}
        onRateInputsChange={onRateInputsChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Updated freight" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));

    expect(onChangeCommitted).toHaveBeenCalledTimes(1);
    expect(onRateInputsChange).toHaveBeenCalledWith({
      shipments: [
        expect.objectContaining({
          description: "Updated freight",
          class: "70",
          weight: 100,
          units: 1,
        }),
      ],
      accessorialCodes: ["LFG"],
    });
  });

  it("LoadTab_whenProductResultsExist_showsDescriptionPackagingGroupAndClass", async () => {
    reduxMocks.shipmentProductSearch.data.push(productSearchResult);
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "DO" },
    });

    expect(
      await screen.findByRole("option", { name: "DO NOT SHIP" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Packaging group: Carton | Class: 50"),
    ).toBeTruthy();
  });

  it("LoadTab_whenProductSuggestionIsSelected_fillsEveryMatchingLoadField", async () => {
    reduxMocks.shipmentProductSearch.data.push(productSearchResult);
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "DO" },
    });
    await screen.findByRole("option", { name: "DO NOT SHIP" });
    fireEvent.click(screen.getByText("DO NOT SHIP", { selector: "strong" }));

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>("Description").value).toBe(
        "DO NOT SHIP",
      );
    });
    expect(screen.getByLabelText<HTMLInputElement>("Units").value).toBe("2");
    expect(screen.getByLabelText<HTMLInputElement>("Weight in pounds").value).toBe(
      "1200",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Length in inches").value).toBe(
      "48",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Width in inches").value).toBe(
      "48",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Height in inches").value).toBe(
      "48",
    );
    expect(screen.getByLabelText<HTMLInputElement>("NMFC").value).toBe(
      "123456-00",
    );

    const packageSelect = screen
      .getByLabelText("Package")
      .closest<HTMLElement>(".ant-select");
    const freightClassSelect = screen
      .getByLabelText("Freight class")
      .closest<HTMLElement>(".ant-select");
    if (!packageSelect || !freightClassSelect) {
      throw new Error("Product-backed selects were not rendered.");
    }
    expect(within(packageSelect).getByText("Carton")).toBeTruthy();
    expect(within(freightClassSelect).getByText("50")).toBeTruthy();
  });

  it("LoadTab_whenZeroValueProductIsSelected_preservesZeroesInTheInputs", async () => {
    reduxMocks.shipmentProductSearch.data.push({
      ...productSearchResult,
      productId: 16,
      description: "ZERO PRODUCT",
      weight: 0,
      pallets: 0,
      length: 0,
      width: 0,
      height: 0,
    });
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "ZE" },
    });
    await screen.findByRole("option", { name: "ZERO PRODUCT" });
    fireEvent.click(screen.getByText("ZERO PRODUCT", { selector: "strong" }));

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>("Units").value).toBe("0");
    });
    expect(screen.getByLabelText<HTMLInputElement>("Weight in pounds").value).toBe(
      "0",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Length in inches").value).toBe(
      "0",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Width in inches").value).toBe(
      "0",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Height in inches").value).toBe(
      "0",
    );
  });

  it("LoadTab_whenProductLookupFails_displaysTheLookupError", async () => {
    reduxMocks.shipmentProductSearch.error = "Products unavailable";
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "DO" },
    });

    expect(await screen.findByText("Products unavailable")).toBeTruthy();
  });

  it("LoadTab_whenProductLookupIsPending_displaysTheLoadingMessage", async () => {
    reduxMocks.shipmentProductSearch.loading = true;
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "DO" },
    });

    expect(await screen.findByText("Searching products...")).toBeTruthy();
  });

  it("LoadTab_whenProductLookupReturnsNoResults_displaysTheEmptyMessage", async () => {
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "DO" },
    });

    expect(await screen.findByText("No products found")).toBeTruthy();
  });

  it("LoadTab_whenProductSearchIsSuperseded_abortsThePreviousRequest", () => {
    vi.useFakeTimers();
    const abortFirstRequest = vi.fn();
    const abortSecondRequest = vi.fn();
    reduxMocks.dispatch.mockImplementation((action: { type: string }) => {
      if (action.type !== "shipmentProductSearch/searchShipmentProducts") {
        return action;
      }

      return reduxMocks.searchShipmentProducts.mock.calls.length === 1
        ? { abort: abortFirstRequest }
        : { abort: abortSecondRequest };
    });
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    const description = screen.getByLabelText("Description");
    fireEvent.change(description, { target: { value: "DO" } });
    vi.advanceTimersByTime(350);
    fireEvent.change(description, { target: { value: "DON" } });

    expect(abortFirstRequest).toHaveBeenCalledTimes(1);
    expect(abortSecondRequest).not.toHaveBeenCalled();
  });

  it("LoadTab_whenExistingLineIsEdited_offersOnlySupportedFreightClasses", async () => {
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.mouseDown(screen.getByLabelText("Freight class"));

    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "50",
      "55",
      "60",
      "65",
      "70",
      "77.5",
      "85",
      "92.5",
      "100",
      "110",
      "125",
      "150",
      "175",
      "200",
      "250",
      "300",
      "400",
      "500",
    ]);
  });

  it("LoadTab_whenExistingLineIsEdited_offersPackageTypesReturnedByTheLookup", async () => {
    reduxMocks.packageTypes.data.splice(
      0,
      reduxMocks.packageTypes.data.length,
      { packageTypeId: 1, packageType: "Pallet" },
      { packageTypeId: 2, packageType: "crate" },
      { packageTypeId: 3, packageType: "Bag" },
    );
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.mouseDown(screen.getByLabelText("Package"));

    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "Bag",
      "crate",
      "Pallet",
    ]);
  });

  it("LoadTab_whenExistingLineIsEdited_preservesTheRowsPackageSelection", () => {
    reduxMocks.packageTypes.data.splice(
      0,
      reduxMocks.packageTypes.data.length,
      { packageTypeId: 1, packageType: "Pallet" },
      { packageTypeId: 2, packageType: "Crate" },
      { packageTypeId: 3, packageType: "Bag" },
    );
    const shipmentWithCrate = {
      ...shipment,
      products: shipment.products.map((product) => ({
        ...product,
        packageType: "Crate",
      })),
    };

    render(
      <LoadTab
        shipment={shipmentWithCrate}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));

    const packageSelect = screen
      .getByLabelText("Package")
      .closest<HTMLElement>(".ant-select");
    if (!packageSelect) throw new Error("Package select was not rendered.");
    expect(within(packageSelect).getByText("Crate")).toBeTruthy();
  });

  it("LoadTab_whenExistingLineHasNoPackage_selectsTheApiPalletByDefault", () => {
    const shipmentWithoutPackage = {
      ...shipment,
      products: shipment.products.map((product) => ({
        ...product,
        packageType: null,
      })),
    };

    render(
      <LoadTab
        shipment={shipmentWithoutPackage}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));

    const packageSelect = screen
      .getByLabelText("Package")
      .closest<HTMLElement>(".ant-select");
    if (!packageSelect) throw new Error("Package select was not rendered.");
    expect(within(packageSelect).getByText("Pallet")).toBeTruthy();
  });

  it("LoadTab_whenPackageTypeIsSelectedAndSaved_commitsTheSelectedText", async () => {
    const onChangeCommitted = vi.fn();
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={onChangeCommitted}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.mouseDown(screen.getByLabelText("Package"));
    fireEvent.click(await screen.findByRole("option", { name: "Bag" }));
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));

    const loadRow = screen.getByText("Original freight").closest("tr");
    if (!loadRow) throw new Error("Load line was not rendered.");
    expect(within(loadRow).getByText("Bag")).toBeTruthy();
    expect(onChangeCommitted).toHaveBeenCalledWith(false);
  });

  it("LoadTab_whenFreightClassIsSelectedAndSaved_commitsTheSelectedClass", async () => {
    const onChangeCommitted = vi.fn();
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={onChangeCommitted}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.mouseDown(screen.getByLabelText("Freight class"));
    fireEvent.click(await screen.findByRole("option", { name: "85" }));
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));

    const loadRow = screen.getByText("Original freight").closest("tr");
    if (!loadRow) throw new Error("Load line was not rendered.");
    expect(within(loadRow).getByText("85")).toBeTruthy();
    expect(onChangeCommitted).toHaveBeenCalledWith(true);
  });

  it.each([
    ["Units", "2"],
    ["Weight in pounds", "200"],
    ["Length in inches", "41"],
    ["Width in inches", "49"],
    ["Height in inches", "51"],
  ])(
    "LoadTab_when%sIsChangedAndSaved_requestsRerating",
    (label, value) => {
      const onChangeCommitted = vi.fn();
      render(
        <LoadTab
          shipment={shipment}
          onChangeCommitted={onChangeCommitted}
          onEditorStateChange={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
      fireEvent.change(screen.getByLabelText(label), {
        target: { value },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save load line" }));

      expect(onChangeCommitted).toHaveBeenCalledWith(true);
    },
  );

  it.each([
    ["Description", "Updated freight"],
    ["NMFC", "67890"],
  ])(
    "LoadTab_when%sIsChangedAndSaved_doesNotRequestRerating",
    (label, value) => {
      const onChangeCommitted = vi.fn();
      render(
        <LoadTab
          shipment={shipment}
          onChangeCommitted={onChangeCommitted}
          onEditorStateChange={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
      fireEvent.change(screen.getByLabelText(label), {
        target: { value },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save load line" }));

      expect(onChangeCommitted).toHaveBeenCalledWith(false);
    },
  );

  it("LoadTab_whenNewLineIsSaved_requestsRerating", () => {
    const onChangeCommitted = vi.fn();
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={onChangeCommitted}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Enter a new load line" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save new load line" }));

    expect(onChangeCommitted).toHaveBeenCalledWith(true);
  });

  it("LoadTab_whenNewLineIsEntered_rendersFreightClassAsASelect", () => {
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Enter a new load line" }),
    );

    expect(
      screen.getByRole("combobox", { name: "Freight class" }),
    ).toBeTruthy();
  });

  it("LoadTab_whenNewLineIsEntered_rendersPackageAsASelect", () => {
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Enter a new load line" }),
    );

    expect(screen.getByRole("combobox", { name: "Package" })).toBeTruthy();
  });

  it("LoadTab_whenPackageLookupFails_preservesTheExistingPackageValue", async () => {
    reduxMocks.packageTypes.data.splice(0);
    reduxMocks.packageTypes.error = "Package types unavailable";
    const onChangeCommitted = vi.fn();
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={onChangeCommitted}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.mouseDown(screen.getByLabelText("Package"));
    expect(await screen.findByText("Package types unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));

    const loadRow = screen.getByText("Original freight").closest("tr");
    if (!loadRow) throw new Error("Load line was not rendered.");
    expect(within(loadRow).getByText("Pallet")).toBeTruthy();
    expect(onChangeCommitted).not.toHaveBeenCalled();
  });

  it("LoadTab_whenUnchangedAccessorialsAreAccepted_doesNotNotifyTheParent", () => {
    const onChangeCommitted = vi.fn();
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={onChangeCommitted}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit accessorials" }));
    fireEvent.click(screen.getByRole("button", { name: "Save accessorials" }));

    expect(onChangeCommitted).not.toHaveBeenCalled();
  });

  it("LoadTab_whenLoadLineDeletionIsConfirmed_removesTheLineAndNotifiesTheParent", async () => {
    const onChangeCommitted = vi.fn();
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={onChangeCommitted}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete load line" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Original freight")).toBeNull();
    });
    expect(screen.getByText("No load products were returned.")).toBeTruthy();
    expect(onChangeCommitted).toHaveBeenCalledWith(true);
  });

  it("LoadTab_whenLoadLineDeletionIsCancelled_keepsTheLineAndDoesNotNotifyTheParent", async () => {
    const onChangeCommitted = vi.fn();
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={onChangeCommitted}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete load line" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Original freight")).toBeTruthy();
    expect(onChangeCommitted).not.toHaveBeenCalled();
  });

  it("LoadTab_whenAccessorialLineIsAddedAndSaved_commitsTheNewAccessorial", async () => {
    const onChangeCommitted = vi.fn();
    const onRateInputsChange = vi.fn();
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={onChangeCommitted}
        onEditorStateChange={vi.fn()}
        onRateInputsChange={onRateInputsChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit accessorials" }));
    const accessorialSection = screen
      .getByRole("heading", { name: "Accessorials" })
      .closest("article");
    if (!accessorialSection) throw new Error("Accessorial section was not rendered.");
    fireEvent.click(
      within(accessorialSection).getByRole("button", {
        name: "Add accessorial line",
      }),
    );
    const input = screen.getByLabelText("Accessorial 2");
    fireEvent.change(input, {
      target: { value: "Ins" },
    });
    await screen.findByRole("option", {
      name: "Inside delivery",
    });
    fireEvent.keyDown(input, {
      key: "Tab",
      code: "Tab",
      keyCode: 9,
      which: 9,
    });
    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe("Inside delivery");
    });
    fireEvent.click(screen.getByRole("button", { name: "Save accessorials" }));

    expect(within(accessorialSection).getByText("Inside delivery")).toBeTruthy();
    expect(onChangeCommitted).toHaveBeenCalledWith(true);
    expect(onRateInputsChange).toHaveBeenCalledWith(
      expect.objectContaining({ accessorialCodes: ["LFG", "INS"] }),
    );
  });

  it("LoadTab_whenAccessorialLineIsRemovedAndSaved_requestsRerating", async () => {
    const onChangeCommitted = vi.fn();
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={onChangeCommitted}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit accessorials" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Delete accessorial 1" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Save accessorials" }));

    expect(onChangeCommitted).toHaveBeenCalledWith(true);
  });

  it("LoadTab_whenAccessorialInputIsEmpty_doesNotDispatchTheAccessorialLookup", () => {
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit accessorials" }));
    fireEvent.change(screen.getByLabelText("Accessorial 1"), {
      target: { value: "" },
    });

    expect(reduxMocks.fetchAccessorials).not.toHaveBeenCalled();
  });

  it("LoadTab_whenFirstAccessorialCharacterIsTyped_dispatchesTheLookupForTheShipmentClient", () => {
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit accessorials" }));
    fireEvent.change(screen.getByLabelText("Accessorial 1"), {
      target: { value: "L" },
    });

    expect(reduxMocks.fetchAccessorials).toHaveBeenCalledTimes(1);
    expect(reduxMocks.fetchAccessorials).toHaveBeenCalledWith("CLIENT-42");
  });

  it("LoadTab_whenAdditionalAccessorialCharactersAreTyped_doesNotDispatchAnotherLookupDuringTheEditSession", () => {
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit accessorials" }));
    const input = screen.getByLabelText("Accessorial 1");
    fireEvent.change(input, { target: { value: "L" } });
    fireEvent.change(input, { target: { value: "Li" } });

    expect(reduxMocks.fetchAccessorials).toHaveBeenCalledTimes(1);
  });

  it("LoadTab_whenAccessorialQueryMatches_displaysOnlyActiveApiSuggestions", async () => {
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit accessorials" }));
    fireEvent.change(screen.getByLabelText("Accessorial 1"), {
      target: { value: "In" },
    });

    expect(
      await screen.findByRole("option", { name: "Inside delivery" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("option", { name: "Inactive service" }),
    ).toBeNull();
  });

  it("LoadTab_whenCustomAccessorialTextIsNotSelected_disablesSaving", () => {
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit accessorials" }));
    fireEvent.change(screen.getByLabelText("Accessorial 1"), {
      target: { value: "Custom handling" },
    });

    expect(
      (
        screen.getByRole("button", {
          name: "Save accessorials",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("LoadTab_whenSuggestedAccessorialIsSelectedAndSaved_commitsItsDisplayName", async () => {
    const onChangeCommitted = vi.fn();
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={onChangeCommitted}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit accessorials" }));
    const input = screen.getByLabelText("Accessorial 1");
    fireEvent.change(input, {
      target: { value: "In" },
    });
    await screen.findByRole("option", {
      name: "Inside delivery",
    });
    fireEvent.keyDown(input, {
      key: "Tab",
      code: "Tab",
      keyCode: 9,
      which: 9,
    });
    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe("Inside delivery");
    });
    fireEvent.click(screen.getByRole("button", { name: "Save accessorials" }));

    const accessorialSection = screen
      .getByRole("heading", { name: "Accessorials" })
      .closest("article");
    if (!accessorialSection) throw new Error("Accessorial section was not rendered.");
    expect(within(accessorialSection).getByText("Inside delivery")).toBeTruthy();
    expect(onChangeCommitted).toHaveBeenCalledTimes(1);
  });

  it("LoadTab_whenAccessorialLookupFails_displaysTheLookupError", async () => {
    reduxMocks.accessorials.data.splice(0);
    reduxMocks.accessorials.error = "Accessorials unavailable";
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit accessorials" }));
    fireEvent.change(screen.getByLabelText("Accessorial 1"), {
      target: { value: "L" },
    });

    expect(await screen.findByText("Accessorials unavailable")).toBeTruthy();
  });

  it("LoadTab_whenAccessorialDeletionIsConfirmedAndSaved_removesTheAccessorial", async () => {
    const onChangeCommitted = vi.fn();
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={onChangeCommitted}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit accessorials" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Delete accessorial 1" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Save accessorials" }));

    expect(screen.queryByText("Liftgate")).toBeNull();
    expect(screen.getByText("No accessorials were returned.")).toBeTruthy();
    expect(onChangeCommitted).toHaveBeenCalledTimes(1);
  });

  it("LoadTab_whenAccessorialEditingIsCancelled_discardsAddedAndDeletedLines", async () => {
    const onChangeCommitted = vi.fn();
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={onChangeCommitted}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit accessorials" }));
    const accessorialSection = screen
      .getByRole("heading", { name: "Accessorials" })
      .closest("article");
    if (!accessorialSection) throw new Error("Accessorial section was not rendered.");
    fireEvent.click(
      within(accessorialSection).getByRole("button", {
        name: "Add accessorial line",
      }),
    );
    fireEvent.change(screen.getByLabelText("Accessorial 2"), {
      target: { value: "Inside delivery" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Delete accessorial 1" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel accessorial editing" }),
    );

    expect(screen.getByText("Liftgate")).toBeTruthy();
    expect(screen.queryByText("Inside delivery")).toBeNull();
    expect(onChangeCommitted).not.toHaveBeenCalled();
  });

  it("LoadTab_whenRendered_groupsAccessorialsAndInternalNotesInTheSupportGrid", () => {
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    const accessorials = screen
      .getByRole("heading", { name: "Accessorials" })
      .closest("article");
    const internalNotes = screen
      .getByRole("heading", { name: "Internal Notes" })
      .closest(".shipment-load-internal-notes");
    const supportGrid = accessorials?.parentElement;

    expect(supportGrid?.classList.contains("shipment-load-support-grid")).toBe(
      true,
    );
    expect(internalNotes?.parentElement).toBe(supportGrid);
    expect(internalNotes?.textContent).toContain("Call before arrival");
    expect(internalNotes?.textContent).toContain("Use dock 3");
  });

  it("LoadTab_whenInternalNoteIsAdded_notifiesTheParent", () => {
    const onChangeCommitted = vi.fn();
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={onChangeCommitted}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add internal note" }));

    expect(onChangeCommitted).toHaveBeenCalledTimes(1);
  });

  it("LoadTab_whenInternalNotesAreEdited_tracksTheEditorState", () => {
    const onEditorStateChange = vi.fn();
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={vi.fn()}
        onEditorStateChange={onEditorStateChange}
      />,
    );
    onEditorStateChange.mockClear();

    fireEvent.click(
      screen.getByRole("button", { name: "Edit internal note draft" }),
    );

    expect(onEditorStateChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(
      screen.getByRole("button", { name: "Finish internal note draft" }),
    );

    expect(onEditorStateChange).toHaveBeenLastCalledWith(false);
  });
});
