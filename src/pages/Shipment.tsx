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
import { Alert, Button, Card, Space, Spin, Typography } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import ShipmentTable from "../components/shipment/ShipmentTable";
import { fetchShipments } from "../store/shipmentSlice";
import { resetShipmentStatusSearch, searchShipmentsByStatus } from "../store/shipmentStatusSearchSlice";
import { fetchShipmentStatusCounts } from "../store/shipmentStatusCountsSlice";
import type { ShipmentRecord } from "../types/shipment.types";

const PAGE_SIZE = 20;

const stats = [
  { label: "Expired", dot: "#888" },
  { label: "In Transit", dot: "#ff5a1f" },
  { label: "Booked", dot: "#df2027" },
  { label: "Delivered", dot: "#2fbf71" },
  { label: "Out For Delivery", dot: "#0891b2" },
  { label: "Pickup Requested", dot: "#2f55c7" },
  { label: "Pickup Failed", dot: "#dc2626" },
  { label: "Pickup Succeed", dot: "#17864b" },
];

const filters = [
  { label: "Booked", icon: <FileTextOutlined /> },
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
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const {
    shipmentsLoading,
    shipmentsError,
    hasNextShipmentsPage,
  } = useAppSelector((state) => selectedStatus ? {
    shipmentsLoading: state.shipmentStatusSearch.loading,
    shipmentsError: state.shipmentStatusSearch.error,
    hasNextShipmentsPage: state.shipmentStatusSearch.hasNextPage,
  } : {
    shipmentsLoading: state.shipment.shipmentsLoading,
    shipmentsError: state.shipment.shipmentsError,
    hasNextShipmentsPage: state.shipment.hasNextShipmentsPage,
  }, (previous, next) => previous.shipmentsLoading === next.shipmentsLoading
    && previous.shipmentsError === next.shipmentsError
    && previous.hasNextShipmentsPage === next.hasNextShipmentsPage);
  const statusCounts = useAppSelector((state) => state.shipmentStatusCounts);
  const ratingProfileCode = useAppSelector(
    (state) =>
      state.app?.ratingProfileCode ||
      state.customerLocation?.clients?.[0]?.ratingProfileCode ||
      ""
  );
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const activeRequestRef = useRef<{ abort: () => void } | null>(null);
  const statusCountsRequestRef = useRef<{ abort: () => void } | null>(null);

  /** Replaces any pending count lookup without affecting table pagination. */
  const requestStatusCounts = useCallback(() => {
    statusCountsRequestRef.current?.abort();
    const request = dispatch(fetchShipmentStatusCounts());
    statusCountsRequestRef.current = request;
    return request;
  }, [dispatch]);

  useEffect(() => {
    void requestStatusCounts();
    return () => statusCountsRequestRef.current?.abort();
  }, [requestStatusCounts]);

  const requestShipments = useCallback(
    (pageNumber: number) => {
      activeRequestRef.current?.abort();
      const request = selectedStatus
        ? dispatch(searchShipmentsByStatus({ statusCodes: [selectedStatus], pageNumber, pageSize: PAGE_SIZE }))
        : dispatch(fetchShipments({ pageNumber, pageSize: PAGE_SIZE, clientCode: ratingProfileCode }));
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
    [dispatch, selectedStatus, ratingProfileCode],
  );

  useEffect(() => {
    void requestShipments(currentPage);
    return () => {
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
    };
  }, [currentPage, requestShipments]);

  const changePage = (page: number) => {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    setShipments([]);
    setCurrentPage(page);
  };

  /** Changes the single active filter and invalidates the previous table request. */
  const changeStatus = (status: string | null) => {
    if (selectedStatus === status) return;
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    dispatch(resetShipmentStatusSearch());
    setShipments([]);
    setCurrentPage(1);
    setSelectedStatus(status);
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
            loading={shipmentsLoading || statusCounts.loading}
            onClick={() => {
              requestShipments(currentPage);
              requestStatusCounts();
            }}>
            Refresh
          </Button>
          <Button icon={<ClockCircleOutlined />}>Quick Quote</Button>
          <Button type="primary" onClick={() => navigate("/shipments/new")}>+ New Shipment</Button>
        </Space>
      </div>

      {statusCounts.loading ? (
        <div className="shipment-status-counts-feedback" role="status">
          <Spin size="small" /> Loading shipment status counts...
        </div>
      ) : null}
      {statusCounts.error ? (
        <Alert
          className="shipment-status-counts-feedback"
          type="error"
          showIcon
          title="Unable to load shipment status counts"
          description={statusCounts.error}
          action={<Button onClick={requestStatusCounts}>Retry counts</Button>}
        />
      ) : null}
      <div className="shipment-stats" aria-label="Shipment status counts" aria-busy={statusCounts.loading}>
        {stats.map((stat) => (
          <Card key={stat.label} className="shipment-stat-card">
            <span className="stat-label">
              <i style={{ background: stat.dot }} />
              {stat.label}
            </span>
            <strong>
              {statusCounts.data && !statusCounts.loading && !statusCounts.error
                ? statusCounts.data.find((item) => item.shipmentStatus === stat.label)?.shipmentCount ?? 0
                : "—"}
            </strong>
          </Card>
        ))}
      </div>

      <div className="shipment-filters">
        <Button className={selectedStatus === null ? "active" : ""} aria-pressed={selectedStatus === null}
          onClick={() => changeStatus(null)}>All</Button>
        {filters.map((filter) => (
          <Button key={filter.label}
            className={selectedStatus === (filter.label === "Out for Delivery" ? "Out For Delivery" : filter.label) ? "active" : ""}
            aria-pressed={selectedStatus === (filter.label === "Out for Delivery" ? "Out For Delivery" : filter.label)}
            onClick={() => changeStatus(filter.label === "Out for Delivery" ? "Out For Delivery" : filter.label)} icon={filter.icon}>
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
        onOpenShipment={(loadNumber, clientCode) =>
          navigate(`/shipments/${encodeURIComponent(loadNumber)}`, {
            state: { loadNumber, clientCode },
          })
        }
      />
    </section>
  );
}

export default Shipment;
