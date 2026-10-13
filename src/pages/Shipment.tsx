import {
  CheckOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  FlagOutlined,
  ReloadOutlined,
  TruckOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Space, Typography } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import ShipmentEditModal, {
  type ShipmentEditValues,
} from "../components/shipment/ShipmentEditModal";
import ShipmentTable from "../components/shipment/ShipmentTable";
import { fetchShipments } from "../store/shipmentSlice";
import type { ShipmentRecord } from "../types/shipment.types";

const PAGE_SIZE = 20;

const stats = [
  { label: "Quotes", value: "38", note: "12 awaiting response", dot: "#888" },
  { label: "Booked", value: "64", note: "+8 vs yesterday", dot: "#df2027", positive: true },
  { label: "Pickup Req.", value: "29", note: "5 pending confirmation", dot: "#2f55c7" },
  { label: "In Transit", value: "87", note: "23 out for delivery", dot: "#ff5a1f" },
  { label: "Delivered", value: "29", note: "On-time 96%", dot: "#2fbf71", positive: true },
];

const filters = [
  { label: "Booked", icon: <FileTextOutlined />, active: true },
  { label: "In Transit", icon: <TruckOutlined /> },
  { label: "Delivered", icon: <CheckOutlined /> },
  { label: "Pickup Requested", icon: <ClockCircleOutlined /> },
  { label: "Expired", icon: <ExclamationCircleOutlined /> },
  { label: "Pickup Succeed", icon: <FlagOutlined /> },
  { label: "Pickup Failed", icon: <WarningOutlined /> },
  { label: "Out for Delivery", icon: <TruckOutlined /> },
];

function Shipment() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const {
    shipmentsLoading,
    shipmentsError,
    hasNextShipmentsPage,
  } = useAppSelector((state) => state.shipment);
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingShipment, setEditingShipment] = useState<ShipmentRecord | null>(null);
  const activeRequestRef = useRef<{ abort: () => void } | null>(null);

  const requestShipments = useCallback(
    (pageNumber: number) => {
      activeRequestRef.current?.abort();
      const request = dispatch(
        fetchShipments({ pageNumber, pageSize: PAGE_SIZE }),
      );
      activeRequestRef.current = request;
      void request
        .unwrap()
        .then(({ shipments: fetchedShipments }) => {
          if (activeRequestRef.current !== request) return;

          if (fetchedShipments.length === 0 && pageNumber > 1) {
            setShipments([]);
            setCurrentPage(Math.max(1, pageNumber - 1));
            return;
          }

          setShipments(fetchedShipments);
        })
        .catch(() => undefined)
        .finally(() => {
          if (activeRequestRef.current === request) {
            activeRequestRef.current = null;
          }
        });
      return request;
    },
    [dispatch],
  );

  useEffect(() => {
    void requestShipments(currentPage);
    return () => activeRequestRef.current?.abort();
  }, [currentPage, requestShipments]);

  const changePage = (page: number) => {
    setEditingShipment(null);
    setShipments([]);
    setCurrentPage(page);
  };

  const setShipmentSelected = (key: string, selected: boolean) => {
    setShipments((currentShipments) =>
      currentShipments.map((shipment) =>
        shipment.key === key ? { ...shipment, selected } : shipment,
      ),
    );
  };

  const setVisibleShipmentsSelected = (keys: string[], selected: boolean) => {
    const visibleKeys = new Set(keys);
    setShipments((currentShipments) =>
      currentShipments.map((shipment) =>
        visibleKeys.has(shipment.key) ? { ...shipment, selected } : shipment,
      ),
    );
  };

  const saveEditedShipment = (values: ShipmentEditValues) => {
    setShipments((currentShipments) =>
      currentShipments.map((shipment) =>
        shipment.key === editingShipment?.key ? { ...shipment, ...values } : shipment,
      ),
    );
    setEditingShipment(null);
  };

  return (
    <section className="shipments-page">
      <div className="shipments-header">
        <div>
          <Typography.Title level={2}>Active Shipments</Typography.Title>
          <Typography.Text>
            218 shipments · <strong>8 require attention</strong> · Last refreshed 42 seconds ago
          </Typography.Text>
        </div>
        <Space wrap>
          <Button
            icon={<ReloadOutlined />}
            loading={shipmentsLoading}
            onClick={() => requestShipments(currentPage)}>
            Refresh
          </Button>
          <Button icon={<ClockCircleOutlined />}>Quick Quote</Button>
          <Button type="primary" onClick={() => navigate("/shipments/new")}>+ New Shipment</Button>
        </Space>
      </div>

      <div className="shipment-stats">
        {stats.map((stat) => (
          <Card key={stat.label} className="shipment-stat-card">
            <span className="stat-label">
              <i style={{ background: stat.dot }} />
              {stat.label}
            </span>
            <strong>{stat.value}</strong>
            <small className={stat.positive ? "positive" : ""}>{stat.note}</small>
          </Card>
        ))}
      </div>

      <div className="shipment-filters">
        {filters.map((filter) => (
          <Button key={filter.label} className={filter.active ? "active" : ""} icon={filter.icon}>
            {filter.label}
          </Button>
        ))}
      </div>

      {shipmentsError ? (
        <Alert
          style={{ marginBottom: 16 }}
          type='error'
          showIcon
          title='Unable to load shipments'
          description={shipmentsError}
          action={
            <Button size='small' onClick={() => requestShipments(currentPage)}>
              Retry
            </Button>
          }
        />
      ) : null}

      <ShipmentTable
        shipments={shipments}
        currentPage={currentPage}
        loading={shipmentsLoading}
        hasNextPage={hasNextShipmentsPage}
        onPageChange={changePage}
        onShipmentSelected={setShipmentSelected}
        onVisibleShipmentsSelected={setVisibleShipmentsSelected}
        onEdit={setEditingShipment}
        onOpenShipment={(loadNumber) =>
          navigate(`/shipments/${encodeURIComponent(loadNumber)}`)
        }
      />

      <ShipmentEditModal
        shipment={editingShipment}
        onCancel={() => setEditingShipment(null)}
        onSave={saveEditedShipment}
      />
    </section>
  );
}

export default Shipment;
