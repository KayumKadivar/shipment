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
      hazmatProperShippingName: string;
      hazmatGroup: string;
      hazmatPhone: string;
      hazmatContactName: string;
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
      nmfc: "123456-12",
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
  hazmatProperShippingName: "",
  hazmatGroup: "",
  hazmatPhone: "",
  hazmatContactName: "",
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
      productWeight: 250, skuNumber: "SKU-42", accountNumber: "ACCOUNT-1", pcf: 4.5,
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
  /** Renders a row editor with observable commit and rate callbacks. */
  function renderEditor(source = shipment) {
    const onValuesChange = vi.fn();
    const onRateInputsChange = vi.fn();
    const onChangeCommitted = vi.fn();
    render(<LoadTab shipment={source} onChangeCommitted={onChangeCommitted}
      onEditorStateChange={vi.fn()} onValuesChange={onValuesChange}
      onRateInputsChange={onRateInputsChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    return { onValuesChange, onRateInputsChange, onChangeCommitted };
  }

  it.each(["", "123456-12", "000001-02"])("LoadTab_WhenNmfcIsValid_%s_AllowsSaving", (nmfc) => {
    const callbacks = renderEditor();
    fireEvent.change(screen.getByLabelText("NMFC"), { target: { value: nmfc } });
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    expect(callbacks.onValuesChange.mock.lastCall?.[0].products[0].nmfc).toBe(nmfc);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each(["12345-12", "123456-1", "12345612", "123456--12", "abcdef-12", "123456-123", " 123456-12", "123456-12 ", " "])(
    "LoadTab_WhenNmfcIsInvalid_%s_BlocksSaving", (nmfc) => {
      const callbacks = renderEditor();
      fireEvent.change(screen.getByLabelText("NMFC"), { target: { value: nmfc } });
      fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
      expect(screen.getByRole("alert").textContent).toContain("six digits");
      expect(callbacks.onValuesChange).not.toHaveBeenCalled();
      expect(callbacks.onChangeCommitted).not.toHaveBeenCalled();
      expect(callbacks.onRateInputsChange).not.toHaveBeenCalled();
    },
  );

  it("LoadTab_WhenNmfcIsBlurredWithInvalidValue_ShowsAccessibleError", () => {
    renderEditor();
    const input = screen.getByLabelText("NMFC");
    fireEvent.change(input, { target: { value: "123" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(input);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  });

  it.each(["123456-12", ""])("LoadTab_WhenNmfcErrorIsCorrectedTo%s_ClearsErrorAndAllowsSave", (nmfc) => {
    const callbacks = renderEditor();
    const input = screen.getByLabelText("NMFC");
    fireEvent.change(input, { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.change(input, { target: { value: nmfc } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    expect(callbacks.onValuesChange.mock.lastCall?.[0].products[0].nmfc).toBe(nmfc);
  });

  it("LoadTab_WhenNewLineNmfcIsInvalid_BlocksSaving", () => {
    const onValuesChange = vi.fn();
    render(<LoadTab shipment={shipment} onChangeCommitted={vi.fn()}
      onEditorStateChange={vi.fn()} onValuesChange={onValuesChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Enter a new load line" }));
    fireEvent.change(screen.getByLabelText("NMFC"), { target: { value: "12345612" } });
    fireEvent.click(screen.getByRole("button", { name: "Save new load line" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(onValuesChange).not.toHaveBeenCalled();
  });

  it("LoadTab_WhenNmfcEditingIsCancelled_DiscardsValueAndValidationState", () => {
    const callbacks = renderEditor();
    fireEvent.change(screen.getByLabelText("NMFC"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel load line editing" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    expect(screen.getByLabelText<HTMLInputElement>("NMFC").value).toBe("123456-12");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(callbacks.onValuesChange).not.toHaveBeenCalled();
  });

  it.each(["Pallet", "Bag", "Carton"])("LoadTab_WhenUnitsAreSavedWith%s_PublishesPalletQuantity", (packageType) => {
    const callbacks = renderEditor({ ...shipment, products: [{ ...shipment.products[0], packageType }] });
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    expect(callbacks.onValuesChange.mock.lastCall?.[0].products[0].pallets).toBe(5);
  });

  it.each(["Pallet", "Bag", "Carton"])("LoadTab_WhenUnitsAreReratedWith%s_UsesPalletQuantity", (packageType) => {
    const callbacks = renderEditor({ ...shipment, products: [{ ...shipment.products[0], packageType }] });
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    expect(callbacks.onRateInputsChange.mock.lastCall?.[0].shipments[0]).toMatchObject({ units: 5, pallets: 5 });
    expect(callbacks.onChangeCommitted).toHaveBeenCalledWith(true);
  });

  it("LoadTab_WhenNewLineUnitsAreSaved_PublishesPalletQuantity", async () => {
    const onValuesChange = vi.fn();
    render(<LoadTab shipment={shipment} onChangeCommitted={vi.fn()}
      onEditorStateChange={vi.fn()} onValuesChange={onValuesChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Enter a new load line" }));
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "5" } });
    fireEvent.mouseDown(screen.getByLabelText("Package"));
    fireEvent.click(await screen.findByRole("option", { name: "Bag" }));
    fireEvent.click(screen.getByRole("button", { name: "Save new load line" }));
    expect(onValuesChange.mock.lastCall?.[0].products[1].pallets).toBe(5);
  });

  it("LoadTab_WhenSavedUnitsAreReopened_DisplaysAcceptedPalletQuantity", () => {
    const callbacks = renderEditor({ ...shipment, products: [{ ...shipment.products[0], packageType: "Bag" }] });
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    const products = callbacks.onValuesChange.mock.lastCall?.[0].products;
    cleanup();
    renderEditor({ ...shipment, products });
    expect(screen.getByLabelText<HTMLInputElement>("Units").value).toBe("5");
  });

  it("LoadTab_WhenUnitsChange_PreservesIndependentPieces", () => {
    const callbacks = renderEditor({ ...shipment, products: [{ ...shipment.products[0], pieces: 8 }] });
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    expect(callbacks.onValuesChange.mock.lastCall?.[0].products[0].pieces).toBe(8);
  });

  it.each([[0, "0"], [null, ""]] as const)("LoadTab_WhenUnitsPalletsAre%s_DoesNotSubstitutePieces", (pallets, expected) => {
    renderEditor({ ...shipment, products: [{ ...shipment.products[0], pallets, pieces: 8 }] });
    expect(screen.getByLabelText<HTMLInputElement>("Units").value).toBe(expected);
  });

  it("LoadTab_WhenUnitsAreMissing_CalculatesDensityWithoutSubstitutingPieces", () => {
    renderEditor({ ...shipment, products: [{ ...shipment.products[0], pallets: null, pieces: 8, pcf: null }] });
    expect(screen.getByLabelText<HTMLInputElement>("PCF/Density").value).toBe("1.80");
  });

  it("LoadTab_WhenPackageChanges_PreservesUnchangedUnits", async () => {
    const callbacks = renderEditor({ ...shipment, products: [{ ...shipment.products[0], pallets: 5 }] });
    fireEvent.mouseDown(screen.getByLabelText("Package"));
    fireEvent.click(await screen.findByRole("option", { name: "Bag" }));
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    expect(callbacks.onValuesChange.mock.lastCall?.[0].products[0].pallets).toBe(5);
  });

  it("LoadTab_WhenPiecesAreSaved_PublishesEditedPiecesAndRequestsRerating", () => {
    const callbacks = renderEditor();
    fireEvent.change(screen.getByLabelText("Pieces"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    expect(callbacks.onValuesChange.mock.lastCall?.[0].products[0].pieces).toBe(8);
    expect(callbacks.onRateInputsChange.mock.lastCall?.[0].shipments[0].pieces).toBe(8);
    expect(callbacks.onChangeCommitted).toHaveBeenCalledWith(true);
  });

  it("LoadTab_WhenStackableIsSaved_PublishesEditedStackableAndRequestsRerating", () => {
    const callbacks = renderEditor();
    fireEvent.click(screen.getByLabelText("Stackable"));
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    expect(callbacks.onValuesChange.mock.lastCall?.[0].products[0].stackable).toBe(true);
    expect(callbacks.onRateInputsChange.mock.lastCall?.[0].shipments[0].stackable).toBe(true);
    expect(callbacks.onChangeCommitted).toHaveBeenCalledWith(true);
  });

  it("LoadTab_WhenUnitsChange_RecalculatesReadOnlyDensity", () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "2" } });
    const density = screen.getByLabelText<HTMLInputElement>("PCF/Density");
    expect(density.value).toBe("0.90");
    expect(density.readOnly).toBe(true);
  });

  it("LoadTab_WhenDensityInputsAreInvalid_PublishesNullDensity", () => {
    const callbacks = renderEditor();
    fireEvent.change(screen.getByLabelText("Length in inches"), { target: { value: "" } });
    expect(screen.getByLabelText<HTMLInputElement>("PCF/Density").value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    expect(callbacks.onValuesChange.mock.lastCall?.[0].products[0].pcf).toBeNull();
  });

  it("LoadTab_WhenOnlyPiecesChange_PreservesSuppliedDensity", () => {
    const callbacks = renderEditor({ ...shipment, products: [{ ...shipment.products[0], pcf: 12.5 }] });
    fireEvent.change(screen.getByLabelText("Pieces"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    expect(callbacks.onValuesChange.mock.lastCall?.[0].products[0].pcf).toBe(12.5);
  });

  it("LoadTab_WhenNewLineIsSaved_PublishesNewProductControls", () => {
    const onValuesChange = vi.fn();
    render(<LoadTab shipment={shipment} onChangeCommitted={vi.fn()}
      onEditorStateChange={vi.fn()} onValuesChange={onValuesChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Enter a new load line" }));
    fireEvent.change(screen.getByLabelText("Pieces"), { target: { value: "8" } });
    fireEvent.click(screen.getByLabelText("Stackable"));
    fireEvent.click(screen.getByLabelText("Hazmat"));
    fireEvent.change(screen.getByLabelText("Hazmat Class"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    fireEvent.click(screen.getByRole("button", { name: "Save new load line" }));
    expect(onValuesChange.mock.lastCall?.[0].products[1]).toMatchObject({
      pieces: 8, stackable: false, hazMat: true, hazmatClass: "3", pcf: null,
    });
  });

  it("LoadTab_WhenNonHazmatProductIsSelected_ClearsPreviousHazmatDetails", async () => {
    reduxMocks.shipmentProductSearch.data = [productSearchResult];
    const callbacks = renderEditor({ ...shipment, products: [{ ...shipment.products[0], hazMat: true,
      hazmatClass: "3", hazmatUnNaNumber: "UN1203", hazmatProperShippingName: "Gasoline",
      hazmatGroup: "II", hazmatPhone: "5551234567", hazmatContact: "Dispatch" }] });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "DO" } });
    await screen.findByRole("option", { name: "DO NOT SHIP" });
    fireEvent.click(screen.getByText("DO NOT SHIP", { selector: "strong" }));
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    expect(callbacks.onValuesChange.mock.lastCall?.[0].products[0]).toMatchObject({
      hazMat: false, hazmatClass: "", hazmatUnNaNumber: "", hazmatProperShippingName: "",
      hazmatGroup: "", hazmatPhone: "", hazmatContact: "", pcf: 9.38,
    });
  });

  const hazmatFields = [
    ["HAZMAT UN/NA#", "hazmatUnNaNumber", "hazMatUN"],
    ["Hazmat Proper Shipping Name", "hazmatProperShippingName", "hazMatProperShippingName"],
    ["Hazmat Class", "hazmatClass", "hazMatClass"],
    ["Hazmat Packing Group", "hazmatGroup", "hazMatPackingGroup"],
    ["Hazmat Phone", "hazmatPhone", "hazMatPhone"],
    ["Hazmat Contact", "hazmatContact", "hazMatContact"],
  ] as const;

  /** Saved shipment values used to verify the six-field popup contract. */
  const savedHazmatProduct = { ...shipment.products[0], hazMat: true,
    hazmatUnNaNumber: "UN : 123", hazmatClass: "2.5",
    hazmatProperShippingName: "Flammable liquid", hazmatGroup: "II",
    hazmatPhone: "(555) 123-4567", hazmatContact: "Emergency desk" };

  it("LoadTab_WithSavedHazmatDetails_PopulatesAllPopupFields", () => {
    renderEditor({ ...shipment, products: [savedHazmatProduct] });
    fireEvent.click(screen.getByRole("button", { name: "Edit Hazmat" }));
    hazmatFields.forEach(([label, field]) => {
      expect(screen.getByLabelText<HTMLInputElement>(label).value).toBe(savedHazmatProduct[field]);
    });
  });

  it("LoadTab_WithSelectedHazmatDetails_PopulatesAllPopupFields", async () => {
    reduxMocks.shipmentProductSearch.data = [{ ...productSearchResult, isHazmat: true,
      hazmatUn: "UN : 123", hazmatClass: "2.5", hazmatProperShippingName: "Flammable liquid",
      hazmatGroup: "II", hazmatPhone: "(555) 123-4567", hazmatContactName: "Emergency desk" }];
    renderEditor({ ...shipment, products: [{ ...savedHazmatProduct,
      hazmatProperShippingName: "Old name", hazmatGroup: "I",
      hazmatPhone: "(555) 999-9999", hazmatContact: "Old contact" }] });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "DO" } });
    fireEvent.click(await screen.findByText("DO NOT SHIP", { selector: "strong" }));
    expect(screen.getByLabelText("Package").closest(".ant-select")?.textContent).toContain("Carton");
    fireEvent.click(screen.getByRole("button", { name: "Edit Hazmat" }));
    hazmatFields.forEach(([label, field]) => {
      expect(screen.getByLabelText<HTMLInputElement>(label).value).toBe(savedHazmatProduct[field]);
    });
  });

  it("LoadTab_WithSavedHazmatDetails_RetainsAcceptedValuesAfterRemount", () => {
    const callbacks = renderEditor({ ...shipment, products: [savedHazmatProduct] });
    fireEvent.click(screen.getByRole("button", { name: "Edit Hazmat" }));
    fireEvent.change(screen.getByLabelText("Hazmat Contact"), { target: { value: "Updated desk" } });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    const products = callbacks.onValuesChange.mock.lastCall?.[0].products;
    cleanup();
    renderEditor({ ...shipment, products });
    fireEvent.click(screen.getByRole("button", { name: "Edit Hazmat" }));
    hazmatFields.forEach(([label, field]) => {
      expect(screen.getByLabelText<HTMLInputElement>(label).value)
        .toBe(field === "hazmatContact" ? "Updated desk" : savedHazmatProduct[field]);
    });
  });

  it.each(hazmatFields)("LoadTab_When%sIsSaved_PublishesDetailAndRequestsRerating", (label, productField, rateField) => {
    const callbacks = renderEditor({ ...shipment, products: [{ ...shipment.products[0], hazMat: true }] });
    fireEvent.click(screen.getByRole("button", { name: "Edit Hazmat" }));
    const value = label === "Hazmat Phone" ? "(555) 123-4567" : "Updated";
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(callbacks.onValuesChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    expect(callbacks.onValuesChange.mock.lastCall?.[0].products[0][productField]).toBe(value);
    expect(callbacks.onRateInputsChange.mock.lastCall?.[0].shipments[0][rateField]).toBe(value);
    expect(callbacks.onChangeCommitted).toHaveBeenCalledWith(true);
  });

  it("LoadTab_WhenHazmatPopupIsCancelled_PreservesPreviousDetails", () => {
    renderEditor({ ...shipment, products: [{ ...shipment.products[0], hazMat: true, hazmatClass: "3" }] });
    fireEvent.click(screen.getByRole("button", { name: "Edit Hazmat" }));
    fireEvent.change(screen.getByLabelText("Hazmat Class"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Hazmat" }));
    expect(screen.getByLabelText<HTMLInputElement>("Hazmat Class").value).toBe("3");
  });

  it("LoadTab_WhenHazmatIsEnabled_ClearsStackableAndRequestsRerating", () => {
    const callbacks = renderEditor({ ...shipment, products: [{ ...shipment.products[0], stackable: true }] });
    fireEvent.click(screen.getByLabelText("Hazmat"));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByLabelText<HTMLInputElement>("Stackable").checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    expect(callbacks.onValuesChange.mock.lastCall?.[0].products[0].hazMat).toBe(true);
    expect(callbacks.onChangeCommitted).toHaveBeenCalledWith(true);
  });

  it("LoadTab_WhenHazmatIsDisabled_ClearsAllHazmatDetails", () => {
    const callbacks = renderEditor({ ...shipment, products: [{ ...shipment.products[0], hazMat: true,
      hazmatClass: "3", hazmatUnNaNumber: "UN1203", hazmatProperShippingName: "Gasoline",
      hazmatGroup: "II", hazmatPhone: "5551234567", hazmatContact: "Dispatch" }] });
    fireEvent.click(screen.getByLabelText("Hazmat"));
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));
    const product = callbacks.onValuesChange.mock.lastCall?.[0].products[0];
    expect(product.hazMat).toBe(false);
    hazmatFields.forEach(([, field]) => expect(product[field]).toBe(""));
  });

  it("LoadTab_WhenRowEditingIsCancelled_DiscardsNewFieldChanges", () => {
    const callbacks = renderEditor();
    fireEvent.change(screen.getByLabelText("Pieces"), { target: { value: "8" } });
    fireEvent.click(screen.getByLabelText("Stackable"));
    fireEvent.click(screen.getByLabelText("Hazmat"));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel load line editing" }));
    expect(callbacks.onValuesChange).not.toHaveBeenCalled();
    expect(callbacks.onChangeCommitted).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn() })));
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
    ["NMFC", "678901-23"],
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
