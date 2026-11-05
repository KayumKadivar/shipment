import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { AutoComplete, Button, Input, Popconfirm, Select } from "antd";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { fetchAccessorials } from "../../store/accessorialsSlice";
import { fetchPackageTypes } from "../../store/packageTypesSlice";
import {
  clearShipmentProductSearch,
  searchShipmentProducts,
  type ShipmentProductSearchResult,
} from "../../store/shipmentProductSearchSlice";
import type {
  ShipmentDetails,
  ShipmentProduct,
  ShipmentRerateLoadValues,
  ShipmentRerateProduct,
} from "../../types/shipment.types";
import LoadInternalNotes from "./LoadInternalNotes";
import { createShipmentAccessorialLabels } from "./shipmentAccessorials";

type LoadLine = {
  id: string;
  units: string;
  packageType: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  freightClass: string;
  nmfc: string;
  description: string;
  hazMat: boolean;
  hazMatClass: string;
  hazMatUN: string;
  hazMatProperShippingName: string;
  hazMatPackingGroup: string;
  hazMatPhone: string;
  hazMatContact: string;
  pieces: number;
  linearFeet: number;
  stackable: boolean;
};

type LineEditor = {
  line: LoadLine;
  isNew: boolean;
  packageTypeWasEdited: boolean;
};

type PackageTypeOption = {
  value: string;
  label: string;
};

type ProductOption = {
  key: string;
  value: string;
  label: ReactNode;
  product: ShipmentProductSearchResult;
};

type AccessorialDraftLine = {
  value: string;
  selectedValue: string | null;
};

type AccessorialOption = {
  value: string;
  label: string;
};

type LoadTabProps = {
  shipment: ShipmentDetails;
  onChangeCommitted: (requiresRerate?: boolean) => void;
  onEditorStateChange: (isEditing: boolean) => void;
  onRateInputsChange?: (values: ShipmentRerateLoadValues) => void;
};

const RerateLoadLineFields: ReadonlyArray<keyof LoadLine> = [
  "units",
  "weight",
  "length",
  "width",
  "height",
  "freightClass",
];

const FREIGHT_CLASS_OPTIONS = [
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
].map((value) => ({ value, label: value }));

function numberText(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function createShipmentLine(
  shipment: ShipmentDetails,
  product: ShipmentProduct,
  index: number,
): LoadLine {
  return {
    id: `shipment-load-${shipment.loadNumber}-${index}`,
    units: numberText(product.pallets ?? product.pieces),
    packageType: product.packageType ?? "",
    weight: numberText(product.productWeight),
    length: numberText(product.length),
    width: numberText(product.width),
    height: numberText(product.height),
    freightClass: product.productClass ?? "",
    nmfc: product.nmfc ?? "",
    description: product.productDescription ?? "",
    hazMat: product.hazMat,
    hazMatClass: product.hazmatClass ?? "",
    hazMatUN: product.hazmatUnNaNumber ?? "",
    hazMatProperShippingName: product.hazmatProperShippingName ?? "",
    hazMatPackingGroup: product.hazmatGroup ?? "",
    hazMatPhone: product.hazmatPhone ?? "",
    hazMatContact: product.hazmatContact ?? "",
    pieces: product.pieces ?? 1,
    linearFeet: product.linearFeet ?? 0,
    stackable: product.stackable ?? false,
  };
}

function createEmptyLine(): LoadLine {
  return {
    id: `load-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    units: "",
    packageType: "",
    weight: "",
    length: "",
    width: "",
    height: "",
    freightClass: "",
    nmfc: "",
    description: "",
    hazMat: false,
    hazMatClass: "",
    hazMatUN: "",
    hazMatProperShippingName: "",
    hazMatPackingGroup: "",
    hazMatPhone: "",
    hazMatContact: "",
    pieces: 1,
    linearFeet: 0,
    stackable: false,
  };
}

function numericValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createRerateProduct(line: LoadLine): ShipmentRerateProduct {
  const units = numericValue(line.units);

  return {
    class: line.freightClass.trim(),
    weight: numericValue(line.weight),
    weightUnit: "Lbs",
    units,
    cubicFeet: 0,
    hazMat: line.hazMat,
    hazMatClass: line.hazMatClass.trim() || undefined,
    hazMatUN: line.hazMatUN.trim() || undefined,
    hazMatProperShippingName:
      line.hazMatProperShippingName.trim() || undefined,
    hazMatPackingGroup: line.hazMatPackingGroup.trim() || undefined,
    hazMatPhone: line.hazMatPhone.trim() || undefined,
    hazMatContact: line.hazMatContact.trim() || undefined,
    nmfc: line.nmfc.trim() || undefined,
    description: line.description.trim() || undefined,
    pallets:
      line.packageType.trim().toLocaleLowerCase() === "pallet" ? units : 0,
    pieces: line.pieces,
    length: numericValue(line.length),
    width: numericValue(line.width),
    height: numericValue(line.height),
    packageType: line.packageType.trim() || undefined,
    linearFeet: line.linearFeet,
    stackable: line.stackable,
  };
}

function resolveAccessorialCodes(
  labels: string[],
  shipment: ShipmentDetails,
  options: Array<{ accessorialName: string; accesorialCode?: string }>,
) {
  const details = [
    ...(shipment.buyRate?.accesorialCostDetails ?? []),
    ...(shipment.sellRate?.accesorialCostDetails ?? []),
  ];

  return [...new Set(labels.map((label) => {
    const normalizedLabel = label.trim().toLocaleLowerCase();
    const option = options.find(
      (item) =>
        item.accessorialName.trim().toLocaleLowerCase() === normalizedLabel,
    );
    const detail = details.find((item) =>
      [item.accCode, item.description].some(
        (candidate) => candidate?.trim().toLocaleLowerCase() === normalizedLabel,
      ),
    );

    return option?.accesorialCode?.trim() || detail?.accCode?.trim() || label.trim();
  }).filter(Boolean))];
}

function displayDimensions(line: LoadLine) {
  if (!line.length && !line.width && !line.height) return "";
  return `${line.length || ""}” × ${line.width || ""}” × ${line.height || ""}”`;
}

function loadLinesAreEqual(first: LoadLine, second: LoadLine) {
  return (Object.keys(first) as Array<keyof LoadLine>).every(
    (field) => first[field] === second[field],
  );
}

function LoadLineInputs({
  line,
  onChange,
  onProductSearch,
  onProductSelect,
  productOptions,
  productSearchLoading,
  productSearchError,
  packageTypeOptions,
  packageTypesLoading,
  packageTypesError,
}: {
  line: LoadLine;
  onChange: (field: keyof LoadLine, value: string) => void;
  onProductSearch: (value: string) => void;
  onProductSelect: (product: ShipmentProductSearchResult) => void;
  productOptions: ProductOption[];
  productSearchLoading: boolean;
  productSearchError: string | null;
  packageTypeOptions: PackageTypeOption[];
  packageTypesLoading: boolean;
  packageTypesError: string | null;
}) {
  return (
    <>
      <td>
        <AutoComplete<string, ProductOption>
          value={line.description}
          aria-label='Description'
          options={productOptions}
          filterOption={false}
          defaultActiveFirstOption
          notFoundContent={
            productSearchError ||
            (productSearchLoading
              ? "Searching products..."
              : "No products found")
          }
          onChange={(value) => onChange("description", value)}
          onSearch={onProductSearch}
          onSelect={(_, option) => onProductSelect(option.product)}
        />
      </td>
      <td>
        <Input
          value={line.units}
          aria-label='Units'
          onChange={(event) => onChange("units", event.target.value)}
        />
      </td>
      <td>
        <Select
          value={line.packageType || undefined}
          aria-label='Package'
          placeholder='-- Select --'
          allowClear
          options={packageTypeOptions}
          loading={packageTypesLoading}
          virtual={false}
          notFoundContent={
            packageTypesError ||
            (packageTypesLoading
              ? "Loading package types..."
              : "No package types found")
          }
          onChange={(value) => onChange("packageType", value ?? "")}
        />
      </td>
      <td>
        <Input
          value={line.weight}
          aria-label='Weight in pounds'
          onChange={(event) => onChange("weight", event.target.value)}
        />
      </td>
      <td>
        <div className='shipment-load-dimensions'>
          <Input
            value={line.length}
            placeholder='L'
            aria-label='Length in inches'
            onChange={(event) => onChange("length", event.target.value)}
          />
          <span>×</span>
          <Input
            value={line.width}
            placeholder='W'
            aria-label='Width in inches'
            onChange={(event) => onChange("width", event.target.value)}
          />
          <span>×</span>
          <Input
            value={line.height}
            placeholder='H'
            aria-label='Height in inches'
            onChange={(event) => onChange("height", event.target.value)}
          />
        </div>
      </td>
      <td>
        <Select
          value={line.freightClass || undefined}
          aria-label='Freight class'
          placeholder='-- Select --'
          allowClear
          options={FREIGHT_CLASS_OPTIONS}
          virtual={false}
          onChange={(value) => onChange("freightClass", value ?? "")}
        />
      </td>
      <td>
        <Input
          value={line.nmfc}
          aria-label='NMFC'
          onChange={(event) => onChange("nmfc", event.target.value)}
        />
      </td>
    </>
  );
}

function LoadTab({
  shipment,
  onChangeCommitted,
  onEditorStateChange,
  onRateInputsChange,
}: LoadTabProps) {
  const dispatch = useAppDispatch();
  const {
    data: packageTypes,
    loading: packageTypesLoading,
    error: packageTypesError,
  } = useAppSelector((state) => state.packageTypes);
  const {
    data: accessorialOptionsSource,
    loading: accessorialsLoading,
    error: accessorialsError,
  } = useAppSelector((state) => state.accessorials);
  const {
    data: productSearchResults,
    loading: productSearchLoading,
    error: productSearchError,
  } = useAppSelector((state) => state.shipmentProductSearch);
  const [lines, setLines] = useState<LoadLine[]>(() =>
    shipment.products.map((product, index) =>
      createShipmentLine(shipment, product, index),
    ),
  );
  const [lineEditor, setLineEditor] = useState<LineEditor | null>(null);
  const [accessorials, setAccessorials] = useState(() =>
    createShipmentAccessorialLabels(shipment),
  );
  const [accessorialDraft, setAccessorialDraft] = useState<
    AccessorialDraftLine[] | null
  >(null);
  const [internalNotesEditing, setInternalNotesEditing] = useState(false);
  const [accessorialLookupRequested, setAccessorialLookupRequested] =
    useState(false);
  const productSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const activeProductSearchRef = useRef<{ abort: () => void } | null>(null);
  const packageTypeOptions = useMemo<PackageTypeOption[]>(
    () =>
      packageTypes
        .map((item) => ({
          value: item.packageType,
          label: item.packageType,
        }))
        .sort((first, second) =>
          first.label.localeCompare(second.label, "en", {
            sensitivity: "base",
          }),
        ),
    [packageTypes],
  );
  const defaultPackageType = useMemo(
    () =>
      packageTypeOptions.find(
        (option) =>
          option.value.localeCompare("Pallet", "en", {
            sensitivity: "base",
          }) === 0,
      )?.value ?? "",
    [packageTypeOptions],
  );
  const productOptions = useMemo<ProductOption[]>(
    () =>
      productSearchResults.map((product, index) => ({
        key: `shipment-product-${product.productId}-${index}`,
        value: product.description,
        product,
        label: (
          <div className='shipment-load-product-option'>
            <strong>{product.description || "Unnamed product"}</strong>
            <span>
              {`Packaging group: ${product.packageType || "—"} | Class: ${product.freightClass || "—"}`}
            </span>
          </div>
        ),
      })),
    [productSearchResults],
  );
  const lineEditorLine =
    lineEditor &&
    !lineEditor.packageTypeWasEdited &&
    !lineEditor.line.packageType &&
    defaultPackageType
      ? { ...lineEditor.line, packageType: defaultPackageType }
      : lineEditor?.line;

  useEffect(() => {
    dispatch(fetchPackageTypes());
  }, [dispatch]);

  const resetProductSearch = useCallback(() => {
    if (productSearchTimerRef.current) {
      clearTimeout(productSearchTimerRef.current);
      productSearchTimerRef.current = null;
    }
    activeProductSearchRef.current?.abort();
    activeProductSearchRef.current = null;
    dispatch(clearShipmentProductSearch());
  }, [dispatch]);

  useEffect(() => () => resetProductSearch(), [resetProductSearch]);

  useEffect(() => {
    onEditorStateChange(
      Boolean(lineEditor || accessorialDraft || internalNotesEditing),
    );
  }, [accessorialDraft, internalNotesEditing, lineEditor, onEditorStateChange]);

  const beginNewLine = () => {
    if (lineEditor) return;
    resetProductSearch();
    setLineEditor({
      line: { ...createEmptyLine(), packageType: defaultPackageType },
      isNew: true,
      packageTypeWasEdited: false,
    });
  };

  const beginEditLine = (line: LoadLine) => {
    resetProductSearch();
    setLineEditor({
      line: {
        ...line,
        packageType: line.packageType || defaultPackageType,
      },
      isNew: false,
      packageTypeWasEdited: false,
    });
  };

  const updateLineDraft = (field: keyof LoadLine, value: string) => {
    setLineEditor((current) =>
      current
        ? {
            ...current,
            line: { ...current.line, [field]: value },
            packageTypeWasEdited:
              current.packageTypeWasEdited || field === "packageType",
          }
        : current,
    );
  };

  const requestProductSearch = (value: string) => {
    resetProductSearch();
    const searchText = value.trim();
    if (searchText.length < 2) return;

    productSearchTimerRef.current = setTimeout(() => {
      productSearchTimerRef.current = null;
      activeProductSearchRef.current = dispatch(
        searchShipmentProducts({
          clientCode: shipment.clientCode?.trim() || "",
          searchText,
        }),
      );
    }, 350);
  };

  const selectProduct = (product: ShipmentProductSearchResult) => {
    resetProductSearch();
    setLineEditor((current) =>
      current
        ? {
            ...current,
            line: {
              ...current.line,
              description: product.description,
              units: numberText(product.pallets),
              packageType: product.packageType,
              weight: numberText(product.weight),
              length: numberText(product.length),
              width: numberText(product.width),
              height: numberText(product.height),
              freightClass: product.freightClass,
              nmfc: product.nmfc,
              hazMat: product.isHazmat,
              hazMatClass: product.hazmatClass,
              hazMatUN: product.hazmatUn,
            },
            packageTypeWasEdited: true,
          }
        : current,
    );
  };

  const cancelLineEditing = () => {
    resetProductSearch();
    setLineEditor(null);
  };

  const saveLine = () => {
    if (!lineEditor || !lineEditorLine) return;
    const existingLine = lines.find((line) => line.id === lineEditorLine.id);
    const hasChanges =
      lineEditor.isNew ||
      !existingLine ||
      !loadLinesAreEqual(existingLine, lineEditorLine);
    const requiresRerate =
      lineEditor.isNew ||
      !existingLine ||
      RerateLoadLineFields.some(
        (field) => existingLine[field] !== lineEditorLine[field],
      );

    const nextLines = lineEditor.isNew
      ? [...lines, lineEditorLine]
      : lines.map((line) =>
          line.id === lineEditorLine.id ? lineEditorLine : line,
        );
    setLines(nextLines);
    resetProductSearch();
    setLineEditor(null);
    if (hasChanges) {
      onRateInputsChange?.({
        shipments: nextLines.map(createRerateProduct),
        accessorialCodes: resolveAccessorialCodes(
          accessorials,
          shipment,
          accessorialOptionsSource,
        ),
      });
      onChangeCommitted(requiresRerate);
    }
  };

  const deleteLine = (id: string) => {
    const nextLines = lines.filter((line) => line.id !== id);
    setLines(nextLines);
    onRateInputsChange?.({
      shipments: nextLines.map(createRerateProduct),
      accessorialCodes: resolveAccessorialCodes(
        accessorials,
        shipment,
        accessorialOptionsSource,
      ),
    });
    onChangeCommitted(true);
  };

  const beginAccessorialEdit = () => {
    setAccessorialDraft(
      accessorials.map((value) => ({ value, selectedValue: value })),
    );
    setAccessorialLookupRequested(false);
  };

  const updateAccessorial = (index: number, value: string) => {
    setAccessorialDraft((current) =>
      current?.map((item, itemIndex) =>
        itemIndex === index
          ? {
              value,
              selectedValue:
                item.selectedValue === value ? item.selectedValue : null,
            }
          : item,
      ) ?? current,
    );
  };

  const requestAccessorialLookup = (query: string) => {
    if (!query.trim() || accessorialLookupRequested) return;

    setAccessorialLookupRequested(true);
    dispatch(fetchAccessorials(shipment.clientCode ?? undefined));
  };

  const selectAccessorial = (index: number, value: string) => {
    setAccessorialDraft((current) =>
      current?.map((item, itemIndex) =>
        itemIndex === index ? { value, selectedValue: value } : item,
      ) ?? current,
    );
  };

  const createAccessorialOptions = (query: string): AccessorialOption[] => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery || accessorialsLoading || accessorialsError) return [];

    return accessorialOptionsSource
      .filter(
        (item) =>
          item.status !== false &&
          item.accessorialName.trim().length > 0 &&
          item.accessorialName
            .toLocaleLowerCase()
            .includes(normalizedQuery),
      )
      .map((item) => ({
        value: item.accessorialName,
        label: item.accessorialName,
      }));
  };

  const addAccessorial = () => {
    setAccessorialDraft((current) =>
      current ? [...current, { value: "", selectedValue: null }] : current,
    );
  };

  const deleteAccessorial = (index: number) => {
    setAccessorialDraft((current) =>
      current?.filter((_, itemIndex) => itemIndex !== index) ?? current,
    );
  };

  const saveAccessorials = () => {
    if (!accessorialDraft) return;
    if (
      accessorialDraft.some(
        (accessorial) =>
          accessorial.selectedValue !== accessorial.value ||
          !accessorial.value.trim(),
      )
    ) {
      return;
    }

    const nextAccessorials = accessorialDraft.map(
      (accessorial) => accessorial.value,
    );
    const hasChanges =
      nextAccessorials.length !== accessorials.length ||
      nextAccessorials.some(
        (accessorial, index) => accessorial !== accessorials[index],
      );

    setAccessorials(nextAccessorials);
    setAccessorialDraft(null);
    if (hasChanges) {
      onRateInputsChange?.({
        shipments: lines.map(createRerateProduct),
        accessorialCodes: resolveAccessorialCodes(
          nextAccessorials,
          shipment,
          accessorialOptionsSource,
        ),
      });
      onChangeCommitted(true);
    }
  };

  const accessorialSaveDisabled =
    accessorialDraft?.some(
      (accessorial) =>
        accessorial.selectedValue !== accessorial.value ||
        !accessorial.value.trim(),
    ) ?? false;

  return (
    <section className='shipment-load-tab' aria-label='Shipment load'>
      <div className='shipment-load-table-wrap'>
        <table
          className={`shipment-load-table${lineEditor ? " is-editing" : ""}`}>
          <thead>
            <tr>
              <th>Description</th>
              <th>Units</th>
              <th>Package</th>
              <th>Weight</th>
              <th>Dimensions</th>
              <th>Class</th>
              <th>NMFC</th>
              <th aria-label='Actions' />
            </tr>
          </thead>
          <tbody>
            {!lines.length && !lineEditor?.isNew ? (
              <tr>
                <td colSpan={8}>No load products were returned.</td>
              </tr>
            ) : null}
            {lines.map((line) => {
              const isEditing = lineEditor?.line.id === line.id;
              return (
                <tr key={line.id} className={isEditing ? "is-editing" : ""}>
                  {isEditing && lineEditor ? (
                    <LoadLineInputs
                      line={lineEditorLine ?? lineEditor.line}
                      onChange={updateLineDraft}
                      onProductSearch={requestProductSearch}
                      onProductSelect={selectProduct}
                      productOptions={productOptions}
                      productSearchLoading={productSearchLoading}
                      productSearchError={productSearchError}
                      packageTypeOptions={packageTypeOptions}
                      packageTypesLoading={packageTypesLoading}
                      packageTypesError={packageTypesError}
                    />
                  ) : (
                    <>
                      <td>{line.description}</td>
                      <td>{line.units}</td>
                      <td>{line.packageType}</td>
                      <td>{line.weight ? `${line.weight}lbs` : ""}</td>
                      <td>{displayDimensions(line)}</td>
                      <td>{line.freightClass}</td>
                      <td>{line.nmfc}</td>
                    </>
                  )}
                  <td className='shipment-load-actions'>
                    {isEditing ? (
                      <>
                        <Button
                          type='text'
                          size='small'
                          icon={<CheckOutlined />}
                          aria-label='Save load line'
                          title='Save'
                          onClick={saveLine}
                        />
                        <Button
                          type='text'
                          size='small'
                          icon={<CloseOutlined />}
                          aria-label='Cancel load line editing'
                          title='Cancel'
                          onClick={cancelLineEditing}
                        />
                      </>
                    ) : (
                      <>
                        <Button
                          type='text'
                          size='small'
                          icon={<EditOutlined />}
                          disabled={Boolean(lineEditor)}
                          aria-label='Edit load line'
                          title='Edit load line'
                          onClick={() => beginEditLine(line)}
                        />
                        <Popconfirm
                          title='Delete load line?'
                          description='This removes the line from this shipment.'
                          okText='Delete'
                          cancelText='Cancel'
                          okButtonProps={{ danger: true }}
                          onConfirm={() => deleteLine(line.id)}>
                          <Button
                            type='text'
                            size='small'
                            danger
                            icon={<DeleteOutlined />}
                            disabled={Boolean(lineEditor)}
                            aria-label='Delete load line'
                            title='Delete load line'
                          />
                        </Popconfirm>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}

            <tr className='shipment-load-placeholder-row'>
              {lineEditor?.isNew ? (
                <LoadLineInputs
                  line={lineEditorLine ?? lineEditor.line}
                  onChange={updateLineDraft}
                  onProductSearch={requestProductSearch}
                  onProductSelect={selectProduct}
                  productOptions={productOptions}
                  productSearchLoading={productSearchLoading}
                  productSearchError={productSearchError}
                  packageTypeOptions={packageTypeOptions}
                  packageTypesLoading={packageTypesLoading}
                  packageTypesError={packageTypesError}
                />
              ) : (
                <>
                  {Array.from({ length: 7 }, (_, index) => (
                    <td key={index}>
                      <span aria-hidden='true' />
                    </td>
                  ))}
                </>
              )}
              <td className='shipment-load-actions'>
                {lineEditor?.isNew ? (
                  <>
                    <Button
                      type='text'
                      size='small'
                      icon={<CheckOutlined />}
                      aria-label='Save new load line'
                      title='Save'
                      onClick={saveLine}
                    />
                    <Button
                      type='text'
                      size='small'
                      icon={<CloseOutlined />}
                      aria-label='Cancel new load line'
                      title='Cancel'
                      onClick={cancelLineEditing}
                    />
                  </>
                ) : (
                  <Button
                    type='text'
                    size='small'
                    icon={<EditOutlined />}
                    disabled={Boolean(lineEditor)}
                    aria-label='Enter a new load line'
                    title='Enter a new load line'
                    onClick={beginNewLine}
                  />
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className='shipment-load-add-line'>
        <Button
          type='text'
          icon={<PlusOutlined />}
          disabled={Boolean(lineEditor)}
          onClick={beginNewLine}>
          Add Line
        </Button>
      </div>

      <div className='shipment-load-support-grid'>
        <article className='shipment-load-accessorials'>
          <header>
            <h2>Accessorials</h2>
            <div className='shipment-load-accessorial-actions'>
              {accessorialDraft ? (
                <>
                  <Button
                    type='text'
                    size='small'
                    icon={<CheckOutlined />}
                    aria-label='Save accessorials'
                    title='Save'
                    disabled={accessorialSaveDisabled}
                    onClick={saveAccessorials}
                  />
                  <Button
                    type='text'
                    size='small'
                    icon={<CloseOutlined />}
                    aria-label='Cancel accessorial editing'
                    title='Cancel'
                    onClick={() => setAccessorialDraft(null)}
                  />
                </>
              ) : (
                <Button
                  type='text'
                  size='small'
                  icon={<EditOutlined />}
                  aria-label='Edit accessorials'
                  title='Edit accessorials'
                  onClick={beginAccessorialEdit}
                />
              )}
            </div>
          </header>

          <div className='shipment-load-accessorial-list'>
            {!accessorials.length && !accessorialDraft ? (
              <span>No accessorials were returned.</span>
            ) : null}
            {accessorialDraft
              ? accessorialDraft.map((accessorial, index) => (
                <div className='shipment-load-accessorial-edit-row' key={index}>
                  <AutoComplete<string, AccessorialOption>
                    value={accessorial.value}
                    aria-label={`Accessorial ${index + 1}`}
                    options={createAccessorialOptions(accessorial.value)}
                    filterOption={false}
                    defaultActiveFirstOption
                    notFoundContent={
                      accessorialsError ||
                      (accessorialsLoading
                        ? "Loading accessorials..."
                        : "No accessorials found")
                    }
                    onChange={(value) => updateAccessorial(index, value)}
                    onSearch={requestAccessorialLookup}
                    onSelect={(value) => selectAccessorial(index, value)}
                  />
                  <Popconfirm
                    title='Delete accessorial?'
                    description='This removes the accessorial from the draft.'
                    okText='Delete'
                    cancelText='Cancel'
                    okButtonProps={{ danger: true }}
                    onConfirm={() => deleteAccessorial(index)}>
                    <Button
                      type='text'
                      size='small'
                      danger
                      icon={<DeleteOutlined />}
                      aria-label={`Delete accessorial ${index + 1}`}
                      title='Delete accessorial'
                    />
                  </Popconfirm>
                </div>
              ))
              : accessorials.map((accessorial, index) => (
                <div className='shipment-detail-field' key={index}>
                  <span>{`Accessorial ${index + 1}`}</span>
                  <strong>{accessorial}</strong>
                </div>
              ))}
          </div>

          {accessorialDraft ? (
            <div className='shipment-load-accessorial-add-line'>
              <Button
                type='text'
                icon={<PlusOutlined />}
                aria-label='Add accessorial line'
                onClick={addAccessorial}>
                Add Line
              </Button>
            </div>
          ) : null}
        </article>

        <LoadInternalNotes
          initialNotes={shipment.bolDispatchNotes}
          onNoteAdded={() => onChangeCommitted()}
          onEditorStateChange={setInternalNotesEditing}
        />
      </div>
    </section>
  );
}

export default LoadTab;
