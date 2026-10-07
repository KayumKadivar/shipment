import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setProductItems, addProductRow, removeProductRow, updateProductRow, setWeightUnit, type ProductItem } from '../../store/productSlice';
import { setSelectedAccessorials, fetchAccessorials } from '../../store/accessorialsSlice';
import {
  Button, Card, Input, Segmented, Checkbox, Select,
  Row, Col, Flex,
} from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { DownOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import './newshipment.css';
import OriginLocation from './OriginLocation';
import DestinationLocation from './DestinationLocation';
import ShipmentInformation from './ShipmentInformation';
import Accessorials from './Accessorials';
import CustomerRate from './CustomerRate';
import BillToLocation from './BillToLocation';
import InternalNotes from './InternalNotes';
import InsuranceInfo from './InsuranceInfo';

const handlingUnitOptions = ["Pallet", "Crate", "Carton", "Drum", "Piece", "Box"].map(
  (value) => ({ value, label: value })
);

const classOptions = [
  "50", "55", "60", "65", "70", "77.5", "85", "92.5", "100",
  "110", "125", "150", "175", "200", "250", "300", "400", "500",
].map((value) => ({ value, label: value }));

const NewShipment: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const location = useLocation();

  const prefillData = (location.state as any) || null;
  const quote = prefillData?.quote;
  const selectedCarrier = prefillData?.selectedCarrier;
  const reference = prefillData?.reference;

  const accessorialsList = useAppSelector((state) => state.accessorials.data);

  // Manage multiple product lines from Redux
  const items = useAppSelector((state) => state.product.items);
  const weightUnit = useAppSelector((state) => state.product.weightUnit);

  useEffect(() => {
    if (!accessorialsList || accessorialsList.length === 0) {
      dispatch(fetchAccessorials());
    }
  }, [accessorialsList, dispatch]);

  useEffect(() => {
    const productsSource = (quote?.quoteProducts && quote.quoteProducts.length > 0)
      ? quote.quoteProducts
      : (quote?.shipments && quote.shipments.length > 0 ? quote.shipments : null);

    if (productsSource && productsSource.length > 0) {
      const mapped: ProductItem[] = productsSource.map((p: any, idx: number) => {
        const rawPackage = String(p.packagingGroup || p.packageType || p.handlingUnit || "").trim();
        const matchedPackage = handlingUnitOptions.find(
          (opt) => opt.value.toLowerCase() === rawPackage.toLowerCase()
        );
        const packageType = matchedPackage ? matchedPackage.value : (rawPackage.toUpperCase() === "PLT" ? "Pallet" : rawPackage);

        const lengthVal = (p.length != null && p.length !== 0 && p.length !== "0") ? p.length : "";
        const widthVal = (p.width != null && p.width !== 0 && p.width !== "0") ? p.width : "";
        const heightVal = (p.height != null && p.height !== 0 && p.height !== "0") ? p.height : "";
        const weightVal = (p.weight != null && p.weight !== 0 && p.weight !== "0") ? p.weight : "";
        const pcfDensityVal = p.density ?? p.pcfDensity ?? "";

        return {
          id: String(p.quoteProductId ?? (idx + 1)),
          pallets: (p.pallets != null && p.pallets !== 0 && p.pallets !== "0") ? p.pallets : (p.units != null && p.units !== 0 ? p.units : (p.pieces != null && p.pieces !== 0 ? p.pieces : "")),
          pieces: (p.pieces != null && p.pieces !== 0 && p.pieces !== "0") ? p.pieces : (p.units != null && p.units !== 0 ? p.units : (p.pallets != null && p.pallets !== 0 ? p.pallets : "")),
          packageType: packageType,
          description: p.description || "",
          stackable: p.stackable ?? p.isStackable ?? false,
          hazmat: p.isHazmat ?? p.hazmat ?? p.hazMat ?? false,
          nmfc: p.productNMFC || p.nmfc || "",
          length: lengthVal,
          width: widthVal,
          height: heightVal,
          pcfDensity: pcfDensityVal,
          class: p.productClass ? String(p.productClass) : (p.class ? String(p.class) : (p.freightClass ? String(p.freightClass) : "")),
          weight: weightVal,
          hazmatClass: p.hazmatClass || p.hazMatClass || "",
          hazmatUN: p.hazmatUN || p.hazMatUN || "",
        };
      });
      dispatch(setProductItems(mapped));
    }
  }, [quote, dispatch]);

  useEffect(() => {
    if (quote?.quoteAccessorials && quote.quoteAccessorials.length > 0 && accessorialsList.length > 0) {
      const quoteAccCodes = quote.quoteAccessorials.map((a: any) => String(a.accCode || "").toUpperCase());
      const matched = accessorialsList
        .filter((item) => {
          const c = String(item.accesorialCode || "").toUpperCase();
          const n = String(item.accessorialName || "").toUpperCase();
          return quoteAccCodes.includes(c) || quoteAccCodes.includes(n);
        })
        .map((item) => item.accessorialID);
      if (matched.length > 0) {
        dispatch(setSelectedAccessorials(matched));
      }
    }
  }, [quote, accessorialsList, dispatch]);

  const originData = quote ? {
    postal: quote.originZip || "",
    city: quote.originCity || "",
    state: quote.originStateCode || "",
    country: quote.originCountry || "",
    pickupDate: quote.pickupDate ? new Date(quote.pickupDate).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : "",
  } : undefined;

  const destinationData = quote ? {
    companyName: "",
    postal: quote.destinationZip || "",
    city: quote.destinationCity || "",
    state: quote.destinationStateCode || "",
    country: quote.destinationCountry || "",
  } : undefined;

  const shipmentInfoData = {
    serviceLevel: selectedCarrier?.service || "",
    customerRef: String(reference || quote?.quoteRequestId || ""),
    mode: quote?.mode || "",
  };

  const carrierRateData = selectedCarrier ? {
    carrierName: selectedCarrier.name || "",
    carrierCode: selectedCarrier.code || "",
    service: selectedCarrier.service || "",
    price: selectedCarrier.price || 0,
    grossCharge: selectedCarrier.grossCharge || 0,
    discount: selectedCarrier.discount || 0,
    fuelSurcharge: selectedCarrier.fuelSurcharge || 0,
    accessorialCharges: selectedCarrier.accessorialCharges || [],
  } : undefined;

  const handleAddLine = () => {
    dispatch(addProductRow());
  };

  const handleRemoveLine = (idToRemove: string) => {
    if (items.length > 1) {
      dispatch(removeProductRow(idToRemove));
    }
  };

  const handleUpdateField = (id: string, field: keyof ProductItem, value: any) => {
    dispatch(updateProductRow({ id, field, value }));
  };

  const hasHazmat = items.some((i) => i.hazmat);
  const totalPallets = items.reduce((sum, item) => sum + (Number(item.pallets) || 0), 0);
  const totalPieces = items.reduce((sum, item) => sum + (Number(item.pieces) || 0), 0);
  const totalWeight = items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);

  return (
    <div className="new-shipment-container">

      {/* ── PAGE HEADER ── */}
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={16} className="ns-page-header">
        <div>
          <h1 className="ns-page-title">New Shipment</h1>
          <Flex align="center" gap={10} >
            <span>Client:</span>
            <strong>{quote?.clientName || ""}</strong>
            <span className='ns-credit-limit'>Credit limit: $0</span>
          </Flex>
        </div>
        <Flex gap={12}>
          <Button danger onClick={() => navigate('/shipments')}>Cancel</Button>
          <Button>Save Quote</Button>
          <Button type="primary" danger>Save Shipment</Button>
        </Flex>
      </Flex>

      {/* ══ Top Layout ══ */}
      <Row gutter={[16, 16]} align="stretch" className="ns-top-row">
        <Col xs={24} xl={16}>
          <Flex vertical gap={16} className="ns-left-col">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}><OriginLocation initialData={originData} /></Col>
              <Col xs={24} md={12}><DestinationLocation initialData={destinationData} /></Col>
            </Row>
            <Card
              title={
                <Flex align="center" gap={8}>
                  Notes <DownOutlined className="ns-notes-icon" />
                </Flex>
              }
              className="notes-panel"
            >
              <Input.TextArea
                placeholder="Add shipment notes, special instructions, or internal comments..."
                className="notes-textarea"
              />
            </Card>
          </Flex>
        </Col>

        <Col xs={24} xl={8}>
          <Flex vertical gap={16}>
            <ShipmentInformation initialData={shipmentInfoData} />
            <Accessorials />
          </Flex>
        </Col>
      </Row>

      {/* ══ Product Table ══ */}
      <Card
        title="Product"
        className="product-panel ns-product-card"
        extra={
          <Flex align="center" gap={8} className="ns-product-extra">
            <span>Weight Unit</span>
            <Segmented 
              options={['Lbs', 'Kgs']} 
              value={weightUnit} 
              onChange={(val) => dispatch(setWeightUnit(val as "Lbs" | "Kgs"))} 
            />
          </Flex>
        }
      >
        <div className="shipment-product-table">
          <div className={`shipment-product-table__head ${hasHazmat ? 'has-hazmat' : ''}`}>
            <span>Units</span>
            <span>Handling Unit</span>
            <span>Pieces</span>
            <span>Weight [{weightUnit.toLowerCase()}]</span>
            <span>Class</span>
            <span>Dimensions [in]</span>
            <span>PCF/Density</span>
            <span>NMFC</span>
            <span>Description</span>
            <span className="col-center">Stackable</span>
            <span className="col-center">Hazmat</span>
            {hasHazmat && (
              <>
                <span>Hazmat Class</span>
                <span>Hazmat UN</span>
              </>
            )}
            <span />
          </div>

          {items.map((item) => (
            <div key={item.id} className={`shipment-product-item-row ${hasHazmat ? 'has-hazmat' : ''}`}>
              <Input
                value={item.pallets ?? ''}
                onChange={(e) => handleUpdateField(item.id, 'pallets', e.target.value)}
              />
              <Select
                value={item.packageType || undefined}
                placeholder="Package"
                options={handlingUnitOptions}
                onChange={(val) => handleUpdateField(item.id, 'packageType', val)}
              />
              <Input
                value={item.pieces ?? ''}
                onChange={(e) => handleUpdateField(item.id, 'pieces', e.target.value)}
              />
              <Input
                value={item.weight ?? ''}
                onChange={(e) => handleUpdateField(item.id, 'weight', e.target.value)}
              />
              <Select
                value={item.class ? String(item.class) : undefined}
                placeholder="Class"
                options={classOptions}
                onChange={(val) => handleUpdateField(item.id, 'class', val)}
              />
              <div className="quote-item-combined quote-item-combined--dimensions">
                <Input
                  placeholder="L"
                  value={item.length ?? ''}
                  onChange={(e) => handleUpdateField(item.id, 'length', e.target.value)}
                />
                <Input
                  placeholder="W"
                  value={item.width ?? ''}
                  onChange={(e) => handleUpdateField(item.id, 'width', e.target.value)}
                />
                <Input
                  placeholder="H"
                  value={item.height ?? ''}
                  onChange={(e) => handleUpdateField(item.id, 'height', e.target.value)}
                />
              </div>
              <Input
                placeholder="PCF/Density"
                value={item.pcfDensity ?? ''}
                onChange={(e) => handleUpdateField(item.id, 'pcfDensity', e.target.value)}
              />
              <Input
                placeholder="NMFC"
                value={item.nmfc || ''}
                onChange={(e) => handleUpdateField(item.id, 'nmfc', e.target.value)}
              />
              <Input
                placeholder="Description"
                value={item.description || ''}
                onChange={(e) => handleUpdateField(item.id, 'description', e.target.value)}
              />
              <div className="col-center">
                <Checkbox
                  checked={item.stackable}
                  onChange={(e) => handleUpdateField(item.id, 'stackable', e.target.checked)}
                />
              </div>
              <div className="col-center">
                <Checkbox
                  checked={item.hazmat}
                  onChange={(e) => handleUpdateField(item.id, 'hazmat', e.target.checked)}
                />
              </div>
              {hasHazmat && (
                item.hazmat ? (
                  <>
                    <Input
                      placeholder="Class"
                      value={item.hazmatClass || ''}
                      onChange={(e) => handleUpdateField(item.id, 'hazmatClass', e.target.value)}
                    />
                    <Input
                      placeholder="UN"
                      value={item.hazmatUN || ''}
                      onChange={(e) => handleUpdateField(item.id, 'hazmatUN', e.target.value)}
                    />
                  </>
                ) : (
                  <>
                    <span />
                    <span />
                  </>
                )
              )}
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleRemoveLine(item.id)}
                disabled={items.length === 1}
              />
            </div>
          ))}

          <div className="shipment-product-summary-row">
            <div><span>Total Units:</span> <strong>{totalPallets}</strong></div>
            <div><span>Total Pieces:</span> <strong>{totalPieces}</strong></div>
            <div><span>Total Weight:</span> <strong>{totalWeight}</strong> {weightUnit.toLowerCase()}</div>
          </div>

          <div className="ns-add-line-wrap">
            <Button
              className="quote-add-item"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleAddLine}
            >
              Add Line
            </Button>
          </div>
        </div>
      </Card>

      {/* ══ Bottom 4-cell grid ══ */}
      <Row gutter={[16, 16]} align="stretch" className="ns-bottom-row">
        <Col xs={24} xl={16}><CustomerRate carrierData={carrierRateData} /></Col>
        <Col xs={24} xl={8}><BillToLocation /></Col>

        <Col xs={24} xl={16}><InsuranceInfo /></Col>

        <Col xs={24} xl={8} className="ns-internal-col">
          <InternalNotes />
        </Col>
      </Row>

      {/* ══ FOOTER BUTTONS ══ */}
      <Flex justify="flex-end" gap={12} wrap="wrap">
        <Button onClick={() => navigate('/shipments')} className="btn-outline">✕ Close</Button>
        <Button className="btn-outline">Save Quote</Button>
        <Button type="primary" danger>Save Shipment</Button>
      </Flex>

    </div>
  );
};

export default NewShipment;
