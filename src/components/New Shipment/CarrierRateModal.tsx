import React, { useState, useMemo } from 'react';
import { Modal, Input, Select, Spin, Alert, Empty } from 'antd';
import { SearchOutlined, BarsOutlined, AppstoreOutlined } from '@ant-design/icons';
import { CarrierCard, type CarrierRate, type SortOption, type ViewMode } from '../../pages/Rate';

export interface CarrierRateModalProps {
  open: boolean;
  onClose: () => void;
  rates: CarrierRate[];
  loading: boolean;
  error?: string | null;
  onSelectRate: (rate: CarrierRate) => void;
  selectedRateId?: string;
}

const CarrierRateModal: React.FC<CarrierRateModalProps> = ({
  open,
  onClose,
  rates = [],
  loading = false,
  error = null,
  onSelectRate,
  selectedRateId,
}) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('rate-asc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeTab, setActiveTab] = useState<'valid' | 'error'>('valid');

  // Split rates into valid (price > 0 and no error warning) and error rates
  const { validRates, errorRates } = useMemo(() => {
    const valid: CarrierRate[] = [];
    const withError: CarrierRate[] = [];

    rates.forEach((r) => {
      if (r.warning || Number(r.price) <= 0) {
        withError.push(r);
      } else {
        valid.push(r);
      }
    });

    return { validRates: valid, errorRates: withError };
  }, [rates]);

  const targetRates = activeTab === 'valid' ? (validRates.length > 0 ? validRates : rates) : errorRates;

  const visibleRates = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = targetRates.filter((rate) =>
      [rate.name, rate.code, rate.service].some((val) =>
        (val || '').toLowerCase().includes(query)
      )
    );

    return [...filtered].sort((a, b) => {
      if (sortBy === 'rate-desc') return b.price - a.price;
      if (sortBy === 'transit') {
        if (a.transitDays === b.transitDays) return a.price - b.price;
        return a.transitDays - b.transitDays;
      }
      return a.price - b.price;
    });
  }, [targetRates, search, sortBy]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={1100}
      centered
      className="carrier-rate-modal"
      title={
        <div className="carrier-modal-title">
          <span className="carrier-modal-title-text">
            Quote Results
          </span>
          {!loading && rates.length > 0 && (
            <span className="carrier-modal-badge">
              {rates.length} {rates.length === 1 ? 'Carrier' : 'Carriers'}
            </span>
          )}
        </div>
      }
    >
      {error && (
        <Alert
          type="error"
          showIcon
          message="Rating API Error"
          description={error}
        />
      )}

      {loading ? (
        <div className="carrier-modal-loading">
          <Spin size="large" />
        </div>
      ) : (
        <>
          {rates.length > 0 && (
            <>
              {/* Tabs: LTL / With Error */}
              <div className="rate-mode-tabs carrier-modal-tabs">
                <button
                  type="button"
                  className={activeTab === 'valid' ? 'active' : ''}
                  onClick={() => setActiveTab('valid')}
                >
                  LTL <span>{validRates.length}</span>
                </button>
                {errorRates.length > 0 && (
                  <button
                    type="button"
                    className={`rate-tab-with-error ${activeTab === 'error' ? 'active' : ''}`}
                    onClick={() => setActiveTab('error')}
                  >
                    With Error <span>{errorRates.length}</span>
                  </button>
                )}
              </div>

              {/* Toolbar */}
              <div className="rate-toolbar carrier-modal-toolbar">
                <Input
                  value={search}
                  prefix={<SearchOutlined />}
                  placeholder="Carriers search"
                  allowClear
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Select<SortOption>
                  value={sortBy}
                  onChange={setSortBy}
                  options={[
                    { value: 'rate-asc', label: 'Sort by rate, low to high' },
                    { value: 'rate-desc', label: 'Sort by rate, high to low' },
                    { value: 'transit', label: 'Sort by transit time' },
                  ]}
                />
                <div
                  className="rate-view-switch carrier-modal-view-switch"
                  aria-label="Results view"
                >
                  <button
                    type="button"
                    className={viewMode === 'list' ? 'active' : ''}
                    onClick={() => setViewMode('list')}
                  >
                    <BarsOutlined /> List View
                  </button>
                  <button
                    type="button"
                    className={viewMode === 'grid' ? 'active' : ''}
                    onClick={() => setViewMode('grid')}
                  >
                    <AppstoreOutlined /> Grid View
                  </button>
                </div>
              </div>

              {/* Count */}
              <p className="rate-results-count carrier-modal-count">
                Showing {visibleRates.length} of {targetRates.length} carriers
              </p>

              {/* Cards list */}
              {visibleRates.length > 0 ? (
                <div className={`rate-carrier-list rate-carrier-list--${viewMode}`}>
                  {visibleRates.map((rate) => (
                    <CarrierCard
                      key={rate.id}
                      rate={rate}
                      checked={selectedRateId === rate.id}
                      onCheckedChange={() => onSelectRate(rate)}
                      onShipIt={() => onSelectRate(rate)}
                    />
                  ))}
                </div>
              ) : (
                <Empty description="No matching carrier rates found." />
              )}
            </>
          )}

          {!loading && rates.length === 0 && !error && (
            <Empty description="No carrier rates returned. Please check shipment and route details." />
          )}
        </>
      )}
    </Modal>
  );
};

export default CarrierRateModal;
