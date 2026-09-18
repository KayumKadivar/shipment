import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  LeftOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Switch,
  Table,
  Tabs,
  // Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../app/hooks";
import type { AppDispatch } from "../app/store";
import { getAllCustomerLocations, getCustomerLocationByID, updateCustomerLocation, deleteCustomerLocations, fetchClientsAndSubclients } from "../store/customerLocationSlice";
import type {
  CustomerLocation,
  LocationType,
} from "../types/customerLocation.types";

type LocationFormValues = Omit<CustomerLocation, "key">;
type LocationView = "detail" | "group";

interface CustomerLocationPageProps {
  locations: CustomerLocation[];
  setLocations: Dispatch<SetStateAction<CustomerLocation[]>>;
}

interface GroupSummary {
  key: string;
  group: string;
  total: number;
  active: number;
  inactive: number;
  origins: number;
  destinations: number;
  billTo: number;
}

const CSV_COLUMNS: Array<{
  header: string;
  key: keyof Omit<CustomerLocation, "key">;
}> = [
    { header: "Location Name", key: "locationName" },
    { header: "Active", key: "isActive" },
    { header: "Address 1", key: "address1" },
    { header: "Address 2", key: "address2" },
    { header: "Country", key: "country" },
    { header: "State", key: "state" },
    { header: "City", key: "city" },
    { header: "Postal", key: "postal" },
    { header: "Contact Name", key: "contactName" },
    { header: "Phone", key: "phone" },
    { header: "Email", key: "email" },
    { header: "Activate Date", key: "activateDate" },
    { header: "Deactivate Date", key: "deactivateDate" },
    { header: "Group", key: "group" },
    { header: "Location Type", key: "locationType" },
  ];

const requiredCsvHeaders = [
  "Location Name",
  "Address 1",
  "Country",
  "State",
  "City",
  "Postal",
  "Location Type",
];

const emptyText = (value: string) => value || <span className='location-empty'>—</span>;

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normaliseLocationType(value: string): LocationType | null {
  const normalised = value.trim().toLowerCase().replaceAll("-", " ");
  if (normalised === "all") return "All";
  if (normalised === "origin") return "Origin";
  if (normalised === "destination") return "Destination";
  if (normalised === "bill to" || normalised === "billto") return "Bill to";
  return null;
}

function CustomerLocationPage({
  locations,
  setLocations,
}: CustomerLocationPageProps) {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { loading, clients, totalCount } = useAppSelector(
    (state) => state.customerLocation
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeView, setActiveView] = useState<LocationView>("detail");
  const [editingLocation, setEditingLocation] =
    useState<CustomerLocation | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form] = Form.useForm<LocationFormValues>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messageApi, messageContext] = message.useMessage();
  const [modalApi, modalContext] = Modal.useModal();

  const [selectedClientCode, setSelectedClientCode] = useState<string>(
    () => sessionStorage.getItem("customerLocation_selectedClientCode") || ""
  );

  useEffect(() => {
    dispatch(fetchClientsAndSubclients());
  }, [dispatch]);

  useEffect(() => {
    if (clients.length > 0) {
      const isClientValid = clients.some(c => c.clientCode === selectedClientCode);
      if (!isClientValid) {
        setSelectedClientCode(clients[0].clientCode);
      }
    }
  }, [clients, selectedClientCode]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    if (selectedClientCode) {
      sessionStorage.setItem("customerLocation_selectedClientCode", selectedClientCode);
      dispatch(getAllCustomerLocations({
        clientCode: selectedClientCode,
        searchText: debouncedQuery,
        pageNumber: currentPage,
        pageSize: pageSize
      }));
    }
  }, [dispatch, selectedClientCode, debouncedQuery, currentPage, pageSize]);

  // Remove local filtering, just use locations directly from Redux
  const filteredLocations = locations;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  // Locations are already paginated by the backend, no slice needed
  const visibleLocations = locations;


  const groups = useMemo<GroupSummary[]>(() => {
    const grouped = new Map<string, GroupSummary>();
    filteredLocations.forEach((location) => {
      const key = location.group || "UNGROUPED";
      const summary = grouped.get(key) ?? {
        key,
        group: key,
        total: 0,
        active: 0,
        inactive: 0,
        origins: 0,
        destinations: 0,
        billTo: 0,
      };
      summary.total += 1;
      summary.active += location.isActive ? 1 : 0;
      summary.inactive += location.isActive ? 0 : 1;
      summary.origins += location.locationType === "Origin" ? 1 : 0;
      summary.destinations += location.locationType === "Destination" ? 1 : 0;
      summary.billTo += location.locationType === "Bill to" ? 1 : 0;
      grouped.set(key, summary);
    });
    return [...grouped.values()].sort((first, second) =>
      first.group.localeCompare(second.group),
    );
  }, [filteredLocations]);

  const selectedVisibleCount = visibleLocations.filter((location) =>
    selectedKeys.has(location.key),
  ).length;
  const allVisibleSelected =
    visibleLocations.length > 0 &&
    selectedVisibleCount === visibleLocations.length;

  const toggleVisibleLocations = (checked: boolean) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      visibleLocations.forEach((location) => {
        if (checked) next.add(location.key);
        else next.delete(location.key);
      });
      return next;
    });
  };

  const toggleLocation = (key: string, checked: boolean) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const openAddForm = () => {
    const selectedClient = clients.find(c => c.clientCode === selectedClientCode);
    navigate("/customer-location/add", {
      state: {
        clientName: selectedClient?.clientName || "INLAND TRANSPORT, INC."
      }
    });
  };

  const openEditForm = async (location: CustomerLocation) => {
    try {
      const locId = location.locationID || location.key;

      messageApi.loading({ content: 'Fetching location details...', key: 'fetchLoc' });

      const response = await dispatch(getCustomerLocationByID({ locationID: locId })).unwrap();

      messageApi.success({ content: 'Details loaded', key: 'fetchLoc', duration: 2 });

      setEditingLocation(response);
      form.setFieldsValue(response);
      setIsFormOpen(true);
    } catch (error) {
      messageApi.error({ content: 'Failed to fetch location details from API.', key: 'fetchLoc', duration: 3 });
    }
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingLocation(null);
    form.resetFields();
  };

  const saveLocation = async () => {
    try {
      const values = await form.validateFields();
      if (!editingLocation) return;

      messageApi.loading({ content: 'Saving changes...', key: 'saveLoc' });


      const locId = editingLocation.locationID || (editingLocation as any).locationId || editingLocation.key;

      const payload = {
        ...values,
        locationId: locId,
      };

      await dispatch(updateCustomerLocation(payload)).unwrap();

      setLocations((current) =>
        current.map((location) =>
          location.key === editingLocation.key
            ? { ...location, ...values }
            : location,
        ),
      );
      messageApi.success({ content: "Location updated successfully", key: 'saveLoc', duration: 2 });
      closeForm();
    } catch (error: any) {
      messageApi.error({ content: error || "Failed to save changes", key: 'saveLoc', duration: 3 });
    }
  };

  const confirmDelete = () => {
    if (!selectedKeys.size) return;
    modalApi.confirm({
      title: "Delete selected locations?",
      content: `${selectedKeys.size} location${selectedKeys.size === 1 ? "" : "s"} will be removed from this demo.`,
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          messageApi.loading({ content: 'Deleting...', key: 'deleteLoc' });

          const idsToDelete: number[] = [];
          selectedKeys.forEach(key => {
            const loc = locations.find(l => l.key === key);
            if (loc && loc.locationID) {
              idsToDelete.push(Number(loc.locationID));
            } else if (loc && (loc as any).locationId) {
              idsToDelete.push(Number((loc as any).locationId));
            } else if (!isNaN(Number(key))) {
              idsToDelete.push(Number(key)); // Fallback if key is the ID
            }
          });

          if (idsToDelete.length > 0) {
            await dispatch(deleteCustomerLocations(idsToDelete)).unwrap();
          }

          setLocations((current) =>
            current.filter((location) => !selectedKeys.has(location.key)),
          );
          setSelectedKeys(new Set());
          messageApi.success({ content: "Selected locations deleted", key: 'deleteLoc' });
        } catch (error: any) {
          messageApi.error({ content: error || "Failed to delete locations", key: 'deleteLoc' });
        }
      },
    });
  };

  const refreshLocations = async () => {
    messageApi.loading({ content: "Fetching locations from server...", key: "refreshLoc" });
    try {
      await dispatch(getAllCustomerLocations({
        clientCode: selectedClientCode,
        searchText: debouncedQuery,
        pageNumber: 1,
        pageSize: pageSize
      })).unwrap();
      setSelectedKeys(new Set());
      setQuery("");
      setCurrentPage(1);
      setPageSize(10);
      messageApi.success({ content: "Locations refreshed successfully", key: "refreshLoc" });
    } catch (err: any) {
      messageApi.error({
        content: `Network Error: ${err || "Cannot connect to server"}`,
        key: "refreshLoc",
        duration: 4,
      });
    }
  };

  const downloadCsv = () => {
    const rows = locations.map((location) =>
      CSV_COLUMNS.map(({ key }) =>
        escapeCsv(key === "isActive" ? (location[key] ? "Yes" : "No") : location[key]),
      ).join(","),
    );
    const csv = [CSV_COLUMNS.map(({ header }) => escapeCsv(header)).join(","), ...rows].join(
      "\r\n",
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "customer-locations.csv";
    link.click();
    URL.revokeObjectURL(url);
    messageApi.success(`Downloaded ${locations.length} locations`);
  };

  const uploadCsv = async (file: File) => {
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error("The CSV does not contain any location rows.");

      const headers = rows[0].map((header, index) =>
        index === 0 ? header.trim().replace(/^\uFEFF/, "") : header.trim(),
      );
      const missingHeaders = requiredCsvHeaders.filter(
        (requiredHeader) => !headers.includes(requiredHeader),
      );
      if (missingHeaders.length) {
        throw new Error(`Missing required columns: ${missingHeaders.join(", ")}`);
      }

      const headerIndexes = Object.fromEntries(
        CSV_COLUMNS.map(({ header }) => [header, headers.indexOf(header)]),
      ) as Record<string, number>;
      const getValue = (row: string[], header: string) => {
        const index = headerIndexes[header];
        return index >= 0 ? row[index]?.trim() ?? "" : "";
      };

      const uploadedLocations = rows.slice(1).map((row, rowIndex) => {
        const locationType = normaliseLocationType(getValue(row, "Location Type"));
        if (!locationType) {
          throw new Error(`Row ${rowIndex + 2} has an invalid Location Type.`);
        }
        const locationName = getValue(row, "Location Name");
        const address1 = getValue(row, "Address 1");
        const country = getValue(row, "Country");
        const state = getValue(row, "State");
        const city = getValue(row, "City");
        const postal = getValue(row, "Postal");
        if (!locationName || !address1 || !country || !state || !city || !postal) {
          throw new Error(`Row ${rowIndex + 2} is missing a required location or address value.`);
        }
        const activeValue = getValue(row, "Active").toLowerCase();

        return {
          key: `upload-${Date.now()}-${rowIndex}`,
          locationName,
          isActive: !["no", "false", "0", "inactive"].includes(activeValue),
          address1,
          address2: getValue(row, "Address 2"),
          country,
          state,
          city,
          postal,
          contactName: getValue(row, "Contact Name"),
          phone: getValue(row, "Phone"),
          email: getValue(row, "Email"),
          activateDate: getValue(row, "Activate Date"),
          deactivateDate: getValue(row, "Deactivate Date"),
          group: getValue(row, "Group") || "STANDARD",
          locationType,
        } satisfies CustomerLocation;
      });

      setLocations((current) => [...current, ...uploadedLocations]);
      setCurrentPage(1);
      messageApi.success(`Uploaded ${uploadedLocations.length} locations`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "Unable to read this CSV file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const columns: ColumnsType<CustomerLocation> = [
    {
      title: (
        <Checkbox
          checked={allVisibleSelected}
          indeterminate={
            selectedVisibleCount > 0 && selectedVisibleCount < visibleLocations.length
          }
          disabled={!visibleLocations.length}
          aria-label='Select all visible customer locations'
          onChange={(event) => toggleVisibleLocations(event.target.checked)}
        />
      ),
      width: 38,
      fixed: "left",
      render: (_, location) => (
        <Checkbox
          checked={selectedKeys.has(location.key)}
          aria-label={`Select ${location.locationName}`}
          onChange={(event) => toggleLocation(location.key, event.target.checked)}
        />
      ),
    },
    {
      title: "",
      width: 38,
      fixed: "left",
      render: (_, location) => (
        <Button
          type='text'
          className='location-edit-button'
          aria-label={`Edit ${location.locationName}`}
          icon={<EditOutlined />}
          onClick={() => openEditForm(location)}
        />
      ),
    },
    {
      title: "Location Name",
      dataIndex: "locationName",
      width: 180,
      fixed: "left",
      render: (value: string) => <strong className='location-name-cell'>{value}</strong>,
    },
    {
      title: "Is Active",
      dataIndex: "isActive",
      width: 84,
      align: "center",
      render: (isActive: boolean) => (
        <span
          className={`location-active-dot${isActive ? "" : " location-active-dot--off"}`}
          aria-label={isActive ? "Active" : "Inactive"}
          title={isActive ? "Active" : "Inactive"}
        />
      ),
    },
    { title: "Address 1", dataIndex: "address1", width: 170 },
    {
      title: "Address 2",
      dataIndex: "address2",
      width: 110,
      render: emptyText,
    },
    { title: "Country", dataIndex: "country", width: 86 },
    { title: "State", dataIndex: "state", width: 76 },
    { title: "City", dataIndex: "city", width: 112 },
    { title: "Postal", dataIndex: "postal", width: 82 },
    {
      title: "Contact Name",
      dataIndex: "contactName",
      width: 130,
      render: emptyText,
    },
    { title: "Phone", dataIndex: "phone", width: 128, render: emptyText },
    { title: "Email", dataIndex: "email", width: 150, render: emptyText },
    /* { title: "Activate Date", dataIndex: "activateDate", width: 126, render: emptyText },
    {
      title: "Deactivate Date",
      dataIndex: "deactivateDate",
      width: 136,
      render: emptyText,
    },
    { title: "Group", dataIndex: "group", width: 102 },
    {
      title: "Location Type",
      dataIndex: "locationType",
      width: 126,
      render: (locationType: LocationType) => (
        <Tag className={`location-type-tag location-type-tag--${locationType.toLowerCase().replaceAll(" ", "-")}`}>
          {locationType}
        </Tag>
      ),
    }, */
  ];

  const groupColumns: ColumnsType<GroupSummary> = [
    {
      title: "Location Group",
      dataIndex: "group",
      render: (value: string) => <strong className='location-name-cell'>{value}</strong>,
    },
    { title: "Total Locations", dataIndex: "total", width: 150, align: "center" },
    { title: "Active", dataIndex: "active", width: 110, align: "center" },
    { title: "Inactive", dataIndex: "inactive", width: 110, align: "center" },
    { title: "Origins", dataIndex: "origins", width: 110, align: "center" },
    { title: "Destinations", dataIndex: "destinations", width: 130, align: "center" },
    { title: "Bill To", dataIndex: "billTo", width: 110, align: "center" },
  ];

  const shownStart = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const shownEnd = Math.min(currentPage * pageSize, totalCount);

  return (
    <section className='customer-locations-page'>
      {messageContext}
      {modalContext}
      <input
        ref={fileInputRef}
        className='location-file-input'
        type='file'
        accept='.csv,text/csv'
        aria-label='Upload customer locations CSV'
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadCsv(file);
        }}
      />

      <div className='customer-locations-heading'>
        <div>
          <Typography.Title level={1}>Customer Locations</Typography.Title>
          <Typography.Text>Manage address book entries for all clients</Typography.Text>
        </div>
        <div className='customer-location-actions'>
          <Button icon={<DownloadOutlined />} onClick={downloadCsv}>
            Download Locations
          </Button>
          <Button
            className='location-upload-button'
            icon={<UploadOutlined />}
            onClick={() => fileInputRef.current?.click()}>
            Upload Locations
          </Button>
          <Button type='primary' icon={<PlusOutlined />} onClick={openAddForm}>
            Add Location
          </Button>
        </div>
      </div>

      <Tabs
        className='customer-location-tabs'
        activeKey={activeView}
        animated={{ inkBar: true, tabPane: false }}
        aria-label='Customer location views'
        items={[
          { key: "detail", label: "Location Detail" },
          // { key: "group", label: "Location Group" },
        ]}
        onChange={(key) => setActiveView(key as LocationView)}
      />

      <div className='customer-location-controls'>
        <div className='location-client-row'>
          <span>Client:</span>
          <Select
            value={selectedClientCode}
            onChange={setSelectedClientCode}
            style={{ minWidth: 250 }}
            options={clients.map(client => ({
              label: (
                <span>
                  <UserOutlined style={{ marginRight: 8 }} />
                  {client.clientName}
                </span>
              ),
              value: client.clientCode
            }))}
            loading={clients.length === 0}
          />
        </div>
        <div className='location-toolbar'>
          <div className='location-toolbar__left'>
            <Input
              allowClear
              value={query}
              prefix={<SearchOutlined />}
              placeholder={activeView === "detail" ? "Search locations..." : "Search groups or locations..."}
              aria-label='Search customer locations'
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(1);
              }}
            />
            <Button icon={<ReloadOutlined />} onClick={refreshLocations}>
              Refresh
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              disabled={!selectedKeys.size || activeView !== "detail"}
              onClick={confirmDelete}>
              Delete{selectedKeys.size ? ` (${selectedKeys.size})` : ""}
            </Button>
          </div>

          {activeView === "detail" ? (
            <div className='location-page-controls'>
              <span>Page size</span>
              <Select
                value={pageSize}
                aria-label='Customer locations page size'
                options={[10, 20, 50].map((value) => ({ value, label: value }))}
                onChange={(value) => {
                  setPageSize(value);
                  setCurrentPage(1);
                }}
              />
              <Button
                aria-label='Previous page'
                icon={<LeftOutlined />}
                disabled={activePage === 1}
                onClick={() => setCurrentPage(Math.max(1, activePage - 1))}
              />
              <span>{activePage} of {totalPages}</span>
              <Button
                aria-label='Next page'
                icon={<RightOutlined />}
                disabled={activePage === totalPages}
                onClick={() => setCurrentPage(Math.min(totalPages, activePage + 1))}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className='customer-location-table-card'>
        {activeView === "detail" ? (
          <>
            <Table<CustomerLocation>
              loading={loading}
              columns={columns}
              dataSource={visibleLocations}
              pagination={false}
              scroll={{ x: 1840 }}
              locale={{ emptyText: query ? "No locations match your search" : "No customer locations" }}
              rowClassName={(location) =>
                selectedKeys.has(location.key) ? "location-row-selected" : ""
              }
            />
            <div className='customer-location-footer'>
              <span>
                Showing {shownStart}-{shownEnd} of <strong>{totalCount}</strong>{" "}
                Customer Locations
              </span>
              <div className='customer-location-pagination'>
                <button
                  type='button'
                  disabled={activePage === 1}
                  onClick={() => setCurrentPage(Math.max(1, activePage - 1))}>
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    type='button'
                    key={page}
                    aria-current={page === activePage ? "page" : undefined}
                    className={page === activePage ? "current" : ""}
                    onClick={() => setCurrentPage(page)}>
                    {page}
                  </button>
                ))}
                <button
                  type='button'
                  disabled={activePage === totalPages}
                  onClick={() => setCurrentPage(Math.min(totalPages, activePage + 1))}>
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <Table<GroupSummary>
            className='customer-location-group-table'
            columns={groupColumns}
            dataSource={groups}
            pagination={false}
            scroll={{ x: 900 }}
            locale={{ emptyText: query ? "No groups match your search" : "No location groups" }}
          />
        )}
      </div>

      <Modal
        title='Edit Location'
        open={isFormOpen}
        okText='Save Changes'
        width={780}
        onCancel={closeForm}
        onOk={() => void saveLocation()}>
        <Form<LocationFormValues>
          form={form}
          layout='vertical'
          className='customer-location-form'>
          <div className='customer-location-form-grid'>
            <Form.Item
              label='Location name'
              name='locationName'
              rules={[{ required: true, message: "Enter a location name" }]}>
              <Input />
            </Form.Item>
            <Form.Item label='Active' name='isActive' valuePropName='checked'>
              <Switch checkedChildren='Active' unCheckedChildren='Inactive' />
            </Form.Item>
            <Form.Item
              label='Address 1'
              name='address1'
              rules={[{ required: true, message: "Enter the primary address" }]}>
              <Input />
            </Form.Item>
            <Form.Item label='Address 2' name='address2'>
              <Input />
            </Form.Item>
            <Form.Item
              label='Country'
              name='country'
              rules={[{ required: true, message: "Enter a country" }]}>
              <Input />
            </Form.Item>
            <Form.Item
              label='State'
              name='state'
              rules={[{ required: true, message: "Enter a state" }]}>
              <Input />
            </Form.Item>
            <Form.Item
              label='City'
              name='city'
              rules={[{ required: true, message: "Enter a city" }]}>
              <Input />
            </Form.Item>
            <Form.Item
              label='Postal code'
              name='postal'
              rules={[{ required: true, message: "Enter a postal code" }]}>
              <Input />
            </Form.Item>
            <Form.Item label='Contact name' name='contactName'>
              <Input />
            </Form.Item>
            <Form.Item label='Phone' name='phone'>
              <Input />
            </Form.Item>
            <Form.Item
              label='Email'
              name='email'
              rules={[{ type: "email", message: "Enter a valid email address" }]}>
              <Input />
            </Form.Item>
            {/* <Form.Item label='Group' name='group'>
              <Input />
            </Form.Item>
            <Form.Item label='Activate date' name='activateDate'>
              <Input placeholder='MM/DD/YYYY' />
            </Form.Item>
            <Form.Item label='Deactivate date' name='deactivateDate'>
              <Input placeholder='MM/DD/YYYY' />
            </Form.Item>
            <Form.Item
              label='Location type'
              name='locationType'
              rules={[{ required: true, message: "Choose a location type" }]}>
              <Select
                options={(["All", "Origin", "Destination", "Bill to"] as LocationType[]).map(
                  (value) => ({ value, label: value }),
                )}
              />
            </Form.Item> */}
          </div>
        </Form>
      </Modal>
    </section>
  );
}

export default CustomerLocationPage;
