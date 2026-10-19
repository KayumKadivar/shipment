import React, { useEffect, useMemo } from 'react';
import { Card, Form, Input, Select, Row, Col, Checkbox } from 'antd';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { fetchEquipment } from '../../store/equipmentSlice';
import { fetchServiceLevel, type ServiceLevelItem } from '../../store/serviceLevelSlice';
import { fetchPaymentTerm } from '../../store/paymentTermSlice';

export interface OptionItem {
  value: string;
  label: string;
}

export interface ShipmentInformationProps {
  initialData?: {
    serviceLevel?: string;
    customerRef?: string;
    mode?: string;
    equipment?: string;
    paymentTerms?: string;
  };
  onChange?: (values: any) => void;
}

const ShipmentInformation: React.FC<ShipmentInformationProps> = ({ initialData, onChange }) => {
  const [form] = Form.useForm();
  const dispatch = useAppDispatch();
  const { data: equipmentList = [] as string[], loading: equipmentLoading } = useAppSelector(
    (state: any) => state.equipment || {}
  );
  const { data: serviceLevels = [] as ServiceLevelItem[], loading: serviceLevelLoading } = useAppSelector(
    (state: any) => state.serviceLevel || {}
  );
  const { data: paymentTermsList = [] as string[], loading: paymentTermsLoading } = useAppSelector(
    (state: any) => state.paymentTerm || {}
  );

  useEffect(() => {
    (dispatch as any)(fetchEquipment());
    (dispatch as any)(fetchServiceLevel());
    (dispatch as any)(fetchPaymentTerm());
  }, [dispatch]);

  useEffect(() => {
    if (initialData) {
      form.setFieldsValue({
        serviceLevel: initialData.serviceLevel || "Standard",
        customerRef: initialData.customerRef || "",
        mode: initialData.mode || "LTL",
        ...(initialData.equipment ? { equipment: initialData.equipment } : {}),
        ...(initialData.paymentTerms ? { paymentTerms: initialData.paymentTerms } : {}),
      });
    }
  }, [initialData, form]);

  useEffect(() => {
    if (equipmentList.length > 0) {
      const current = form.getFieldValue("equipment");
      if (!current) {
        const defaultVal = equipmentList.includes("LTL") ? "LTL" : equipmentList[0];
        form.setFieldValue("equipment", defaultVal);
        if (onChange) onChange(form.getFieldsValue());
      }
    }
  }, [equipmentList, form, onChange]);

  useEffect(() => {
    if (serviceLevels.length > 0) {
      const current = form.getFieldValue("serviceLevel");
      const currentStr = String(current ?? "").trim().toLowerCase();
      const matched = serviceLevels.find(
        (sl: ServiceLevelItem) =>
          sl.description?.trim().toLowerCase() === currentStr ||
          sl.serviceLevelCode?.trim().toLowerCase() === currentStr
      );
      if (matched) {
        const val = (matched.description || matched.serviceLevelCode || "").trim();
        if (val && val !== current) {
          form.setFieldValue("serviceLevel", val);
          if (onChange) onChange(form.getFieldsValue());
        }
      } else if (!current) {
        const defaultOption =
          serviceLevels.find(
            (sl: ServiceLevelItem) =>
              sl.description?.trim().toLowerCase() === "standard" ||
              sl.serviceLevelCode?.trim().toLowerCase() === "standard"
          ) || serviceLevels[0];
        const val = (defaultOption?.description || defaultOption?.serviceLevelCode || "Standard").trim();
        form.setFieldValue("serviceLevel", val);
        if (onChange) onChange(form.getFieldsValue());
      }
    }
  }, [serviceLevels, form, onChange]);

  useEffect(() => {
    if (paymentTermsList.length > 0) {
      const current = form.getFieldValue("paymentTerms");
      if (!current) {
        const defaultVal =
          paymentTermsList.find((p: string) => p.toLowerCase() === "3rd party prep") ||
          paymentTermsList[0];
        form.setFieldValue("paymentTerms", defaultVal);
        if (onChange) onChange(form.getFieldsValue());
      }
    }
  }, [paymentTermsList, form, onChange]);

  const equipmentOptions: OptionItem[] = useMemo(() => {
    if (!equipmentList || equipmentList.length === 0) {
      return [{ value: "LTL", label: "LTL" }];
    }
    return equipmentList.map((item: string): OptionItem => ({
      value: item,
      label: item,
    }));
  }, [equipmentList]);

  const serviceLevelOptions: OptionItem[] = useMemo(() => {
    if (!serviceLevels || serviceLevels.length === 0) {
      return [{ value: "Standard", label: "Standard" }];
    }
    return serviceLevels
      .map((item: ServiceLevelItem): OptionItem | null => {
        const text = (item.description || item.serviceLevelCode || "").trim();
        if (!text) return null;
        return {
          value: text,
          label: text,
        };
      })
      .filter((opt: OptionItem | null): opt is OptionItem => Boolean(opt));
  }, [serviceLevels]);

  const paymentTermOptions: OptionItem[] = useMemo(() => {
    if (!paymentTermsList || paymentTermsList.length === 0) {
      return [{ value: "3rd Party Prep", label: "3rd Party Prep" }];
    }
    return paymentTermsList.map((item: string): OptionItem => ({
      value: item,
      label: item,
    }));
  }, [paymentTermsList]);

  return (
    <Card 
      title="Shipment Information" 
      className="shipment-panel"
    >
      <Form
        layout="vertical"
        form={form}
        initialValues={{
          mode: "LTL",
          equipment: "LTL",
          serviceLevel: "Standard",
          priority: "Standard",
          paymentTerms: "3rd Party Prep",
          sendCarrierPickupReq: false,
        }}
        onValuesChange={(_: unknown, all: Record<string, unknown>) => {
          if (onChange) onChange(all);
        }}
      >
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12}>
            <Form.Item label="Mode" name="mode">
              <Select defaultValue="LTL">
                <Select.Option value="LTL">LTL</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="Equipment" name="equipment">
              <Select
                options={equipmentOptions}
                loading={equipmentLoading}
                placeholder="Select Equipment"
                showSearch
                filterOption={(input: string, option?: { label?: unknown; value?: unknown }) =>
                  String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>
        </Row>
        
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12}>
            <Form.Item label="Service Level" name="serviceLevel">
              <Select
                options={serviceLevelOptions}
                loading={serviceLevelLoading}
                placeholder="Select Service Level"
                showSearch
                filterOption={(input: string, option?: { label?: unknown; value?: unknown }) =>
                  String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="Priority" name="priority">
              <Select defaultValue="Standard">
                <Select.Option value="Standard">Standard</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Payment Term" name="paymentTerms">
          <Select
            options={paymentTermOptions}
            loading={paymentTermsLoading}
            placeholder="Select Payment Term"
            showSearch
            filterOption={(input: string, option?: { label?: unknown; value?: unknown }) =>
              String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <Form.Item label="Customer Reference #" name="customerRef">
          <Input placeholder="Customer ref #" />
        </Form.Item>

        <Form.Item label="Shipment Number" name="shipmentNumber">
          <Input placeholder="Auto-generated" />
        </Form.Item>

        <Form.Item label="Inland LD #" name="inlandLd">
          <Input placeholder="Inland LD #" />
        </Form.Item>

        <Form.Item label="PO #" name="poNumber">
          <Input placeholder="Purchase order #" />
        </Form.Item>

        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12}>
            <Form.Item label="Carrier Quote #" name="carrierQuoteNo">
              <Input placeholder="Quote #" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="Carrier BOL #" name="carrierBolNo">
              <Input placeholder="BOL #" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12}>
            <Form.Item label="PRO #" name="proNumber" className="mb-0">
              <Input placeholder="PRO #" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="Pickup #" name="pickupNo" className="mb-0">
              <Input placeholder="Pickup #" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="sendCarrierPickupReq"
          valuePropName="checked"
          className="send-carrier-pickup-item"
        >
          <Checkbox>Send Carrier Pickup Request</Checkbox>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default ShipmentInformation;
