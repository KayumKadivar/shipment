import { ClockCircleOutlined, TruckOutlined } from "@ant-design/icons";
import { Button, Checkbox, Empty, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ShipmentRecord } from "../../types/shipment.types";

type ShipmentTableProps = {
  shipments: ShipmentRecord[];
  currentPage: number;
  loading: boolean;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
  onShipmentSelected: (key: string, selected: boolean) => void;
  onVisibleShipmentsSelected: (keys: string[], selected: boolean) => void;
  onEdit: (shipment: ShipmentRecord) => void;
  onOpenShipment: (key: string) => void;
};

function Multiline({
  text,
  strong = false,
}: {
  text: string;
  strong?: boolean;
}) {
  return (
    <span className={strong ? "cell-strong" : "cell-muted"}>
      {text.split("\n").map((line) => (
        <span key={line}>{line}</span>
      ))}
    </span>
  );
}

function ShipmentTable({
  shipments,
  currentPage,
  loading,
  hasNextPage,
  onPageChange,
  onShipmentSelected,
  onVisibleShipmentsSelected,
  onEdit,
  onOpenShipment,
}: ShipmentTableProps) {
  const hasVisibleShipments = shipments.length > 0;
  const selectedVisibleCount = shipments.filter(
    (shipment) => shipment.selected,
  ).length;
  const areVisibleShipmentsSelected =
    hasVisibleShipments && selectedVisibleCount === shipments.length;

  const columns: ColumnsType<ShipmentRecord> = [
    {
      title: (
        <Checkbox
          checked={areVisibleShipmentsSelected}
          disabled={!hasVisibleShipments}
          indeterminate={
            selectedVisibleCount > 0 && selectedVisibleCount < shipments.length
          }
          aria-label='Select visible shipments'
          onClick={(event) => event.stopPropagation()}
          onChange={(event) =>
            onVisibleShipmentsSelected(
              shipments.map((shipment) => shipment.key),
              event.target.checked,
            )
          }
        />
      ),
      width: 36,
      fixed: "left",
      render: (_, record) => (
        <Checkbox
          checked={record.selected}
          aria-label={`Select shipment ${record.loadNumber}`}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) =>
            onShipmentSelected(record.key, event.target.checked)
          }
        />
      ),
    },
    {
      title: "Customer",
      dataIndex: "customer",
      width: 155,
      render: (text) => <Multiline text={text} strong />,
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 126,
      render: (text) => (
        <span className='status-cell'>
          {String(text).includes("Transit") ? (
            <TruckOutlined />
          ) : (
            <ClockCircleOutlined />
          )}
          <Multiline text={text} strong />
        </span>
      ),
    },
    { title: "Customer #", dataIndex: "customerNo", width: 115 },
    {
      title: "Load #",
      width: 112,
      render: (_, record) => (
        <span className='bol-cell'>
          <strong>{record.loadNumber}</strong>
          <small>Pro&nbsp;&nbsp;{record.pro}</small>
        </span>
      ),
    },
    {
      title: "Pickup Date",
      width: 118,
      render: (_, record) => (
        <span className='date-cell'>
          <strong>{record.pickupDate}</strong>
          {record.delivery ? <Multiline text={record.delivery} /> : null}
        </span>
      ),
    },
    {
      title: "Carrier",
      width: 136,
      render: (_, record) => (
        <span className='date-cell'>
          <Multiline text={record.carrier} strong />
          {record.carrierNote ? <Multiline text={record.carrierNote} /> : null}
        </span>
      ),
    },
    {
      title: "Origin",
      width: 170,
      render: (_, record) => (
        <span className='date-cell'>
          <Multiline text={record.origin} strong />
          <Multiline text={record.originMeta} />
        </span>
      ),
    },
    {
      title: "Destination",
      width: 180,
      render: (_, record) => (
        <span className='date-cell'>
          <Multiline text={record.destination} strong />
          <Multiline text={record.destinationMeta} />
        </span>
      ),
    },
    {
      title: "Load",
      width: 125,
      render: (_, record) => (
        <span className='load-cell'>
          <span>
            <strong>Pallets:</strong> {record.pallets}
          </span>
          <span>
            <strong>Weight:</strong> {record.weight}
          </span>
        </span>
      ),
    },
    {
      title: "Action",
      width: 92,
      fixed: "right",
      render: (_, record) => (
        <Button
          size='small'
          onClick={(event) => {
            event.stopPropagation();
            onEdit(record);
          }}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div className='shipment-table-card'>
      <Table<ShipmentRecord>
        columns={columns}
        dataSource={shipments}
        loading={{ spinning: loading, tip: "Loading shipments..." }}
        locale={{
          emptyText: loading ? null : <Empty description='No shipments found' />,
        }}
        pagination={false}
        rowClassName={(record) =>
          `shipment-clickable-row${record.selected ? " selected-row" : ""}`
        }
        onRow={(record) => ({
          onClick: () => onOpenShipment(record.loadNumber),
        })}
        scroll={{ x: 1280 }}
      />
      <div className='shipment-pagination'>
        <span>
          Page {currentPage} · Showing <strong>{shipments.length}</strong>{" "}
          shipments
        </span>
        <div>
          <button
            disabled={loading || currentPage === 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}>
            Prev
          </button>
          <button
            disabled={loading || !hasNextPage}
            onClick={() => onPageChange(currentPage + 1)}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default ShipmentTable;
