import React from 'react';
import { Card, Form, Input, Row, Col, Button, Select } from 'antd';
import CountrySelect from '../../components/CountrySelect';
import { usePostalLookup } from '../../hooks/usePostalLookup';

const DestinationLocation: React.FC = () => {
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
      title="Destination Location" 
      extra={<Button type="link" className="add-master-btn add-line-btn">+ Add to Master</Button>}
    >
      <Form layout="vertical" form={form} initialValues={{ country: "USA" }}>
        <Form.Item label="Company Name">
          <Input placeholder="Company name" />
        </Form.Item>
        <Form.Item label="Address Line 1">
          <Input placeholder="Street address" />
        </Form.Item>
        <Form.Item label="Address Line 2">
          <Input placeholder="Suite, dock, etc." />
        </Form.Item>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={16}>
            <Form.Item label="Country" name="country">
              <CountrySelect />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Port">
              <Input placeholder="Port" />
            </Form.Item>
          </Col>
        </Row>
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
        <Form.Item label="Contact Name">
          <Input placeholder="Contact" />
        </Form.Item>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={16}>
            <Form.Item label="Phone">
              <Input placeholder="(___) ___-____" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item label="Ext">
              <Input placeholder="Ext" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Form.Item label="Email">
              <Input type="email" placeholder="email@company.com" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Fax">
              <Input placeholder="Fax No" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Form.Item label="Exp. Delivery Date">
              <Input placeholder="mm/dd/yyyy" />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="From">
              <Select defaultValue="08:00 AM">
                <Select.Option value="08:00 AM">8:00 AM</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="To">
              <Select defaultValue="05:00 PM">
                <Select.Option value="05:00 PM">5:00 PM</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Form.Item label="Delivery Date">
              <Input placeholder="mm/dd/yyyy" />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="From">
              <Select defaultValue="08:00 AM">
                <Select.Option value="08:00 AM">8:00 AM</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="To">
              <Select defaultValue="05:00 PM">
                <Select.Option value="05:00 PM">5:00 PM</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  );
};

export default DestinationLocation;
