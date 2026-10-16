import React, { useEffect } from 'react';
import { Card, Form, Input, Select, Row, Col, Checkbox } from 'antd';

export interface ShipmentInformationProps {
  initialData?: {
    serviceLevel?: string;
    customerRef?: string;
    mode?: string;
  };
  onChange?: (values: any) => void;
}

const ShipmentInformation: React.FC<ShipmentInformationProps> = ({ initialData, onChange }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (initialData) {
      form.setFieldsValue({
        serviceLevel: initialData.serviceLevel || "Standard",
        customerRef: initialData.customerRef || "",
        mode: initialData.mode || "LTL",
      });
    }
  }, [initialData, form]);

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
        onValuesChange={(_, all) => {
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
              <Select defaultValue="LTL">
                <Select.Option value="LTL">LTL</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12}>
            <Form.Item label="Service Level" name="serviceLevel">
              <Select defaultValue="Standard">
                <Select.Option value="Standard">Standard</Select.Option>
              </Select>
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
          <Select defaultValue="3rd Party Prep">
            <Select.Option value="3rd Party Prep">3rd Party Prep</Select.Option>
          </Select>
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

        <Form.Item name="sendCarrierPickupReq" valuePropName="checked" style={{ marginTop: 12, marginBottom: 0 }}>
          <Checkbox>Send Carrier Pickup Request</Checkbox>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default ShipmentInformation;
