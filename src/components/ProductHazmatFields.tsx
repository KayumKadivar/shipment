import { Form, Input } from "antd";

/** Controls visibility without unregistering retained product hazmat values. */
interface ProductHazmatFieldsProps {
  /** Whether the product's hazardous-material details are visible. */
  visible: boolean;
}

/** Renders the six optional product hazmat details using the Quotes labels and order. */
export default function ProductHazmatFields({ visible }: ProductHazmatFieldsProps) {
  return (
    <div hidden={!visible}>
      <Form.Item label='HAZMAT UN/NA#' name='hazmatUN'
        rules={[{ max: 50, message: "Use 50 characters or fewer" }]}>
        <Input placeholder='HAZMAT UN/NA#' />
      </Form.Item>
      <Form.Item label='Hazmat Proper Shipping Name' name='hazmatProperShippingName'>
        <Input placeholder='Hazmat Proper Shipping Name' />
      </Form.Item>
      <Form.Item label='Hazmat Class' name='hazmatClass'
        rules={[{ max: 50, message: "Use 50 characters or fewer" }]}>
        <Input placeholder='Hazmat Class' />
      </Form.Item>
      <Form.Item label='Hazmat Packing Group' name='hazmatGroup'>
        <Input placeholder='Hazmat Packing Group' />
      </Form.Item>
      <Form.Item label='Hazmat Phone' name='hazmatPhone'>
        <Input placeholder='Hazmat Phone' />
      </Form.Item>
      <Form.Item label='Hazmat Contact' name='hazmatContact'>
        <Input placeholder='Hazmat Contact' />
      </Form.Item>
    </div>
  );
}
