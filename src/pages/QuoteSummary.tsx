import {
  FilterOutlined,
  PlusOutlined,
  SearchOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { Button, DatePicker, Empty, Input, Select, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { type Dayjs } from "dayjs";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { fetchQuotes, searchQuote } from "../store/quoteSlice";
import { fetchClientsAndSubclients } from "../store/customerLocationSlice";
import { clearQuoteFormData } from "../store/customerRateSlice";
import {
  type QuoteLoad,
  type QuoteSummaryRecord,
} from "./quoteSummaryData";

type DateRangeValue = [Dayjs | null, Dayjs | null] | null;

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
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>(null);
  const [salesRep, setSalesRep] = useState<string>();
  const [customer, setCustomer] = useState<string>();
  const [clientList, setClientList] = useState<{ clientName: string; clientCode: string }[]>([]);
  const [activePage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const dispatch = useAppDispatch();
  const { quotes: apiQuotes, loading } = useAppSelector((state) => state.quote);

  const handleSearch = useCallback((customRef?: string) => {
    const refNum = (customRef !== undefined ? customRef : draftSearch).trim();
    setCurrentPage(1);

    const fromDateIso = dateRange?.[0]
      ? dateRange[0].startOf("day").toISOString()
      : null;
    const toDateIso = dateRange?.[1]
      ? dateRange[1].endOf("day").toISOString()
      : null;

    dispatch(
      searchQuote({
        referenceNumber: refNum,
        clientName: customer || "",
        originZip: "",
        destinationZip: "",
        fromDate: fromDateIso,
        toDate: toDateIso,
        createdBy: salesRep?.trim() || "",
        pageNumber: 1,
        pageSize: 100,
      })
    )
      .unwrap()
      .catch((err) => {
        message.error(typeof err === "string" ? err : "Failed to search quotes");
      });
  }, [dispatch, draftSearch, customer, dateRange, salesRep]);

  useEffect(() => {
    dispatch(
      searchQuote({
        referenceNumber: "",
        clientName: "",
        originZip: "",
        destinationZip: "",
        fromDate: null,
        toDate: null,
        createdBy: "",
        pageNumber: 1,
        pageSize: 100,
      })
    )
      .unwrap()
      .catch(() => {
        // Fallback to fetchQuotes if search endpoint is unavailable
        dispatch(fetchQuotes({ clientCode: "DEVTS" }));
      });

    dispatch(fetchClientsAndSubclients())
      .unwrap()
      .then((clients) => {
        if (Array.isArray(clients)) {
          setClientList(clients);
        }
      })
      .catch(() => {});

    dispatch(clearQuoteFormData());
  }, [dispatch]);

  const dynamicQuoteSummaryData: QuoteSummaryRecord[] = useMemo(() => {
    return apiQuotes.map((q) => {
      const result = q.quoteResults?.[0];
      const date = q.requestedDate ? new Date(q.requestedDate) : new Date();
      return {
        key: `quote-${q.quoteRequestId}`,
        customer: q.clientName || "",
        customerCode: q.clientCode || "",
        createdAgo: "Created recently on",
        createdDate: date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }),
        reference: String(q.quoteRequestId),
        pickupDate: q.pickupDate ? new Date(q.pickupDate).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }) : "",
        pickupTimestamp: q.pickupDate ? new Date(q.pickupDate).getTime() : 0,
        origin: `${q.originCity || ""}, ${q.originStateCode || ""}`,
        originPostal: q.originZip || "",
        destination: `${q.destinationCity || ""}, ${q.destinationStateCode || ""}`,
        destinationPostal: q.destinationZip || "",
        loads: (q.quoteProducts || []).map((p) => ({
          freightClass: String(p.productClass || ""),
          weight: `${p.weight || 0} lbs`,
        })),
        carrierCode: result?.scac || "",
        carrierName: result?.carrierName || "",
        createdBy: q.createdBy || q.profileCode || "",
        profile: q.profileCode || "",
        totalWeight: `${(q.quoteProducts || []).reduce((acc, p) => acc + (Number(p.weight) || 0), 0)} lbs`,
        pallets: (q.quoteProducts || []).reduce((acc, p) => acc + (Number(p.pallets) || 0), 0),
        pieces: 0,
      };
    });
  }, [apiQuotes]);

  const customerOptions = useMemo(() => {
    const names = new Set<string>();
    clientList.forEach((c) => {
      if (c.clientName) names.add(c.clientName);
    });
    dynamicQuoteSummaryData.forEach((quote) => {
      if (quote.customer) names.add(quote.customer);
    });
    return Array.from(names).map((name) => ({ label: name, value: name }));
  }, [clientList, dynamicQuoteSummaryData]);

  const visibleQuotes = dynamicQuoteSummaryData;

  const totalCount = visibleQuotes.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const paginatedQuotes = useMemo(() => {
    const startIndex = (activePage - 1) * pageSize;
    return visibleQuotes.slice(startIndex, startIndex + pageSize);
  }, [visibleQuotes, activePage, pageSize]);

  const shownStart = totalCount === 0 ? 0 : (activePage - 1) * pageSize + 1;
  const shownEnd = Math.min(activePage * pageSize, totalCount);

  const clearFilters = () => {
    setDraftSearch("");
    setDateRange(null);
    setSalesRep(undefined);
    setCustomer(undefined);
    setCurrentPage(1);

    dispatch(
      searchQuote({
        referenceNumber: "",
        clientName: "",
        originZip: "",
        destinationZip: "",
        fromDate: null,
        toDate: null,
        createdBy: "",
        pageNumber: 1,
        pageSize: 100,
      })
    );
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
      width: 150,
      render: (loads: QuoteLoad[]) => (
        <span className='quote-summary-load-cell'>
          {loads.map((load, index) => (
            <span
              className='quote-summary-load-item'
              key={`${load.freightClass}-${index}`}>
              <span className='quote-summary-class-badge'>
                <small>Class : <strong>{load.freightClass}</strong> - {load.weight}</small>
              </span>
            </span>
          ))}
        </span>
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
            placeholder='Filter quotes by reference #...'
            allowClear
            aria-label='Filter quotes'
            onChange={(event) => {
              const val = event.target.value;
              setDraftSearch(val);
              if (!val && draftSearch) {
                handleSearch("");
              }
            }}
            onPressEnter={() => handleSearch()}
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
            onClick={() => {
              dispatch(clearQuoteFormData());
              navigate("/quotes");
            }}>
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
            <Input
              className='quote-summary-filter-control'
              size='large'
              value={salesRep}
              allowClear
              placeholder='Sales Rep'
              aria-label='Sales representative'
              onChange={(e) => setSalesRep(e.target.value)}
              onPressEnter={() => handleSearch()}
            />
            <Select
              className='quote-summary-filter-control'
              size='large'
              value={customer}
              allowClear
              placeholder='Customer'
              aria-label='Customer'
              showSearch
              optionFilterProp='label'
              options={customerOptions}
              onChange={setCustomer}
            />
            <div className='quote-summary-filter-actions'>
              <Button type='text' disabled={loading} onClick={clearFilters}>
                Clear All
              </Button>
              <Button
                icon={<SearchOutlined />}
                loading={loading}
                onClick={() => handleSearch()}>
                Search
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className='quote-summary-table-card'>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 15px', borderBottom: '1px solid #e3e4e6' }}>
          <div className='location-page-controls'>
            <span>Page size</span>
            <Select
              value={pageSize}
              aria-label='Quotes page size'
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
            <span>{totalPages > 0 ? `${activePage} of ${totalPages}` : "0 of 0"}</span>
            <Button
              aria-label='Next page'
              icon={<RightOutlined />}
              disabled={activePage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(Math.min(totalPages, activePage + 1))}
            />
          </div>
        </div>
        <Table<QuoteSummaryRecord>
          columns={columns}
          dataSource={paginatedQuotes}
          loading={loading}
          pagination={false}
          showSorterTooltip={false}
          scroll={{ x: 1145 }}
          locale={{
            emptyText: <Empty description='No quotes match your search.' />,
          }}
        />
        <div className='customer-location-footer'>
          <span>
            Showing {shownStart}-{shownEnd} of <strong>{totalCount}</strong>{" "}
            Quotes
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
              disabled={activePage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(Math.min(totalPages, activePage + 1))}>
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default QuoteSummary;
