import React, { useState, useMemo } from 'react';
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

  const selectedSet = useMemo(
    () => new Set(selectedAccessorialIds),
    [selectedAccessorialIds]
  );

  const { selectedList, unselectedList } = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const filtered = (accessorialsList || []).filter((item) => {
      const name = item.accessorialName || item.description || item.accesorialCode || '';
      return name.toLowerCase().includes(term);
    });

    const selected: typeof accessorialsList = [];
    const unselected: typeof accessorialsList = [];

    filtered.forEach((item) => {
      if (selectedSet.has(item.accessorialID)) {
        selected.push(item);
      } else {
        unselected.push(item);
      }
    });

    return { selectedList: selected, unselectedList: unselected };
  }, [accessorialsList, selectedSet, searchTerm]);

  const totalFilteredCount = selectedList.length + unselectedList.length;

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
      ) : totalFilteredCount === 0 ? (
        <Empty description="No accessorials found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="accessorials-list-container">
          {selectedList.length > 0 && (
            <div className="accessorials-selected-group">
              <Row gutter={[10, 4]}>
                {selectedList.map((item) => (
                  <Col span={12} key={item.accessorialID}>
                    <div className="accessorial-item-selected">
                      <Checkbox 
                        checked={true}
                        onChange={() => dispatch(toggleAccessorial(item.accessorialID))}
                      >
                        {item.accessorialName || item.description || item.accesorialCode}
                      </Checkbox>
                    </div>
                  </Col>
                ))}
              </Row>
              {unselectedList.length > 0 && <div className="accessorials-divider" />}
            </div>
          )}

          {unselectedList.length > 0 && (
            <Row gutter={[10, 4]}>
              {unselectedList.map((item) => (
                <Col span={12} key={item.accessorialID}>
                  <div>
                    <Checkbox 
                      checked={false}
                      onChange={() => dispatch(toggleAccessorial(item.accessorialID))}
                    >
                      {item.accessorialName || item.description || item.accesorialCode}
                    </Checkbox>
                  </div>
                </Col>
              ))}
            </Row>
          )}
        </div>
      )}
    </Card>
  );
};

export default Accessorials;
