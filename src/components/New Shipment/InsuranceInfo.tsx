import React from 'react';
import { Card, Form, Input, Select, Row, Col } from 'antd';
import { DownOutlined } from '@ant-design/icons';

export interface InsuranceInfoProps {
  onChange?: (values: any) => void;
}

const InsuranceInfo: React.FC<InsuranceInfoProps> = ({ onChange }) => {
  const [form] = Form.useForm();
  return (
    <Card
      title={
        <span>
          Shipment Information — Insurance / COD / Other{' '}
          <DownOutlined className="ns-insurance-icon" />
        </span>
      }
      className="insurance-panel"
    >
      <Form
        layout="vertical"
        form={form}
        initialValues={{ insuranceType: "None" }}
        onValuesChange={(_, all) => {
          if (onChange) onChange(all);
        }}
      >
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12}>
            <Form.Item label="Declared Value ($)" name="shipmentValue">
              <Input placeholder='Declared Value ($)'/>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="COD Amount ($)" name="codAmount">
              <Input placeholder='COD Amount ($)'/>
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12}>
            <Form.Item label="Insurance Type" name="insuranceType">
              <Select defaultValue="None" className="w-100">
                <Select.Option value="None">None</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="Special Instructions" name="specialInstructions">
              <Input placeholder="Instructions" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  );
};

export default InsuranceInfo;
