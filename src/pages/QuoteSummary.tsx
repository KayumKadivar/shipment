import {
  FilterOutlined,
  PlusOutlined,
  SaveOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Button, DatePicker, Empty, Input, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  quoteSummaryData,
  type QuoteLoad,
  type QuoteSummaryRecord,
} from "./quoteSummaryData";

type DateRangeValue = [Dayjs | null, Dayjs | null] | null;

const selectOptions = {
  salesGroups: ["Florida Hub", "Midwest Hub", "National Accounts"],
  salesReps: ["Brian Young", "Nicole Keener", "Pete Jones"],
  customers: quoteSummaryData.map((quote) => quote.customer),
};

function DetailCell({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <span className='quote-summary-detail-cell'>
      <strong>{primary}</strong>
      <small>{secondary}</small>
    </span>
  );
}

function QuoteSummary() {
  const navigate = useNavigate();
  const [draftSearch, setDraftSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => [
    dayjs("2026-08-06"),
    dayjs("2026-08-25"),
  ]);
  const [salesGroup, setSalesGroup] = useState<string>();
  const [salesRep, setSalesRep] = useState<string>();
  const [customer, setCustomer] = useState<string>();

  const visibleQuotes = useMemo(() => {
    const query = appliedSearch.trim().toLowerCase();
    if (!query) return quoteSummaryData;

    return quoteSummaryData.filter((quote) =>
      [
        quote.customer,
        quote.customerCode,
        quote.reference,
        quote.pickupDate,
        quote.origin,
        quote.originPostal,
        quote.destination,
        quote.destinationPostal,
        quote.carrierCode,
        quote.carrierName,
        quote.createdBy,
        ...quote.loads.flatMap((load) => [load.freightClass, load.weight]),
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [appliedSearch]);

  const clearFilters = () => {
    setDraftSearch("");
    setAppliedSearch("");
    setDateRange(null);
    setSalesGroup(undefined);
    setSalesRep(undefined);
    setCustomer(undefined);
  };

  const columns: ColumnsType<QuoteSummaryRecord> = [
    {
      title: "Customer",
      dataIndex: "customer",
      width: 210,
      sorter: (first, second) => first.customer.localeCompare(second.customer),
      render: (_, record) => (
        <span className='quote-summary-customer-cell'>
          <strong>{record.customer}</strong>
          <small>{record.customerCode}</small>
          <small>{record.createdAgo}</small>
          <small>{record.createdDate}</small>
        </span>
      ),
    },
    {
      title: "Reference",
      dataIndex: "reference",
      width: 130,
      sorter: (first, second) => first.reference.localeCompare(second.reference),
      render: (reference: string) => (
        <button
          type='button'
          className='quote-summary-reference-link'
          onClick={() => navigate(`/quote-summary/${encodeURIComponent(reference)}`)}>
          {reference}
        </button>
      ),
    },
    {
      title: "Pickup Date",
      dataIndex: "pickupDate",
      width: 120,
      sorter: (first, second) => first.pickupTimestamp - second.pickupTimestamp,
    },
    {
      title: "Origin",
      dataIndex: "origin",
      width: 145,
      sorter: (first, second) => first.origin.localeCompare(second.origin),
      render: (_, record) => (
        <DetailCell primary={record.origin} secondary={record.originPostal} />
      ),
    },
    {
      title: "Destination",
      dataIndex: "destination",
      width: 150,
      sorter: (first, second) =>
        first.destination.localeCompare(second.destination),
      render: (_, record) => (
        <DetailCell
          primary={record.destination}
          secondary={record.destinationPostal}
        />
      ),
    },
    {
      title: "Load",
      dataIndex: "loads",
      width: 110,
      render: (loads: QuoteLoad[]) => (
        <span className='quote-summary-load-cell'>
          {loads.map((load, index) => (
            <span
              className='quote-summary-load-item'
              key={`${load.freightClass}-${index}`}>
              <span className='quote-summary-class-badge'>
                <small>Class</small>
                <strong>{load.freightClass}</strong>
              </span>
              <small>{load.weight}</small>
            </span>
          ))}
        </span>
      ),
    },
    {
      title: "Carrier",
      dataIndex: "carrierCode",
      width: 150,
      sorter: (first, second) =>
        first.carrierName.localeCompare(second.carrierName),
      render: (_, record) => (
        <DetailCell primary={record.carrierCode} secondary={record.carrierName} />
      ),
    },
    {
      title: "Created By",
      dataIndex: "createdBy",
      width: 130,
      render: (createdBy: string) => (
        <span className='quote-summary-created-by'>{createdBy}</span>
      ),
    },
  ];

  return (
    <section className='quote-summary-page' aria-label='Quote Summary'>
      <div className='quote-summary-filter-card'>
        <div className='quote-summary-filter-topline'>
          <Input
            value={draftSearch}
            placeholder='Filter quotes...'
            allowClear
            aria-label='Filter quotes'
            onChange={(event) => setDraftSearch(event.target.value)}
            onPressEnter={() => setAppliedSearch(draftSearch)}
          />
          <Button
            icon={<FilterOutlined />}
            aria-expanded={showMoreFilters}
            onClick={() => setShowMoreFilters((current) => !current)}>
            More Filters
          </Button>
          <Button
            type='primary'
            icon={<PlusOutlined />}
            onClick={() => navigate("/quotes")}>
            New Quote
          </Button>
        </div>

        {showMoreFilters ? (
          <div className='quote-summary-more-filters'>
            <label className='quote-summary-filter-field quote-summary-date-field'>
              <span>Date Range</span>
              <DatePicker.RangePicker
                className='quote-summary-filter-control'
                size='large'
                value={dateRange}
                format='MM/DD/YYYY'
                allowClear
                inputReadOnly
                aria-label='Quote date range'
                onChange={(dates) => setDateRange(dates)}
              />
            </label>
            <Select
              className='quote-summary-filter-control'
              size='large'
              value={salesGroup}
              allowClear
              placeholder='Sales Group'
              aria-label='Sales group'
              options={selectOptions.salesGroups.map((value) => ({ value }))}
              onChange={setSalesGroup}
            />
            <Select
              className='quote-summary-filter-control'
              size='large'
              value={salesRep}
              allowClear
              placeholder='Sales Rep'
              aria-label='Sales representative'
              options={selectOptions.salesReps.map((value) => ({ value }))}
              onChange={setSalesRep}
            />
            <Select
              className='quote-summary-filter-control'
              size='large'
              value={customer}
              allowClear
              placeholder='Customer'
              aria-label='Customer'
              showSearch
              optionFilterProp='value'
              options={selectOptions.customers.map((value) => ({ value }))}
              onChange={setCustomer}
            />
            <div className='quote-summary-filter-actions'>
              <Button type='text' onClick={clearFilters}>
                Clear All
              </Button>
              <Button
                icon={<SearchOutlined />}
                onClick={() => setAppliedSearch(draftSearch)}>
                Search
              </Button>
              <Button icon={<SaveOutlined />} disabled>
                Save Filter
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className='quote-summary-table-card'>
        <Table<QuoteSummaryRecord>
          columns={columns}
          dataSource={visibleQuotes}
          pagination={false}
          showSorterTooltip={false}
          scroll={{ x: 1145 }}
          locale={{
            emptyText: <Empty description='No quotes match your search.' />,
          }}
        />
      </div>
    </section>
  );
}

export default QuoteSummary;
