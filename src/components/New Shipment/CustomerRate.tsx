import React from 'react';
import { Card, Form, Input, Select, Button, Row, Col, Checkbox, Spin } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../app/store';
import { fetchCarrierRates } from '../../store/customerRateSlice';

export interface CustomerRateProps {
  carrierData?: {
    carrierName?: string;
    carrierCode?: string;
    service?: string;
    price?: number;
    grossCharge?: number;
    discount?: number;
    fuelSurcharge?: number;
    accessorialCharges?: { accessorialDescription?: string; accessorialCharge?: number }[];
  };
}

const CustomerRate: React.FC<CustomerRateProps> = ({ carrierData }) => {
  const dispatch = useDispatch<AppDispatch>();
  const customerRate = useSelector((state: RootState) => state.customerRate);
  const { rates = [], loading = false } = customerRate || {};
  
  const netFreight = carrierData?.grossCharge != null
    ? (carrierData.grossCharge - (carrierData.discount || 0))
    : (carrierData?.price != null ? carrierData.price : ((customerRate as any).netFreight || 0));
  
  const fuelPercentage = carrierData?.fuelSurcharge != null
    ? carrierData.fuelSurcharge
    : ((customerRate as any).fuelPercentage || 0);
  
  const total = carrierData?.price != null
    ? carrierData.price
    : ((customerRate as any).total || 0);

  const handleRateClick = () => {
    dispatch(fetchCarrierRates({}));
  };

  return (
    <Card
      title="Customer Rate"
      className="customer-rate-panel"
      extra={<Checkbox>Auto Rate Buy</Checkbox>}
    >
      <Form layout="vertical" className="compact-form">

        {/* Row 1: Rate selector + Carrier input + Rate button */}
        <Row gutter={[12, 12]} className="mb-16">
          <Col xs={24} md={6}>
            <Form.Item noStyle>
              <Input placeholder="Carrier" value={carrierData?.carrierName || ""} readOnly={!!carrierData?.carrierName} />
            </Form.Item>
          </Col>
          <Col xs={24} md={14}>
            <div className="flex-align-center gap-8 text-muted-13">
              <span>Mark Up</span>
              <Input defaultValue="0" className="input-sm-center"/>
              <span>%</span>
              <div>
                <Form.Item noStyle>
                  <Input placeholder="Carrier" />
                </Form.Item>
              </div>
            </div>
          </Col>
          <Col xs={24} md={4}>
            <Button type="primary" className="btn-success w-100" onClick={handleRateClick} loading={loading}>Rate</Button>
          </Col>
        </Row>

        {/* Row 2: Get Top */}
        <Row gutter={[12, 12]} className="mb-16 flex-align-center">
          <Col>
            <span className="text-muted-13">Get Top</span>
          </Col>
          <Col>
            <Form.Item noStyle>
              <Input defaultValue="10" className="input-sm-center" />
            </Form.Item>
          </Col>
        </Row>

        {/* Row 3: Charge type + Amount + Add + Remove */}
        <Row gutter={[12, 12]} className="mb-16">
          <Col xs={24} md={12}>
            <Form.Item noStyle>
              <Select defaultValue="Charge type" className="w-100">
                <Select.Option value="Charge type">Charge type</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item noStyle>
              <Input placeholder="Amount" />
            </Form.Item>
          </Col>
          <Col xs={12} md={3}>
            <Button type="primary" className="btn-warning">Add</Button>
          </Col>
          <Col xs={12} md={3}>
            <Button danger className="w-100">Remove</Button>
          </Col>
        </Row>

      </Form>

      {/* Rate Table */}
      <div className="rate-table-wrapper">
        <div className="rate-table-content">
          <div className="rate-header-row">
            <div className="col-80">CODE</div>
            <div className="col-flex-1">DESCRIPTION</div>
            <div className="col-100 text-right">BUY AMOUNT</div>
            <div className="col-100 text-right">CUSTOMER AMOUNT</div>
          </div>
          {loading ? (
            <div className="rate-empty-state" style={{ padding: '20px' }}>
              <Spin tip="Fetching rates..." />
            </div>
          ) : carrierData ? (
            <>
              {carrierData.grossCharge != null && carrierData.grossCharge > 0 && (
                <div className="rate-header-row rate-item-row text-muted-13" style={{ backgroundColor: 'transparent', color: '#333' }}>
                  <div className="col-80">GROSS</div>
                  <div className="col-flex-1">Gross Charge</div>
                  <div className="col-100 text-right">${(0).toFixed(2)}</div>
                  <div className="col-100 text-right">${Number(carrierData.grossCharge).toFixed(2)}</div>
                </div>
              )}
              {carrierData.discount != null && carrierData.discount > 0 && (
                <div className="rate-header-row rate-item-row text-muted-13" style={{ backgroundColor: 'transparent', color: '#333' }}>
                  <div className="col-80">DISC</div>
                  <div className="col-flex-1">Discount</div>
                  <div className="col-100 text-right">${(0).toFixed(2)}</div>
                  <div className="col-100 text-right">-${Number(carrierData.discount).toFixed(2)}</div>
                </div>
              )}
              {carrierData.fuelSurcharge != null && carrierData.fuelSurcharge > 0 && (
                <div className="rate-header-row rate-item-row text-muted-13" style={{ backgroundColor: 'transparent', color: '#333' }}>
                  <div className="col-80">FUEL</div>
                  <div className="col-flex-1">Fuel Surcharge</div>
                  <div className="col-100 text-right">${(0).toFixed(2)}</div>
                  <div className="col-100 text-right">${Number(carrierData.fuelSurcharge).toFixed(2)}</div>
                </div>
              )}
              {(carrierData.accessorialCharges || []).map((charge, idx) => (
                <div key={idx} className="rate-header-row rate-item-row text-muted-13" style={{ backgroundColor: 'transparent', color: '#333' }}>
                  <div className="col-80">ACC</div>
                  <div className="col-flex-1">{charge.accessorialDescription || 'Accessorial'}</div>
                  <div className="col-100 text-right">${(0).toFixed(2)}</div>
                  <div className="col-100 text-right">${Number(charge.accessorialCharge || 0).toFixed(2)}</div>
                </div>
              ))}
              {(!carrierData.grossCharge && !carrierData.discount && !carrierData.fuelSurcharge && (!carrierData.accessorialCharges || carrierData.accessorialCharges.length === 0)) && (
                <div className="rate-header-row rate-item-row text-muted-13" style={{ backgroundColor: 'transparent', color: '#333' }}>
                  <div className="col-80">{carrierData.carrierCode || 'LTL'}</div>
                  <div className="col-flex-1">{carrierData.carrierName || 'Carrier Rate'} {carrierData.service ? `(${carrierData.service})` : ''}</div>
                  <div className="col-100 text-right">${(0).toFixed(2)}</div>
                  <div className="col-100 text-right">${Number(carrierData.price || 0).toFixed(2)}</div>
                </div>
              )}
            </>
          ) : rates.length > 0 ? (
            rates.map((rate) => (
              <div className="rate-header-row rate-item-row text-muted-13" key={rate.id} style={{ backgroundColor: 'transparent', color: '#333' }}>
                <div className="col-80">{rate.code}</div>
                <div className="col-flex-1">{rate.service || 'STANDARD'}</div>
                <div className="col-100 text-right">${(0).toFixed(2)}</div>
                <div className="col-100 text-right">${(rate.price || 0).toFixed(2)}</div>
              </div>
            ))
          ) : (
            <div className="rate-empty-state">
              No rates added yet. Click Rate to fetch carrier pricing.
            </div>
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="mt-16">
        <div className="flex-between mb-8 text-muted-13">
          <span>Net Freight</span>
          <strong className="text-dark-13">${netFreight.toFixed(2)}</strong>
        </div>
        <div className="flex-between mb-12 text-muted-13">
          <span>Fuel (%)</span>
          <strong className="text-dark-13">{fuelPercentage}%</strong>
        </div>
        <div className="flex-between mb-16 rate-total-row">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>

      
      </div>
    </Card>
  );
};

export default CustomerRate;
