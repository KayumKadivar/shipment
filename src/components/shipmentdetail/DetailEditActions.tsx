import {
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { Button } from "antd";

type DetailEditActionsProps = {
  label: string;
  isEditing: boolean;
  disabled: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
};

function DetailEditActions({
  label,
  isEditing,
  disabled,
  onEdit,
  onSave,
  onCancel,
}: DetailEditActionsProps) {
  return (
    <div className='shipment-detail-edit-actions'>
      {isEditing ? (
        <>
          <Button
            type='text'
            size='small'
            icon={<CheckOutlined />}
            aria-label={`Save ${label}`}
            title={`Save ${label}`}
            onClick={onSave}
          />
          <Button
            type='text'
            size='small'
            icon={<CloseOutlined />}
            aria-label={`Cancel ${label} editing`}
            title={`Cancel ${label} editing`}
            onClick={onCancel}
          />
        </>
      ) : (
        <Button
          type='text'
          size='small'
          icon={<EditOutlined />}
          aria-label={`Edit ${label}`}
          title={`Edit ${label}`}
          disabled={disabled}
          onClick={onEdit}
        />
      )}
    </div>
  );
}

export default DetailEditActions;
