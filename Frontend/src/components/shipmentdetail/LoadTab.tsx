import {
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Button, Input } from "antd";
import { useState } from "react";
import type { ShipmentRecord } from "../../pages/shipmentData";

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
};

const defaultAccessorials = [
  "Accessorial 1",
  "Accessorial 2",
  "Accessorial 3",
  "Accessorial 4",
];

function createShipmentLine(shipment: ShipmentRecord): LoadLine {
  return {
    id: `shipment-load-${shipment.key}`,
    units: String(shipment.pallets),
    packageType: "Pallet",
    weight: shipment.weight.replace(/\s*lbs?\.?$/i, "").trim(),
    length: "48",
    width: "48",
    height: "54",
    freightClass: "85",
    nmfc: "",
    description: "BZMA",
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
  if (!line.length && !line.width && !line.height) return "—";
  return `${line.length || "—"}” × ${line.width || "—"}” × ${line.height || "—"}”`;
}

function LoadLineInputs({
  line,
  onChange,
}: {
  line: LoadLine;
  onChange: (field: keyof LoadLine, value: string) => void;
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
        <Input
          value={line.packageType}
          aria-label='Package'
          onChange={(event) => onChange("packageType", event.target.value)}
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
        <Input
          value={line.freightClass}
          aria-label='Freight class'
          onChange={(event) => onChange("freightClass", event.target.value)}
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

function LoadTab({ shipment }: { shipment: ShipmentRecord }) {
  const [lines, setLines] = useState<LoadLine[]>(() => [
    createShipmentLine(shipment),
  ]);
  const [lineEditor, setLineEditor] = useState<LineEditor | null>(null);
  const [accessorials, setAccessorials] = useState(defaultAccessorials);
  const [accessorialDraft, setAccessorialDraft] = useState<string[] | null>(
    null,
  );

  const beginNewLine = () => {
    if (lineEditor) return;
    setLineEditor({ line: createEmptyLine(), isNew: true });
  };

  const beginEditLine = (line: LoadLine) => {
    setLineEditor({ line: { ...line }, isNew: false });
  };

  const updateLineDraft = (field: keyof LoadLine, value: string) => {
    setLineEditor((current) =>
      current
        ? { ...current, line: { ...current.line, [field]: value } }
        : current,
    );
  };

  const saveLine = () => {
    if (!lineEditor) return;
    if (lineEditor.isNew) {
      setLines((current) => [...current, lineEditor.line]);
    } else {
      setLines((current) =>
        current.map((line) =>
          line.id === lineEditor.line.id ? lineEditor.line : line,
        ),
      );
    }
    setLineEditor(null);
  };

  const beginAccessorialEdit = () => {
    setAccessorialDraft([...accessorials]);
  };

  const updateAccessorial = (index: number, value: string) => {
    setAccessorialDraft((current) =>
      current?.map((item, itemIndex) => (itemIndex === index ? value : item)) ??
      current,
    );
  };

  const saveAccessorials = () => {
    if (!accessorialDraft) return;
    setAccessorials(accessorialDraft);
    setAccessorialDraft(null);
  };

  return (
    <section className='shipment-load-tab' aria-label='Shipment load'>
      <div className='shipment-load-table-wrap'>
        <table className='shipment-load-table'>
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
            {lines.map((line) => {
              const isEditing = lineEditor?.line.id === line.id;
              return (
                <tr key={line.id} className={isEditing ? "is-editing" : ""}>
                  {isEditing && lineEditor ? (
                    <LoadLineInputs
                      line={lineEditor.line}
                      onChange={updateLineDraft}
                    />
                  ) : (
                    <>
                      <td>{line.units || "—"}</td>
                      <td>{line.packageType || "—"}</td>
                      <td>{line.weight ? `${line.weight}lbs` : "—"}</td>
                      <td>{displayDimensions(line)}</td>
                      <td>{line.freightClass || "—"}</td>
                      <td>{line.nmfc || "—"}</td>
                      <td>{line.description || "—"}</td>
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
                      <Button
                        type='text'
                        size='small'
                        icon={<EditOutlined />}
                        disabled={Boolean(lineEditor)}
                        aria-label='Edit load line'
                        title='Edit load line'
                        onClick={() => beginEditLine(line)}
                      />
                    )}
                  </td>
                </tr>
              );
            })}

            <tr className='shipment-load-placeholder-row'>
              {lineEditor?.isNew ? (
                <LoadLineInputs
                  line={lineEditor.line}
                  onChange={updateLineDraft}
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
          {(accessorialDraft ?? accessorials).map((accessorial, index) =>
            accessorialDraft ? (
              <Input
                key={index}
                value={accessorial}
                aria-label={`Accessorial ${index + 1}`}
                onChange={(event) =>
                  updateAccessorial(index, event.target.value)
                }
              />
            ) : (
              <div className='shipment-detail-field' key={index}>
                <span>{`Accessorial ${index + 1}`}</span>
                <strong>{accessorial || "—"}</strong>
              </div>
            ),
          )}
        </div>
      </article>
    </section>
  );
}

export default LoadTab;
