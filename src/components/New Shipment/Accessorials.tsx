import React, { useState } from 'react';
import { Card, Input, Checkbox, Row, Col, Form, Spin, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import type { RootState } from '../../app/store';

const Accessorials: React.FC = () => {
  const { data: accessorialsList, loading } = useSelector((state: RootState) => state.accessorials);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredList = accessorialsList.filter((item) => {
    const name = item.accessorialName || item.description || item.accesorialCode || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase().trim());
  });

  return (
    <Card 
      title="Accessorials" 
      className="accessorials-panel"
    >
      <Form.Item>
        <Input 
          placeholder="Search accessorials..." 
          prefix={<SearchOutlined />}
          value={searchTerm}
          allowClear
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Form.Item>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <Spin tip="Loading accessorials..." />
        </div>
      ) : filteredList.length === 0 ? (
        <Empty description="No accessorials found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Row gutter={[12, 12]}>
          {filteredList.map((item) => {
            return (
              <Col span={12} key={item.accessorialID}>
                <div>
                  <Checkbox value={item.accessorialID}>
                    {item.accessorialName || item.description || item.accesorialCode}
                  </Checkbox>
                </div>
              </Col>
            );
          })}
        </Row>
      )}
    </Card>
  );
};

export default Accessorials;
