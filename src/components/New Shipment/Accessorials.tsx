import React, { useState } from 'react';
import { Card, Input, Checkbox, Row, Col, Form, Spin, Empty, Button } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { toggleAccessorial, clearSelectedAccessorials } from '../../store/accessorialsSlice';
import './newshipment.css';

const Accessorials: React.FC = () => {
  const dispatch = useAppDispatch();
  const { data: accessorialsList, selectedAccessorialIds = [], loading } = useAppSelector(
    (state) => state.accessorials
  );
  const [searchTerm, setSearchTerm] = useState('');

  const filteredList = accessorialsList.filter((item) => {
    const name = item.accessorialName || item.description || item.accesorialCode || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase().trim());
  });

  return (
    <Card 
      title={
        <div className="accessorials-title-wrap">
          <span className="accessorials-title-text">Accessorials</span>
          {selectedAccessorialIds.length > 0 && (
            <span className="accessorials-count-tag">
              {selectedAccessorialIds.length}
            </span>
          )}
        </div>
      }
      extra={
        selectedAccessorialIds.length > 0 ? (
          <Button 
            type="link" 
            size="small" 
            danger 
            className="accessorials-clear-btn"
            onClick={() => dispatch(clearSelectedAccessorials())}
          >
            Clear all
          </Button>
        ) : null
      }
      className="accessorials-panel"
    >
      <Form.Item className="accessorials-search-item">
        <Input 
          placeholder="Search accessorials..." 
          prefix={<SearchOutlined />}
          value={searchTerm}
          allowClear
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Form.Item>

      {loading ? (
        <div className="accessorials-loading-wrap">
          <Spin tip="Loading accessorials..." />
        </div>
      ) : filteredList.length === 0 ? (
        <Empty description="No accessorials found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="accessorials-list-container">
          <Row gutter={[12, 12]}>
            {filteredList.map((item) => {
              const isChecked = selectedAccessorialIds.includes(item.accessorialID);
              return (
                <Col span={12} key={item.accessorialID}>
                  <div>
                    <Checkbox 
                      checked={isChecked}
                      onChange={() => dispatch(toggleAccessorial(item.accessorialID))}
                    >
                      {item.accessorialName || item.description || item.accesorialCode}
                    </Checkbox>
                  </div>
                </Col>
              );
            })}
          </Row>
        </div>
      )}
    </Card>
  );
};

export default Accessorials;
