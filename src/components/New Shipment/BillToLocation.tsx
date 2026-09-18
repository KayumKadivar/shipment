import React from 'react';
import { Card, Form, Input, Row, Col, Button, Select } from 'antd';
import CountrySelect from '../../components/CountrySelect';
import { usePostalLookup } from '../../hooks/usePostalLookup';

const BillToLocation: React.FC = () => {
  const [form] = Form.useForm();
  const { lookupPostal, loadingPostal } = usePostalLookup();

  const handlePostalBlur = async () => {
    const postal = form.getFieldValue("postal");
    const country = form.getFieldValue("country") || "USA";
    const result = await lookupPostal(postal, country);
    if (result) {
      form.setFieldsValue({
        city: result.city,
        state: result.state,
      });
    }
  };

  return (
    <Card 
      title="Bill To Location" 
      extra={<Button type="link" className="add-master-btn">+ Add to Master</Button>}
    >
      <Form layout="vertical" form={form} initialValues={{ country: "USA" }}>
        <Form.Item label="Company Name">
          <Input placeholder='Company Name' />
        </Form.Item>
        <Form.Item label="Address Line 1">
          <Input placeholder="Address Line 1" />
        </Form.Item>
        <Form.Item label="Address Line 2">
          <Input placeholder="Address Line 2" />
        </Form.Item>
        <Form.Item label="Country" name="country">
          <CountrySelect />
        </Form.Item>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <Form.Item label="Postal / ZIP" name="postal">
              <Input placeholder="ZIP" onBlur={handlePostalBlur} disabled={loadingPostal} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="City" name="city">
              <Input placeholder="City" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="State" name="state">
              <Input placeholder="ST" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Fax No">
          <Input placeholder="Fax No" />
        </Form.Item>
      </Form>
    </Card>
  );
};

export default BillToLocation;
