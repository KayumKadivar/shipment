import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { AutoComplete, Button, Input, Popconfirm, Select } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { fetchAccessorials } from "../../store/accessorialsSlice";
import { fetchPackageTypes } from "../../store/packageTypesSlice";
import type {
  ShipmentDetails,
  ShipmentProduct,
} from "../../types/shipment.types";
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
  onChangeCommitted: () => void;
  onEditorStateChange: (isEditing: boolean) => void;
};

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
  };
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
  packageTypeOptions,
  packageTypesLoading,
  packageTypesError,
}: {
  line: LoadLine;
  onChange: (field: keyof LoadLine, value: string) => void;
  packageTypeOptions: PackageTypeOption[];
  packageTypesLoading: boolean;
  packageTypesError: string | null;
}) {
  return (
    <>
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
      <td>
        <Input
          value={line.description}
          aria-label='Description'
          onChange={(event) => onChange("description", event.target.value)}
        />
      </td>
    </>
  );
}

function LoadTab({
  shipment,
  onChangeCommitted,
  onEditorStateChange,
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
  const [accessorialLookupRequested, setAccessorialLookupRequested] =
    useState(false);
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

  useEffect(() => {
    onEditorStateChange(Boolean(lineEditor || accessorialDraft));
  }, [accessorialDraft, lineEditor, onEditorStateChange]);

  const beginNewLine = () => {
    if (lineEditor) return;
    setLineEditor({
      line: { ...createEmptyLine(), packageType: defaultPackageType },
      isNew: true,
      packageTypeWasEdited: false,
    });
  };

  const beginEditLine = (line: LoadLine) => {
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

  const saveLine = () => {
    if (!lineEditor || !lineEditorLine) return;
    const hasChanges =
      lineEditor.isNew ||
      !lines.some(
        (line) =>
          line.id === lineEditorLine.id &&
          loadLinesAreEqual(line, lineEditorLine),
      );

    if (lineEditor.isNew) {
      setLines((current) => [...current, lineEditorLine]);
    } else {
      setLines((current) =>
        current.map((line) =>
          line.id === lineEditorLine.id ? lineEditorLine : line,
        ),
      );
    }
    setLineEditor(null);
    if (hasChanges) onChangeCommitted();
  };

  const deleteLine = (id: string) => {
    setLines((current) => current.filter((line) => line.id !== id));
    onChangeCommitted();
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
    if (hasChanges) onChangeCommitted();
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
              <th>Units</th>
              <th>Package</th>
              <th>Weight</th>
              <th>Dimensions</th>
              <th>Class</th>
              <th>NMFC</th>
              <th>Description</th>
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
                      packageTypeOptions={packageTypeOptions}
                      packageTypesLoading={packageTypesLoading}
                      packageTypesError={packageTypesError}
                    />
                  ) : (
                    <>
                      <td>{line.units}</td>
                      <td>{line.packageType}</td>
                      <td>{line.weight ? `${line.weight}lbs` : ""}</td>
                      <td>{displayDimensions(line)}</td>
                      <td>{line.freightClass}</td>
                      <td>{line.nmfc}</td>
                      <td>{line.description}</td>
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
                          onClick={() => setLineEditor(null)}
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
                      onClick={() => setLineEditor(null)}
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
    </section>
  );
}

export default LoadTab;
