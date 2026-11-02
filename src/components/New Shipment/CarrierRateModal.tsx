import React, { useState, useMemo, useEffect } from 'react';
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
  actionLabel?: string;
}

const CarrierRateModal: React.FC<CarrierRateModalProps> = ({
  open,
  onClose,
  rates = [],
  loading = false,
  error = null,
  onSelectRate,
  selectedRateId,
 /* actionLabel,*/
}) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('rate-asc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeTab, setActiveTab] = useState<'valid' | 'error'>('valid');

  const isRateValid = (r: CarrierRate): boolean => (Number(r.price) || 0) > 0;

  const totalValidCount = useMemo(() => {
    return (rates || []).filter(isRateValid).length;
  }, [rates]);

  const totalErrorCount = useMemo(() => {
    return (rates || []).filter((r) => !isRateValid(r)).length;
  }, [rates]);

  useEffect(() => {
    if (open) {
      if (totalValidCount > 0) {
        setActiveTab('valid');
      } else if (totalErrorCount > 0) {
        setActiveTab('error');
      } else {
        setActiveTab('valid');
      }
    }
  }, [open, totalValidCount, totalErrorCount]);

  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  const filteredRates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rates || [];
    return (rates || []).filter((rate) =>
      [rate.name, rate.code, rate.service].some((val) =>
        (val || '').toLowerCase().includes(query)
      )
    );
  }, [rates, search]);

  const validRates = useMemo(() => {
    return filteredRates.filter(isRateValid);
  }, [filteredRates]);

  const errorRates = useMemo(() => {
    return filteredRates.filter((r) => !isRateValid(r));
  }, [filteredRates]);

  const displayValidCount = search.trim() ? validRates.length : totalValidCount;
  const displayErrorCount = search.trim() ? errorRates.length : totalErrorCount;

  const targetRates = activeTab === 'valid' ? validRates : errorRates;

  const visibleRates = useMemo(() => {
    return [...targetRates].sort((a, b) => {
      if (sortBy === 'rate-desc') return (Number(b.price) || 0) - (Number(a.price) || 0);
      if (sortBy === 'transit') {
        if (a.transitDays === b.transitDays) {
          return (Number(a.price) || 0) - (Number(b.price) || 0);
        }
        return (Number(a.transitDays) || 0) - (Number(b.transitDays) || 0);
      }
      return (Number(a.price) || 0) - (Number(b.price) || 0);
    });
  }, [targetRates, sortBy]);

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
                  LTL <span>{displayValidCount}</span>
                </button>
                {(totalErrorCount > 0 || search.trim()) && (
                  <button
                    type="button"
                    className={`rate-tab-with-error ${activeTab === 'error' ? 'active' : ''}`}
                    onClick={() => setActiveTab('error')}
                  >
                    With Error <span>{displayErrorCount}</span>
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
                Showing {visibleRates.length} of {activeTab === 'valid' ? displayValidCount : displayErrorCount} {activeTab === 'valid' ? 'carriers' : 'error carriers'}
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
                     /* actionLabel={actionLabel}*/
                    />
                  ))}
                </div>
              ) : (
                <Empty
                  description={
                    search.trim()
                      ? `No ${activeTab === 'valid' ? 'LTL' : 'error'} carriers match your search.`
                      : activeTab === 'valid'
                      ? 'No valid LTL carrier rates available.'
                      : 'No carriers with errors.'
                  }
                />
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
