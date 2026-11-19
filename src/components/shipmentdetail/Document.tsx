import { Table, Button, Alert } from "antd";
import type { ColumnsType } from "antd/es/table";
import { 
  SendOutlined, 
  SyncOutlined,
  // PlusOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useEffect, useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { fetchShipmentDocuments } from "../../store/shipmentDocumentSlice.ts";
import type { ShipmentDetails } from "../../types/shipment.types";

interface DocumentRecord {
  key: string;
  type: string;
  date: string;
  imageData?: string | null;
  imageType?: string | null;
  hasError?: boolean;
  errorMessage?: string | null;
}

export interface DocumentProps {
  shipment?: ShipmentDetails;
  loadNumber?: string;
  clientCode?: string;
}

/**
 * Converts a base64 encoded document (or URL) into a Blob and opens it in a new browser tab.
 */
function openDocumentInNewTab(base64OrUrl: string, imageType?: string | null) {
  if (!base64OrUrl) return;

  const trimmed = base64OrUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    window.open(trimmed, "_blank", "noopener,noreferrer");
    return;
  }

  try {
    const cleanBase64 = trimmed.includes("base64,")
      ? trimmed.split("base64,")[1]
      : trimmed;

    const byteCharacters = atob(cleanBase64.replace(/\s/g, ""));
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    let mimeType = "application/pdf";
    const lowerType = (imageType || "").toLowerCase();
    if (lowerType.includes("png")) {
      mimeType = "image/png";
    } else if (lowerType.includes("jpg") || lowerType.includes("jpeg")) {
      mimeType = "image/jpeg";
    } else if (lowerType.includes("pdf") || cleanBase64.startsWith("JVBERi")) {
      mimeType = "application/pdf";
    }

    const blob = new Blob([byteNumbers], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
  } catch (error) {
    console.error("Failed to open document:", error);
    const mime = imageType?.toLowerCase().includes("png")
      ? "image/png"
      : imageType?.toLowerCase().includes("jpg") || imageType?.toLowerCase().includes("jpeg")
      ? "image/jpeg"
      : "application/pdf";
    const dataUrl = trimmed.startsWith("data:") ? trimmed : `data:${mime};base64,${trimmed}`;
    const win = window.open();
    if (win) {
      win.document.write(
        `<iframe src="${dataUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
      );
    }
  }
}

/** Formats a date string into DD-MMM-YYYY (e.g. 13-Nov-2026). */
function formatDocumentDate(value?: string | null): string {
  if (!value) return "";
  const d = dayjs(value);
  if (!d.isValid()) return value;
  return d.format("DD-MMM-YYYY");
}

function Document({ shipment, loadNumber: propLoadNumber, clientCode: propClientCode }: DocumentProps = {}) {
  const { shipmentId } = useParams();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const appClientCode = useAppSelector((state) => state.app?.clientCode);

  const shipmentContext: unknown = location.state;
  const hasMatchingRowContext = shipmentContext !== null
    && typeof shipmentContext === "object"
    && "clientCode" in shipmentContext;
  const contextClientCode = hasMatchingRowContext && typeof (shipmentContext as any).clientCode === "string"
    ? (shipmentContext as any).clientCode.trim()
    : "";

  const resolvedLoadNumber = (propLoadNumber || shipment?.loadNumber || shipmentId || "").trim();
  const resolvedClientCode = (propClientCode || shipment?.clientCode || contextClientCode || appClientCode || "").trim();

  const { data, loading, error } = useAppSelector((state) => state.shipmentDocument);

  useEffect(() => {
    if (resolvedLoadNumber) {
      dispatch(fetchShipmentDocuments({
        loadNumber: resolvedLoadNumber,
        clientCode: resolvedClientCode,
      }));
    }
  }, [dispatch, resolvedLoadNumber, resolvedClientCode]);

  const handleRefresh = () => {
    if (resolvedLoadNumber) {
      dispatch(fetchShipmentDocuments({
        loadNumber: resolvedLoadNumber,
        clientCode: resolvedClientCode,
        force: true,
      }));
    }
  };

  const documentData = useMemo<DocumentRecord[]>(() => {
    if (!data) return [];

    const payload = data.data ?? data;

    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const records: DocumentRecord[] = [];
      const commonDate = formatDocumentDate(
        payload.dateRetrival || payload.dateRetrieval || shipment?.pickupdate
      );

      // BOL document row
      if (payload.bolImage || payload.hasErrorBOL === "N") {
        records.push({
          key: "bol",
          type: "BOL",
          date: commonDate,
          imageData: payload.bolImage || null,
          imageType: payload.imageType || "pdf",
          hasError: payload.hasErrorBOL === "Y",
          errorMessage: payload.errorMessageBOL,
        });
      }

      // POD document row
      if (payload.podImage || payload.hasErrorPOD === "N") {
        records.push({
          key: "pod",
          type: "POD",
          date: commonDate,
          imageData: payload.podImage || null,
          imageType: payload.imageType || "pdf",
          hasError: payload.hasErrorPOD === "Y",
          errorMessage: payload.errorMessagePOD,
        });
      }

      // LBL document row (if provided)
      if (payload.lblImage || payload.hasErrorLBL === "N") {
        records.push({
          key: "lbl",
          type: "LBL",
          date: commonDate,
          imageData: payload.lblImage || null,
          imageType: payload.imageType || "pdf",
          hasError: payload.hasErrorLBL === "Y",
          errorMessage: payload.errorMessageLBL,
        });
      }

      // Fallback for nested documents array if present
      const nestedList = payload.documents || payload.docList || payload.items;
      if (Array.isArray(nestedList)) {
        nestedList.forEach((item: any, index: number) => {
          records.push({
            key: String(item.id || item.documentId || `doc-${index}`),
            type: item.type || item.documentType || "Document",
            date: formatDocumentDate(item.date || item.dateRetrival || item.dateRetrieval) || commonDate,
            imageData: item.imageData || item.bolImage || item.url || item.image || null,
            imageType: item.imageType || payload.imageType || "pdf",
          });
        });
      }

      return records;
    }

    if (Array.isArray(payload)) {
      return payload.map((item: any, index: number) => ({
        key: String(item.id || item.documentId || index),
        type: item.type || item.documentType || (index === 0 ? "BOL" : "POD"),
        date: formatDocumentDate(item.date || item.dateRetrival || item.dateRetrieval || shipment?.pickupdate),
        imageData: item.imageData || item.bolImage || item.podImage || item.url || item.image || null,
        imageType: item.imageType || "pdf",
      }));
    }

    return [];
  }, [data, shipment?.pickupdate]);

  const columns: ColumnsType<DocumentRecord> = [
    {
      title: "TYPE",
      dataIndex: "type",
      key: "type",
      width: "30%",
      render: (text: string) => (
        <span style={{ fontWeight: 700, fontSize: "14px", color: "#111827" }}>
          {text}
        </span>
      ),
    },
    {
      title: "SOURCE",
      dataIndex: "source",
      key: "source",
      width: "40%",
      render: (_, record) => {
        if (!record.imageData) {
          return <span style={{ color: "#9ca3af" }}>Not Available</span>;
        }

        return (
          <a
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault();
              openDocumentInNewTab(record.imageData!, record.imageType);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openDocumentInNewTab(record.imageData!, record.imageType);
              }
            }}
            style={{
              color: "#1677ff",
              textDecoration: "underline",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            View Document ↗
          </a>
        );
      },
    },
    {
      title: "DATE",
      dataIndex: "date",
      key: "date",
      width: "30%",
      render: (text: string) => (
        <span style={{ color: "#111827", fontSize: "14px" }}>
          {text || "-"}
        </span>
      ),
    },
  ];

  return (
    <div className="shipments-page">
      {error && (
        <Alert
          type="error"
          message="Failed to load documents"
          description={error}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <div className="shipments-header">
        <div />
        <div className="shipment-detail-actions">
          <Button icon={<SendOutlined />}>
            Send Doc(s)
          </Button>
          <Button 
            icon={<SyncOutlined spin={loading} />} 
            loading={loading}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </div>
      </div>
      
      <div className="shipment-table-card">
        <Table<DocumentRecord>
          columns={columns} 
          dataSource={documentData} 
          loading={loading}
          pagination={false} 
          rowKey="key"
        />
      </div>
      
      {/* <div className="shipments-header">
        <div />
        <div className="shipment-detail-actions">
          <Button type="text" icon={<PlusOutlined />}>
            Add Document
          </Button>
        </div>                                            
      </div> */}
    </div>
  );
}

export default Document;
