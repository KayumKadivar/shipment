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
  accessorials: {
    data: [
      {
        accessorialID: 1,
        accessorialName: "Liftgate",
        status: true,
      },
      {
        accessorialID: 2,
        accessorialName: "Inside delivery",
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
}));

vi.mock("../../app/hooks", () => ({
  useAppDispatch: () => reduxMocks.dispatch,
  useAppSelector: (
    selector: (state: {
      accessorials: typeof reduxMocks.accessorials;
      packageTypes: typeof reduxMocks.packageTypes;
    }) => unknown,
  ) =>
    selector({
      accessorials: reduxMocks.accessorials,
      packageTypes: reduxMocks.packageTypes,
    }),
}));

vi.mock("../../store/accessorialsSlice", () => ({
  fetchAccessorials: reduxMocks.fetchAccessorials,
}));

vi.mock("../../store/packageTypesSlice", () => ({
  fetchPackageTypes: reduxMocks.fetchPackageTypes,
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
  buyRate: null,
  sellRate: null,
} as ShipmentDetails;

describe("LoadTab", () => {
  beforeEach(() => {
    reduxMocks.dispatch.mockReset();
    reduxMocks.fetchAccessorials.mockClear();
    reduxMocks.fetchPackageTypes.mockClear();
    reduxMocks.accessorials.data.splice(
      0,
      reduxMocks.accessorials.data.length,
      {
        accessorialID: 1,
        accessorialName: "Liftgate",
        status: true,
      },
      {
        accessorialID: 2,
        accessorialName: "Inside delivery",
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
    vi.unstubAllGlobals();
  });

  it("LoadTab_whenChangedLineIsAccepted_notifiesTheParent", () => {
    const onChangeCommitted = vi.fn();
    render(
      <LoadTab
        shipment={shipment}
        onChangeCommitted={onChangeCommitted}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit load line" }));
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Updated freight" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save load line" }));

    expect(onChangeCommitted).toHaveBeenCalledTimes(1);
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
    expect(onChangeCommitted).toHaveBeenCalledTimes(1);
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
    expect(onChangeCommitted).toHaveBeenCalledTimes(1);
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
    expect(onChangeCommitted).toHaveBeenCalledTimes(1);
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
    expect(onChangeCommitted).toHaveBeenCalledTimes(1);
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
});
