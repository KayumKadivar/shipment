import { Table, Button, Space } from "antd";
import type { ColumnsType } from "antd/es/table";
import { 
  DownloadOutlined, 
  EditOutlined, 
  SendOutlined, 
  SyncOutlined,
  PlusOutlined
} from "@ant-design/icons";

interface DocumentRecord {
  key: string;
  type: string;
  filename: string;
  source: string;
  date: string;
}

const documentData: DocumentRecord[] = [];

function Document() {
  const columns: ColumnsType<DocumentRecord> = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (text, record) => (
        <span className="bol-cell">
          <strong>{text}</strong>
          <small>{record.filename}</small>
        </span>
      ),
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 150,
      render: (text) => <span className="cell-strong">{text}</span>,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 150,
      render: (text) => <span className="cell-strong">{text}</span>,
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      render: () => (
        <Space size="small">
          <Button size="small" type="text" icon={<DownloadOutlined className="cell-muted" />} />
          <Button size="small" type="text" icon={<EditOutlined className="cell-muted" />} />
        </Space>
      ),
    },
  ];

  return (
    <div className="shipments-page">
      <div className="shipments-header">
        <div />
        <div className="shipment-detail-actions">
          <Button icon={<SendOutlined />}>
            Send Doc(s)
          </Button>
          <Button icon={<SyncOutlined />}>
            Refresh
          </Button>
        </div>
      </div>
      
      <div className="shipment-table-card">
        <Table<DocumentRecord>
          columns={columns} 
          dataSource={documentData} 
          pagination={false} 
          rowSelection={{
            type: 'checkbox',
          }}
          rowClassName={() => 'shipment-clickable-row'}
        />
      </div>
      
      <div className="shipments-header">
        <div />
        <div className="shipment-detail-actions">
          <Button type="text" icon={<PlusOutlined />}>
            Add Document
          </Button>
        </div>                                            
      </div>
    </div>
  );
}

export default Document;
