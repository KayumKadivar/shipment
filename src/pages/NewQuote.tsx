import {
  DeleteOutlined,
  PlusOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Button, Checkbox, Input, Select, AutoComplete, Spin, DatePicker, message, Form, Alert, Tooltip, Modal } from "antd";
import type { FormItemProps } from "antd";
import CountrySelect from "../components/CountrySelect";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { usePostalLookup } from "../hooks/usePostalLookup";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../app/hooks";
import type { AppDispatch } from "../app/store";
import { fetchAccessorials } from "../store/accessorialsSlice";
import { fetchCarrierRates, setQuoteFormData, clearQuoteFormData, clearRateError, type QuoteFormPackage } from "../store/customerRateSlice";
import { fetchClientsAndSubclients } from "../store/customerLocationSlice";
import { API_BASE_URL, SRV_TOKEN, DEFAULT_CLIENT_CODE } from "../config/apiConfig";
import axios from "axios";

type ItemField =
  | "units"
  | "handlingUnit"
  | "pieces"
  | "weight"
  | "weightUnit"
  | "freightClass"
  | "length"
  | "width"
  | "height"
  | "dimensionUnit"
  | "nmfc"
  | "description"
  | "hazMatClass"
  | "hazMatUN"
  | "hazMatProperShippingName"
  | "hazMatPackingGroup"
  | "hazMatPhone"
  | "hazMatContact";

type QuoteItem = Record<ItemField, string> & {
  id: string;
  stackable: boolean;
  hazMat: boolean;
};

type QuotePackage = {
  id: string;
  items: QuoteItem[];
};

let quoteEntityId = 0;

const createId = (prefix: string) => `${prefix}-${++quoteEntityId}`;

const createItem = (): QuoteItem => ({
  id: createId("item"),
  units: "",
  handlingUnit: "Pallet",
  pieces: "",
  weight: "",
  weightUnit: "lbs",
  freightClass: "50",
  length: "",
  width: "",
  height: "",
  dimensionUnit: "in.",
  nmfc: "",
  description: "",
  stackable: false,
  hazMat: false,
  hazMatClass: "",
  hazMatUN: "",
  hazMatProperShippingName: "",
  hazMatPackingGroup: "",
  hazMatPhone: "",
  hazMatContact: "",
});

const createPackage = (): QuotePackage => ({
  id: createId("package"),
  items: [createItem()],
});

const normalizePackages = (pkgs?: QuoteFormPackage[]): QuotePackage[] => {
  if (!pkgs || pkgs.length === 0) return [createPackage()];
  return pkgs.map((pkg) => ({
    id: pkg.id || createId("package"),
    items: (pkg.items || []).map((item) => ({
      ...createItem(),
      ...item,
      hazMatProperShippingName: item.hazMatProperShippingName ?? "",
      hazMatPackingGroup: item.hazMatPackingGroup ?? "",
      hazMatPhone: item.hazMatPhone ?? "",
      hazMatContact: item.hazMatContact ?? "",
    })),
  }));
};

const formatNMFC = (raw: string): string => {
  const cleaned = raw.replace(/[^\d-]/g, "");
  const digits = cleaned.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 6) {
    if (digits.length === 6 && cleaned.includes("-")) {
      return `${digits}-`;
    }
    return digits;
  }
  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}`;
};

const isValidNMFC = (val: string): boolean => {
  if (!val || val.trim() === "") return false;
  return /^\d{6}-\d{2}$/.test(val.trim());
};

const handlingUnitOptions = ["Pallet", "Crate", "Carton", "Drum", "Piece"].map(
  (value) => ({ value, label: value }),
);
const classOptions = [
  "50",
  "55",
  "60",
  "65",
  "70",
  "77.5",
  "85",
  "92.5",
  "100",
  "110",
  "125",
  "150",
  "175",
  "200",
  "250",
  "300",
  "400",
  "500",
].map((value) => ({ value, label: value }));

function QuoteLocationCard({
  title,
  zipLabel,
  postalName,
  countryName,
  dateName,
  includeDate = false,
  postal,
  setPostal,
  city,
  setCity,
  state,
  setState,
  country,
  setCountry,
  date,
  setDate,
  form,
}: {
  title: string;
  zipLabel: string;
  postalName: string;
  countryName: string;
  dateName?: string;
  includeDate?: boolean;
  postal: string;
  setPostal: (val: string) => void;
  city?: string;
  setCity: (val: string) => void;
  state?: string;
  setState: (val: string) => void;
  country: string;
  setCountry: (val: string) => void;
  date?: string | null;
  setDate?: (val: string | null) => void;
  form: any;
}) {
  const { searchPostals, loadingPostal } = usePostalLookup();
  const zipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postalRef = useRef(postal);
  const [postalOptions, setPostalOptions] = useState<{ value: string; label: string; city: string; state: string; key: string }[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isFocusedRef = useRef(false);

  const handleSearchPostal = (value: string) => {
    if (zipTimeoutRef.current) clearTimeout(zipTimeoutRef.current);
    const searchVal = value.split(' - ')[0];
    if (searchVal.length >= 3) {
      zipTimeoutRef.current = setTimeout(async () => {
        const results = await searchPostals(searchVal, country);
        
        if (results && results.length === 1) {
          const full = `${results[0].postalCode || searchVal} - ${results[0].city}, ${results[0].state}`;
          setPostal(full);
          setCity(results[0].city);
          setState(results[0].state);
          form.setFieldsValue({ [postalName]: full });
          form.validateFields([postalName]).catch(() => {});
          setPostalOptions([]);
          setDropdownOpen(false);
        } else if (results && results.length > 1) {
          const uniqueResults = Array.from(new Set(results.map(r => `${r.postalCode || searchVal}|${r.city}|${r.state}`)))
            .map(str => {
              const [p, c, s] = str.split('|');
              return { postalCode: p, city: c, state: s };
            });
          setPostalOptions(
            uniqueResults.map((r, idx) => ({
              value: `${r.postalCode} - ${r.city}, ${r.state}`,
              label: `${r.postalCode} - ${r.city}, ${r.state}`,
              city: r.city,
              state: r.state,
              key: `postal-${idx}`
            }))
          );
          if (isFocusedRef.current) {
            setDropdownOpen(true);
          }
        } else {
          setPostalOptions([]);
          setDropdownOpen(false);
        }
      }, 600);
    } else {
      setPostalOptions([]);
      setDropdownOpen(false);
    }
  };

  const handleSelectPostal = (value: string, option: { city: string; state: string }) => {
    setPostal(value);
    setCity(option.city);
    setState(option.state);
    form.setFieldsValue({ [postalName]: value });
    form.validateFields([postalName]).catch(() => {});
    setDropdownOpen(false);
  };

  const handlePostalBlur = async () => {
    isFocusedRef.current = false;
    const val = postalRef.current;
    if (!val) return;
    const searchVal = val.split(' - ')[0];
    if (searchVal.length < 3) return;
    if (zipTimeoutRef.current) clearTimeout(zipTimeoutRef.current);
    const results = await searchPostals(searchVal, country);
    if (results && results.length === 1) {
      const full = `${results[0].postalCode || searchVal} - ${results[0].city}, ${results[0].state}`;
      setPostal(full);
      setCity(results[0].city);
      setState(results[0].state);
      form.setFieldsValue({ [postalName]: full });
      form.validateFields([postalName]).catch(() => {});
      setPostalOptions([]);
      setDropdownOpen(false);
    } else if (results && results.length > 1) {
      const uniqueResults = Array.from(new Set(results.map(r => `${r.postalCode || searchVal}|${r.city}|${r.state}`)))
        .map(str => {
          const [p, c, s] = str.split('|');
          return { postalCode: p, city: c, state: s };
        });
      setPostalOptions(
        uniqueResults.map((r, idx) => ({
          value: `${r.postalCode} - ${r.city}, ${r.state}`,
          label: `${r.postalCode} - ${r.city}, ${r.state}`,
          city: r.city,
          state: r.state,
          key: `postal-${idx}`
        }))
      );
    }
  };

  return (
    <section className='new-quote-card quote-location-card'>
      <header className='new-quote-card__header'>
        <h2>{title}</h2>
        <Button size='small' icon={<TeamOutlined />}>
          Address Book
        </Button>
      </header>
      <div className='quote-location-card__body'>
        {includeDate ? (
          <Form.Item
            className='new-quote-field quote-location-card__date'
            label='Pickup Date'
            name={dateName || 'pickupDate'}
            required
            rules={[{ required: true, message: 'Pickup Date is required' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="MM-DD-YYYY"
              aria-label='Pickup date'
              value={date ? dayjs(date) : null}
              onChange={(d) => {
                const val = d ? d.format("YYYY-MM-DD") : null;
                setDate?.(val);
                form.setFieldsValue({ [dateName || 'pickupDate']: d });
                form.validateFields([dateName || 'pickupDate']).catch(() => {});
              }}
            />
          </Form.Item>
        ) : null}
        <Form.Item
          className='new-quote-field'
          label={zipLabel}
          name={postalName}
          required
          rules={[
            { required: true, message: `${zipLabel} is required` },
            {
              validator: (_, value) => {
                if (!value || String(value).trim() === "") {
                  return Promise.resolve();
                }
                const clean = String(value).split(" - ")[0].trim();
                if (clean.length < 3) {
                  return Promise.reject(new Error(`${zipLabel} must be at least 3 digits`));
                }
                if (!city || !state) {
                  return Promise.reject(new Error("Please select location from dropdown"));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <AutoComplete
            value={postal}
            options={postalOptions}
            onSearch={handleSearchPostal}
            onSelect={handleSelectPostal}
            onChange={(val) => {
              setPostal(val);
              postalRef.current = val;
              form.setFieldsValue({ [postalName]: val });
            }}
            onFocus={() => {
              isFocusedRef.current = true;
              if (postalOptions.length > 0) {
                setDropdownOpen(true);
              }
            }}
            onBlur={handlePostalBlur}
            disabled={loadingPostal}
            notFoundContent={loadingPostal ? <Spin size="small" /> : null}
            open={dropdownOpen}
            onDropdownVisibleChange={(visible) => setDropdownOpen(visible)}
          />
        </Form.Item>

        <Form.Item
          className='new-quote-field'
          label='Country'
          name={countryName}
          required
          rules={[{ required: true, message: 'Country is required' }]}
        >
          <CountrySelect
            className='quote-country-select'
            value={country}
            onChange={(val: string) => {
              setCountry(val);
              form.setFieldsValue({ [countryName]: val });
              form.validateFields([countryName]).catch(() => {});
            }}
            aria-label={`${title} country`}
          />
        </Form.Item>
      </div>
    </section>
  );
}

interface ItemTooltipWrapperProps {
  children?: any;
  [key: string]: any;
}

const ItemTooltipWrapper: React.FC<ItemTooltipWrapperProps> = ({
  children,
  ...fieldProps
}) => {
  const { status, errors } = Form.Item.useStatus();
  const hasError = status === "error" && Boolean(errors && errors.length > 0);
  const errorMessage = hasError ? (errors[0] as string) : "";
  const validChild = React.isValidElement(children) ? (children as React.ReactElement<any>) : null;
  const childProps = (validChild ? validChild.props : {}) as Record<string, any>;

  return (
    <Tooltip
      title={hasError ? errorMessage : ""}
      open={hasError ? undefined : false}
      placement="top"
      trigger={["hover", "focus"]}
      color="#df2027"
      rootClassName="quote-item-error-tooltip"
      overlayClassName="quote-item-error-tooltip"
      arrow={{ pointAtCenter: true }}
    >
      <div className="quote-item-tooltip-wrapper">
        {validChild
          ? React.cloneElement(validChild, {
              ...fieldProps,
              ...childProps,
              status: status || fieldProps.status || childProps.status,
              onChange: (...args: any[]) => {
                childProps.onChange?.(...args);
                fieldProps.onChange?.(...args);
              },
              onBlur: (...args: any[]) => {
                childProps.onBlur?.(...args);
                fieldProps.onBlur?.(...args);
              },
              onFocus: (...args: any[]) => {
                childProps.onFocus?.(...args);
                fieldProps.onFocus?.(...args);
              },
            })
          : children}
      </div>
    </Tooltip>
  );
};

const ItemFormItem: React.FC<FormItemProps> = ({
  children,
  className,
  ...restProps
}) => {
  return (
    <Form.Item
      {...restProps}
      className={`quote-item-input ${className || ""}`}
    >
      <ItemTooltipWrapper>
        {children}
      </ItemTooltipWrapper>
    </Form.Item>
  );
};

function NewQuote() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [form] = Form.useForm();
  const quoteFormData = useAppSelector((state) => state.customerRate.quoteFormData);

  const [packages, setPackages] = useState<QuotePackage[]>(() =>
    quoteFormData?.packages && quoteFormData.packages.length > 0
      ? normalizePackages(quoteFormData.packages)
      : [createPackage()]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [accessorialSearch, setAccessorialSearch] = useState("");
  const [selectedAccessorials, setSelectedAccessorials] = useState<string[]>(
    () => quoteFormData?.selectedAccessorials || []
  );
  
  const { data: accessorialOptions } = useAppSelector((state) => state.accessorials);
  const profileCode = useAppSelector((state) => state.app.profileCode);
  const { clients } = useAppSelector((state) => state.customerLocation);
  const rateLoading = useAppSelector((state) => state.customerRate.loading);

  const [selectedClientCode, setSelectedClientCode] = useState<string>(
    () => quoteFormData?.selectedClientCode || sessionStorage.getItem("quotes_selectedClientCode") || sessionStorage.getItem("customerLocation_selectedClientCode") || ""
  );

  useEffect(() => {
    dispatch(clearRateError());
    return () => {
      dispatch(clearRateError());
    };
  }, [dispatch]);

  const [origPostal, setOrigPostal] = useState(() => quoteFormData?.origPostal || "");
  const [origCity, setOrigCity] = useState(() => quoteFormData?.origCity || "");
  const [origState, setOrigState] = useState(() => quoteFormData?.origState || "");
  const [origCountry, setOrigCountry] = useState(() => quoteFormData?.origCountry || "USA");
  const [pickupDate, setPickupDate] = useState<string | null>(
    () => quoteFormData?.pickupDate || dayjs().format("YYYY-MM-DD")
  );

  const [destPostal, setDestPostal] = useState(() => quoteFormData?.destPostal || "");
  const [destCity, setDestCity] = useState(() => quoteFormData?.destCity || "");
  const [destState, setDestState] = useState(() => quoteFormData?.destState || "");
  const [destCountry, setDestCountry] = useState(() => quoteFormData?.destCountry || "USA");

  useEffect(() => {
    dispatch(fetchAccessorials());
    dispatch(fetchClientsAndSubclients());
  }, [dispatch]);

  const activeClientCode = clients.some(
    (client) => client.clientCode === selectedClientCode,
  )
    ? selectedClientCode
    : clients.find((client) => client.clientCode === DEFAULT_CLIENT_CODE)
        ?.clientCode || clients[0]?.clientCode || "";

  const handleClientChange = (value: string) => {
    setSelectedClientCode(value);
    sessionStorage.setItem("quotes_selectedClientCode", value);
    sessionStorage.setItem("customerLocation_selectedClientCode", value);
  };

  const [productOptions, setProductOptions] = useState<
    { value: string; key: string; product: any; label: React.ReactNode }[]
  >([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const searchProductTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProducts = async (query = "") => {
    setLoadingProducts(true);
    try {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        accept: "application/json, text/plain, */*",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const clientCodeToUse =
        selectedClientCode ||
        sessionStorage.getItem("quotes_selectedClientCode") ||
        sessionStorage.getItem("customerLocation_selectedClientCode") ||
        DEFAULT_CLIENT_CODE ||
        "DEVTS";

      const payload = {
        clientCode: clientCodeToUse,
        searchText: query || "",
        pageNumber: 1,
        pageSize: 100,
      };

      console.log("Calling SearchProducts API:", payload);

      const response = await axios.post(
        `${API_BASE_URL}/Product/SearchProducts`,
        payload,
        { headers }
      );

      console.log("SearchProducts API response:", response.data);

      let dataList: any[] = [];
      if (response.data?.isSuccess && response.data?.data) {
        const raw = response.data.data;
        dataList = Array.isArray(raw) ? raw : (raw.items || []);
      }

      if (dataList.length > 0) {
        const options = dataList.map((prod: any, idx: number) => {
          const prodDesc = prod.productDescription || prod.description || "";
          const subtext = [
            prod.productClass ? `Class: ${prod.productClass}` : "",
            prod.productNMFC ? `NMFC: ${prod.productNMFC}` : "",
            prod.weight ? `${prod.weight} lbs` : "",
            prod.commodity || "",
          ]
            .filter(Boolean)
            .join(" | ");

          return {
            value: prodDesc,
            key: `prod-opt-${prod.productId || idx}-${idx}`,
            product: prod,
            label: (
              <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "2px 0" }}>
                <span style={{ fontWeight: 600, color: "#1f2937", fontSize: 12 }}>
                  {prodDesc || "Unnamed Product"}
                </span>
                {subtext && (
                  <span style={{ fontSize: 11, color: "#808080" }}>
                    {subtext}
                  </span>
                )}
              </div>
            ),
          };
        });
        setProductOptions(options);
      } else {
        setProductOptions([]);
      }
    } catch (error) {
      console.error("Error calling SearchProducts API for description:", error);
      setProductOptions([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchProducts("");
  }, [selectedClientCode]);

  const handleSearchProducts = (searchText: string) => {
    if (searchProductTimeoutRef.current) {
      clearTimeout(searchProductTimeoutRef.current);
    }

    const trimmed = (searchText || "").trim();

    searchProductTimeoutRef.current = setTimeout(() => {
      fetchProducts(trimmed);
    }, 350);
  };

  useEffect(() => {
    if (quoteFormData) {
      if (quoteFormData.packages && quoteFormData.packages.length > 0) {
        setPackages(normalizePackages(quoteFormData.packages));
      }
      if (quoteFormData.origPostal !== undefined) setOrigPostal(quoteFormData.origPostal);
      if (quoteFormData.origCity !== undefined) setOrigCity(quoteFormData.origCity);
      if (quoteFormData.origState !== undefined) setOrigState(quoteFormData.origState);
      if (quoteFormData.origCountry !== undefined) setOrigCountry(quoteFormData.origCountry);
      if (quoteFormData.destPostal !== undefined) setDestPostal(quoteFormData.destPostal);
      if (quoteFormData.destCity !== undefined) setDestCity(quoteFormData.destCity);
      if (quoteFormData.destState !== undefined) setDestState(quoteFormData.destState);
      if (quoteFormData.destCountry !== undefined) setDestCountry(quoteFormData.destCountry);
      if (quoteFormData.pickupDate !== undefined) setPickupDate(quoteFormData.pickupDate);
      if (quoteFormData.selectedAccessorials !== undefined) {
        setSelectedAccessorials(quoteFormData.selectedAccessorials);
      }
      if (quoteFormData.selectedClientCode !== undefined) {
        setSelectedClientCode(quoteFormData.selectedClientCode);
      }

      const itemsMap: Record<string, any> = {};
      (quoteFormData.packages || packages).forEach((pkg) => {
        pkg.items?.forEach((item: any) => {
          itemsMap[item.id] = {
            units: item.units,
            handlingUnit: item.handlingUnit,
            pieces: item.pieces,
            weight: item.weight,
            freightClass: item.freightClass,
            length: item.length,
            width: item.width,
            height: item.height,
            nmfc: item.nmfc,
            description: item.description,
            hazMatClass: item.hazMatClass,
            hazMatUN: item.hazMatUN,
          };
        });
      });

      form.setFieldsValue({
        pickupDate: quoteFormData.pickupDate ? dayjs(quoteFormData.pickupDate) : (pickupDate ? dayjs(pickupDate) : undefined),
        origPostal: quoteFormData.origPostal ?? origPostal,
        origCountry: quoteFormData.origCountry ?? origCountry,
        destPostal: quoteFormData.destPostal ?? destPostal,
        destCountry: quoteFormData.destCountry ?? destCountry,
        items: itemsMap,
      });
    }
  }, [quoteFormData, form]);

  // Initial population of form values
  useEffect(() => {
    const itemsMap: Record<string, any> = {};
    packages.forEach((pkg) => {
      pkg.items.forEach((item) => {
        itemsMap[item.id] = {
          units: item.units,
          handlingUnit: item.handlingUnit,
          pieces: item.pieces,
          weight: item.weight,
          freightClass: item.freightClass,
          length: item.length,
          width: item.width,
          height: item.height,
          nmfc: item.nmfc,
          description: item.description,
          hazMatClass: item.hazMatClass,
          hazMatUN: item.hazMatUN,
        };
      });
    });

    form.setFieldsValue({
      pickupDate: pickupDate ? dayjs(pickupDate) : undefined,
      origPostal,
      origCountry,
      destPostal,
      destCountry,
      items: itemsMap,
    });
  }, []);

  const visibleAccessorials = useMemo(() => {
    const query = accessorialSearch.trim().toLowerCase();
    const options = accessorialOptions.map((a) => a.accessorialName);
    return query
      ? options.filter((option) =>
          option.toLowerCase().includes(query),
        )
      : options;
  }, [accessorialSearch, accessorialOptions]);

  const [isHazmatModalOpen, setIsHazmatModalOpen] = useState(false);
  const [activeHazmatPackageId, setActiveHazmatPackageId] = useState<string | null>(null);
  const [activeHazmatItem, setActiveHazmatItem] = useState<QuoteItem | null>(null);
  const [hazmatForm, setHazmatForm] = useState({
    hazMatUN: "",
    hazMatProperShippingName: "",
    hazMatClass: "",
    hazMatPackingGroup: "",
    hazMatPhone: "",
    hazMatContact: "",
  });

  const handleOpenHazmatModal = (packageId: string, item: QuoteItem) => {
    setActiveHazmatPackageId(packageId);
    setActiveHazmatItem(item);
    setHazmatForm({
      hazMatUN: item.hazMatUN || "",
      hazMatProperShippingName: item.hazMatProperShippingName || "",
      hazMatClass: item.hazMatClass || "",
      hazMatPackingGroup: item.hazMatPackingGroup || "",
      hazMatPhone: item.hazMatPhone || "",
      hazMatContact: item.hazMatContact || "",
    });
    setIsHazmatModalOpen(true);
  };

  const handleHazmatModalOk = () => {
    if (activeHazmatPackageId && activeHazmatItem) {
      updateItemHazmat(activeHazmatPackageId, activeHazmatItem.id, {
        hazMat: true,
        hazMatUN: hazmatForm.hazMatUN,
        hazMatProperShippingName: hazmatForm.hazMatProperShippingName,
        hazMatClass: hazmatForm.hazMatClass,
        hazMatPackingGroup: hazmatForm.hazMatPackingGroup,
        hazMatPhone: hazmatForm.hazMatPhone,
        hazMatContact: hazmatForm.hazMatContact,
      });
    }
    setIsHazmatModalOpen(false);
    setActiveHazmatPackageId(null);
    setActiveHazmatItem(null);
  };

  const handleHazmatModalCancel = () => {
    setIsHazmatModalOpen(false);
    setActiveHazmatPackageId(null);
    setActiveHazmatItem(null);
  };

  const updateItemHazmat = (
    packageId: string,
    itemId: string,
    hazmatData: {
      hazMat: boolean;
      hazMatUN: string;
      hazMatProperShippingName: string;
      hazMatClass: string;
      hazMatPackingGroup: string;
      hazMatPhone: string;
      hazMatContact: string;
    }
  ) => {
    setPackages((current) =>
      current.map((quotePackage) =>
        quotePackage.id === packageId
          ? {
              ...quotePackage,
              items: quotePackage.items.map((item) => {
                if (item.id !== itemId) return item;
                return {
                  ...item,
                  hazMat: hazmatData.hazMat,
                  stackable: hazmatData.hazMat ? false : item.stackable,
                  hazMatUN: hazmatData.hazMatUN,
                  hazMatProperShippingName: hazmatData.hazMatProperShippingName,
                  hazMatClass: hazmatData.hazMatClass,
                  hazMatPackingGroup: hazmatData.hazMatPackingGroup,
                  hazMatPhone: hazmatData.hazMatPhone,
                  hazMatContact: hazmatData.hazMatContact,
                };
              }),
            }
          : quotePackage
      )
    );
  };

  const updateItem = (
    packageId: string,
    itemId: string,
    field: keyof QuoteItem,
    value: string | boolean,
  ) => {
    setPackages((current) =>
      current.map((quotePackage) =>
        quotePackage.id === packageId
          ? {
              ...quotePackage,
              items: quotePackage.items.map((item) => {
                if (item.id !== itemId) return item;
                if (field === "stackable") {
                  const isStackable = Boolean(value);
                  return {
                    ...item,
                    stackable: isStackable,
                    hazMat: isStackable ? false : item.hazMat,
                    hazMatClass: isStackable ? "" : item.hazMatClass,
                    hazMatUN: isStackable ? "" : item.hazMatUN,
                    hazMatProperShippingName: isStackable ? "" : item.hazMatProperShippingName,
                    hazMatPackingGroup: isStackable ? "" : item.hazMatPackingGroup,
                    hazMatPhone: isStackable ? "" : item.hazMatPhone,
                    hazMatContact: isStackable ? "" : item.hazMatContact,
                  };
                }
                return { ...item, [field]: value };
              }),
            }
          : quotePackage,
      ),
    );

    if (typeof value === "string") {
      form.setFieldValue(["items", itemId, field], value);
      form.validateFields([["items", itemId, field]]).catch(() => {});
    }
  };

  const addItem = (packageId: string) => {
    const newItem = createItem();
    setPackages((current) =>
      current.map((quotePackage) =>
        quotePackage.id === packageId
          ? { ...quotePackage, items: [...quotePackage.items, newItem] }
          : quotePackage,
      ),
    );
    form.setFieldValue(["items", newItem.id], {
      units: newItem.units,
      handlingUnit: newItem.handlingUnit,
      pieces: newItem.pieces,
      weight: newItem.weight,
      freightClass: newItem.freightClass,
      nmfc: newItem.nmfc,
      description: newItem.description,
    });
  };

  const removeItem = (packageId: string, itemId: string) => {
    setPackages((current) => {
      const targetPackage = current.find(
        (quotePackage) => quotePackage.id === packageId,
      );
      if (!targetPackage) return current;

      if (targetPackage.items.length > 1) {
        return current.map((quotePackage) =>
          quotePackage.id === packageId
            ? {
                ...quotePackage,
                items: quotePackage.items.filter((item) => item.id !== itemId),
              }
            : quotePackage,
        );
      }

      if (current.length > 1) {
        return current.filter((quotePackage) => quotePackage.id !== packageId);
      }

      return current;
    });

    const currentItems = form.getFieldValue("items") || {};
    const newItems = { ...currentItems };
    delete newItems[itemId];
    form.setFieldsValue({ items: newItems });
  };

  const isOnlyItem = packages.length === 1 && packages[0].items.length === 1;

  const handleSeeRates = async () => {
    try {
      await form.validateFields();
    } catch (errorInfo) {
      console.log('Form validation failed:', errorInfo);
      const firstError = document.querySelector('.ant-form-item-has-error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const inputToFocus = firstError.querySelector('input, .ant-select-selector') as HTMLElement;
        if (inputToFocus) {
          inputToFocus.focus();
        }
      }
      return;
    }

    if (!packages || packages.length === 0 || !packages.some((p) => p.items.length > 0)) {
      message.error("Please add at least one item before rating.");
      return;
    }

    const payload = {
      serviceToken: SRV_TOKEN,
      origZip: origPostal.split(' - ')[0],
      origCity: origCity,
      origState: origState,
      origCountry: origCountry,
      destZip: destPostal.split(' - ')[0],
      destCity: destCity,
      destState: destState,
      destCountry: destCountry,
      shipments: packages.flatMap((p) =>
        p.items.map((i) => ({
          class: i.freightClass,
          weight: Number(i.weight) || 0,
          weightUnit: i.weightUnit,
          units: Number(i.units) || 0,
          cubicFeet: 0,
          hazMat: i.hazMat,
          hazMatClass: i.hazMatClass || undefined,
          hazMatUN: i.hazMatUN || undefined,
          hazMatProperShippingName: i.hazMatProperShippingName || undefined,
          hazMatPackingGroup: i.hazMatPackingGroup || undefined,
          hazMatPhone: i.hazMatPhone || undefined,
          hazMatContact: i.hazMatContact || undefined,
          nmfc: i.nmfc || undefined,
          description: i.description || "Freight",
          pallets: i.handlingUnit === "Pallet" ? Number(i.units) || 0 : 0,
          pieces: Number(i.pieces) || 0,
          length: Number(i.length) || 0,
          width: Number(i.width) || 0,
          height: Number(i.height) || 0,
          packageType: i.handlingUnit,
          linearFeet: 0,
          stackable: i.stackable,
        }))
      ),
      accessorialCodes: accessorialOptions
        .filter((a) => selectedAccessorials.includes(a.accessorialName))
        .map((a) => a.accesorialCode || a.accessorialName),
      profileCode: profileCode,
      clientCode: DEFAULT_CLIENT_CODE,
      clientName: clients.find((c) => c.clientCode === DEFAULT_CLIENT_CODE)?.clientName || "",
      scac: undefined,
      shipmentDate: pickupDate || new Date().toISOString(),
      zoneCode: undefined,
      miles: 0,
      isBatch: false,
      serviceLevelCode: undefined,
      route: undefined,
      clientResponseUrl: undefined,
      requestId: undefined,
      clientToken: undefined,
      mode: "LTL",
      isRateApiOnly: false,
      getBenchMarkCost: false,
      resultCount: 0,
      totalLength: 0,
      totalWidth: 0,
      totalHeight: 0,
      isAudit: false,
      shipmentValue: 0,
      equipment: undefined,
      codAmount: 0,
      totalLinearFeet: 0,
    };

    dispatch(
      setQuoteFormData({
        origPostal,
        origCity,
        origState,
        origCountry,
        pickupDate,
        destPostal,
        destCity,
        destState,
        destCountry,
        packages,
        selectedAccessorials,
        selectedClientCode: activeClientCode,
      })
    );

    console.log("Saving API Request Payload:", payload);
    setIsSubmitting(true);
    setApiError(null);

    try {
      const resultAction = await dispatch(fetchCarrierRates(payload));

      if (fetchCarrierRates.fulfilled.match(resultAction)) {
        const rates = resultAction.payload;
        if (!rates || rates.length === 0) {
          const noRatesMsg = "No carrier rates returned from the API for the selected route. Please check shipment and location details.";
          setApiError(noRatesMsg);
          message.error(noRatesMsg);
          return;
        }
        navigate("/quotes/rate");
      } else if (fetchCarrierRates.rejected.match(resultAction)) {
        const errText =
          (resultAction.payload as string) ||
          resultAction.error?.message ||
          "Failed to fetch rates from backend API.";
        setApiError(errText);
        message.error(errText);
      }
    } catch (err: any) {
      const errorText =
        err?.response?.data?.message ||
        err?.message ||
        "An unexpected error occurred while communicating with the server.";
      setApiError(errorText);
      message.error(errorText);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelQuote = () => {
    setApiError(null);
    dispatch(clearQuoteFormData());
    const freshItem = createItem();
    const freshPkg = { id: createId("package"), items: [freshItem] };
    setPackages([freshPkg]);
    setSelectedAccessorials([]);
    setOrigPostal("");
    setOrigCity("");
    setOrigState("");
    setOrigCountry("USA");
    setDestPostal("");
    setDestCity("");
    setDestState("");
    setDestCountry("USA");
    const today = dayjs().format("YYYY-MM-DD");
    setPickupDate(today);
    form.resetFields();
    form.setFieldsValue({
      pickupDate: dayjs(today),
      origPostal: "",
      origCountry: "USA",
      destPostal: "",
      destCountry: "USA",
      items: {
        [freshItem.id]: {
          units: "",
          handlingUnit: freshItem.handlingUnit,
          pieces: "",
          weight: "",
          freightClass: freshItem.freightClass,
          nmfc: "",
          description: "",
        }
      }
    });
  };

  return (
    <div className='new-quote-scroll'>
      <Spin
        fullscreen
        spinning={isSubmitting}
        size="large"
        className="ns-fullscreen-spin "
      />
      <Form
        form={form}
        layout='vertical'
        colon={false}
        requiredMark={(label, { required }) => (
          <span>
            {label}
            {required && <span className='quote-required-star'> *</span>}
          </span>
        )}
        scrollToFirstError
        onFinish={handleSeeRates}
        className='new-quote-form'
      >
        <section className='new-quote-page'>
          <div className='new-quote-page__topline'>
            <div className='new-quote-page__top-left'>
              <button className='new-quote-back' type='button' onClick={() => navigate("/quote-summary")}>
                &larr; All Quotes
              </button>
              <div className='location-client-row quote-client-dropdown'>
                <span>Client:</span>
                <Select
                  showSearch
                  allowClear
                  placeholder='Search or select client...'
                  value={selectedClientCode || undefined}
                  onChange={handleClientChange}
                  style={{ minWidth: 260 }}
                  filterOption={(input, option) =>
                    String((option as any)?.searchValue || "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={clients.map((client) => ({
                    label: (
                      <span>
                        <UserOutlined style={{ marginRight: 8 }} />
                        {client.clientName}
                      </span>
                    ),
                    value: client.clientCode,
                    searchValue: `${client.clientName} ${client.clientCode}`,
                  }))}
                  loading={clients.length === 0}
                />
              </div>
            </div>
            <div className='new-quote-page__top-actions'>
              <Button danger onClick={handleCancelQuote}>Cancel Quote</Button>
            </div>
          </div>

          {apiError && (
            <div className="quote-error-message">
              <Alert
                type='error'
                showIcon
                closable
                message='Rating API Error'
                description={apiError}
                onClose={() => setApiError(null)}

              />
            </div>
          )}

          <div className='new-quote-layout'>
            <main className='new-quote-main'>
              <div className='new-quote-location-grid'>
                <QuoteLocationCard
                  title='Pickup'
                  zipLabel='Pickup Zip Code'
                  includeDate
                  postalName='origPostal'
                  countryName='origCountry'
                  dateName='pickupDate'
                  postal={origPostal}
                  setPostal={setOrigPostal}
                  city={origCity}
                  setCity={setOrigCity}
                  state={origState}
                  setState={setOrigState}
                  country={origCountry}
                  setCountry={setOrigCountry}
                  date={pickupDate}
                  setDate={setPickupDate}
                  form={form}
                />
                <QuoteLocationCard
                  title='Destination'
                  zipLabel='Dest. Zip Code'
                  postalName='destPostal'
                  countryName='destCountry'
                  postal={destPostal}
                  setPostal={setDestPostal}
                  city={destCity}
                  setCity={setDestCity}
                  state={destState}
                  setState={setDestState}
                  country={destCountry}
                  setCountry={setDestCountry}
                  form={form}
                />
              </div>
            </main>

            <aside className='new-quote-aside'>
              <section className='new-quote-card quote-accessorial-card'>
                <header className='new-quote-card__header'>
                  <h2>Accessorials</h2>
                </header>
                <Input
                  className='quote-accessorial-search'
                  value={accessorialSearch}
                  placeholder='Search accessorials...'
                  allowClear
                  onChange={(event) => setAccessorialSearch(event.target.value)}
                />
                <div className='quote-accessorial-list'>
                  {visibleAccessorials.map((option) => {
                    const checked = selectedAccessorials.includes(option);
                    return (
                      <label className={checked ? "is-checked" : ""} key={option}>
                        <Checkbox
                          checked={checked}
                          onChange={(event) =>
                            setSelectedAccessorials((current) =>
                              event.target.checked
                               ? [...current, option]
                                : current.filter((value) => value !== option),
                            )
                          }>
                          {option}
                        </Checkbox>
                      </label>
                    );
                  })}
                </div>
              </section>
            </aside>
          </div>

          <div className='new-quote-packages'>
            {packages.map((quotePackage) => (
              <section
                className='new-quote-card quote-items-card'
                key={quotePackage.id}>
                <header className='new-quote-card__header quote-items-card__header'>
                  <h2>Items</h2>
                  <div className='quote-item-flags'>
                    <Button size='small' icon={<TeamOutlined />}>
                      Inventory
                    </Button>
                  </div>
                </header>

                <div className='quote-items-table'>
                  <div className='quote-items-table__head' aria-hidden='true'>
                    <span>Description</span>
                    <span>Units <span className='required'>*</span></span>
                    <span>Handling Unit <span className='required'>*</span></span>
                    <span>Pieces <span className='required'>*</span></span>
                    <span>Weight [lbs] <span className='required'>*</span></span>
                    <span>Class <span className='required'>*</span></span>
                    <span>Dimensions [inches]</span>
                    <span>NMFC <span className='required'>*</span></span>
                    <span>Stackable</span>
                    <span>Hazmat</span>
                    <span />
                  </div>

                  {quotePackage.items.map((item) => (
                    <div className='quote-item-row' key={item.id}>
                      <AutoComplete
                        value={item.description}
                        options={productOptions}
                        placeholder='Description'
                        aria-label='Description'
                        onSearch={handleSearchProducts}
                        onFocus={() => {
                          if (productOptions.length === 0) {
                            fetchProducts("");
                          }
                        }}
                        onChange={(value) => {
                          updateItem(
                            quotePackage.id,
                            item.id,
                            "description",
                            value,
                          );
                          form.setFieldValue(["items", item.id, "description"], value);
                        }}
                        onSelect={(value, option) => {
                          updateItem(
                            quotePackage.id,
                            item.id,
                            "description",
                            value,
                          );
                          form.setFieldValue(["items", item.id, "description"], value);

                          const prod = (option as any)?.product;
                          if (prod) {
                            if (prod.productClass) {
                              updateItem(quotePackage.id, item.id, "freightClass", String(prod.productClass));
                              form.setFieldValue(["items", item.id, "freightClass"], String(prod.productClass));
                            }
                            if (prod.productNMFC) {
                              updateItem(quotePackage.id, item.id, "nmfc", String(prod.productNMFC));
                              form.setFieldValue(["items", item.id, "nmfc"], String(prod.productNMFC));
                            }
                            if (prod.weight) {
                              updateItem(quotePackage.id, item.id, "weight", String(prod.weight));
                              form.setFieldValue(["items", item.id, "weight"], String(prod.weight));
                            }
                            if (prod.length) {
                              updateItem(quotePackage.id, item.id, "length", String(prod.length));
                              form.setFieldValue(["items", item.id, "length"], String(prod.length));
                            }
                            if (prod.width) {
                              updateItem(quotePackage.id, item.id, "width", String(prod.width));
                              form.setFieldValue(["items", item.id, "width"], String(prod.width));
                            }
                            if (prod.height) {
                              updateItem(quotePackage.id, item.id, "height", String(prod.height));
                              form.setFieldValue(["items", item.id, "height"], String(prod.height));
                            }
                            if (prod.isHazmat || prod.hazmat) {
                              updateItem(quotePackage.id, item.id, "hazMat", true);
                              form.setFieldValue(["items", item.id, "hazMat"], true);
                            }
                          }
                        }}
                        notFoundContent={loadingProducts ? <div style={{ padding: '6px 12px', textAlign: 'center' }}><Spin size="small" /></div> : undefined}
                        className="quote-item-autocomplete"
                      >
                        <Input
                          placeholder="Description"
                          aria-label="Description"
                          allowClear
                        />
                      </AutoComplete>

                      <ItemFormItem
                        name={['items', item.id, 'units']}
                        rules={[
                          { required: true, message: "Units is required" },
                          {
                            validator: (_, val) => {
                              if (val !== undefined && val !== "" && (isNaN(Number(val)) || Number(val) <= 0)) {
                                return Promise.reject(new Error("Must be > 0"));
                              }
                              return Promise.resolve();
                            },
                          },
                        ]}
                      >
                        <Input
                          value={item.units}
                          aria-label='Units'
                          onChange={(event) =>
                            updateItem(
                              quotePackage.id,
                              item.id,
                              "units",
                              event.target.value,
                            )
                          }
                        />
                      </ItemFormItem>

                      <ItemFormItem
                        name={['items', item.id, 'handlingUnit']}
                        rules={[{ required: true, message: "Handling unit is required" }]}
                      >
                        <Select
                          value={item.handlingUnit}
                          options={handlingUnitOptions}
                          aria-label='Handling unit'
                          onChange={(value) =>
                            updateItem(
                              quotePackage.id,
                              item.id,
                              "handlingUnit",
                              value,
                            )
                          }
                        />
                      </ItemFormItem>

                      <ItemFormItem
                        name={['items', item.id, 'pieces']}
                        rules={[
                          { required: true, message: "Pieces is required" },
                          {
                            validator: (_, val) => {
                              if (val !== undefined && val !== "" && (isNaN(Number(val)) || Number(val) <= 0)) {
                                return Promise.reject(new Error("Must be > 0"));
                              }
                              return Promise.resolve();
                            },
                          },
                        ]}
                      >
                        <Input
                          value={item.pieces}
                          aria-label='Pieces'
                          onChange={(event) =>
                            updateItem(
                              quotePackage.id,
                              item.id,
                              "pieces",
                              event.target.value,
                            )
                          }
                        />
                      </ItemFormItem>

                      <ItemFormItem
                        name={['items', item.id, 'weight']}
                        rules={[
                          { required: true, message: "Weight is required" },
                          {
                            validator: (_, val) => {
                              if (val !== undefined && val !== "" && (isNaN(Number(val)) || Number(val) <= 0)) {
                                return Promise.reject(new Error("Must be > 0"));
                              }
                              return Promise.resolve();
                            },
                          },
                        ]}
                      >
                        <Input
                          value={item.weight}
                          aria-label='Weight [lbs]'
                          onChange={(event) =>
                            updateItem(
                              quotePackage.id,
                              item.id,
                              "weight",
                              event.target.value,
                            )
                          }
                        />
                      </ItemFormItem>

                      <ItemFormItem
                        name={['items', item.id, 'freightClass']}
                        rules={[{ required: true, message: "Class is required" }]}
                      >
                        <Select
                          value={item.freightClass}
                          options={classOptions}
                          aria-label='Freight class'
                          onChange={(value) =>
                            updateItem(
                              quotePackage.id,
                              item.id,
                              "freightClass",
                              value,
                            )
                          }
                        />
                      </ItemFormItem>

                      <div className='quote-item-combined quote-item-combined--dimensions'>
                        <Input
                          value={item.length}
                          placeholder='L'
                          aria-label='Length'
                          onChange={(event) =>
                            updateItem(
                              quotePackage.id,
                              item.id,
                              "length",
                              event.target.value,
                            )
                          }
                        />
                        <Input
                          value={item.width}
                          placeholder='W'
                          aria-label='Width'
                          onChange={(event) =>
                            updateItem(
                              quotePackage.id,
                              item.id,
                              "width",
                              event.target.value,
                            )
                          }
                        />
                        <Input
                          value={item.height}
                          placeholder='H'
                          aria-label='Height'
                          onChange={(event) =>
                            updateItem(
                              quotePackage.id,
                              item.id,
                              "height",
                              event.target.value,
                            )
                          }
                        />
                      </div>

                      <ItemFormItem
                        name={['items', item.id, 'nmfc']}
                        normalize={(value) => formatNMFC(value || "")}
                        rules={[
                          { required: true, message: "NMFC is required" },
                          {
                            validator: (_, value) =>
                              !value || isValidNMFC(value)
                                ? Promise.resolve()
                                : Promise.reject(
                                    new Error("NMFC must be XXXXXX-XX")
                                  ),
                          },
                        ]}
                      >
                        <Input
                          value={item.nmfc}
                          maxLength={9}
                          placeholder='XXXXXX-XX'
                          aria-label='NMFC'
                          onChange={(event) =>
                            updateItem(
                              quotePackage.id,
                              item.id,
                              "nmfc",
                              formatNMFC(event.target.value),
                            )
                          }
                        />
                      </ItemFormItem>

                      <Checkbox
                        checked={item.stackable}
                        aria-label='Stackable'
                        onChange={(event) =>
                          updateItem(
                            quotePackage.id,
                            item.id,
                            "stackable",
                            event.target.checked,
                          )
                        }
                      />

                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Checkbox
                          checked={item.hazMat}
                          aria-label='Hazmat'
                          onChange={(event) => {
                            if (event.target.checked) {
                              handleOpenHazmatModal(quotePackage.id, item);
                            } else {
                              updateItemHazmat(quotePackage.id, item.id, {
                                hazMat: false,
                                hazMatUN: "",
                                hazMatProperShippingName: "",
                                hazMatClass: "",
                                hazMatPackingGroup: "",
                                hazMatPhone: "",
                                hazMatContact: "",
                              });
                            }
                          }}
                        />
                        {item.hazMat && (
                          <span
                            style={{
                              fontSize: 11,
                              color: "#c9302c",
                              cursor: "pointer",
                              fontWeight: 600,
                              textDecoration: "underline",
                            }}
                            onClick={() => handleOpenHazmatModal(quotePackage.id, item)}
                          >
                            Edit
                          </span>
                        )}
                      </div>

                      <Button
                        type='text'
                        danger
                        icon={<DeleteOutlined />}
                        disabled={isOnlyItem}
                        aria-label='Delete item'
                        title={
                          isOnlyItem
                            ? "At least one item is required"
                            : "Delete item"
                        }
                        onClick={() => removeItem(quotePackage.id, item.id)}
                      />
                    </div>
                  ))}
                </div>

                <Button
                  className='quote-add-item'
                  size='small'
                  icon={<PlusOutlined />}
                  onClick={() => addItem(quotePackage.id)}>
                  Add Item
                </Button>
              </section>
            ))}
          </div>

          <div className='new-quote-rate-actions'>
            <Button
              type='primary'
              htmlType='submit'
              loading={isSubmitting || rateLoading}
            >
              See Rates
            </Button>
          </div>
        </section>

        <Modal
          title="Hazmat Details"
          open={isHazmatModalOpen}
          onCancel={handleHazmatModalCancel}
          centered
          width={500}
          footer={[
            <Button key="ok" type="primary" danger onClick={handleHazmatModalOk}>
              OK
            </Button>,
          ]}
        >
          <div style={{ paddingTop: 16 }}>
            <Form layout="horizontal" labelCol={{ span: 11 }} wrapperCol={{ span: 13 }} labelAlign="left">
              <Form.Item label="HAZMAT UN/NA#" style={{ marginBottom: 12 }}>
                <Input
                  value={hazmatForm.hazMatUN}
                  onChange={(e) => setHazmatForm((prev) => ({ ...prev, hazMatUN: e.target.value }))}
                  placeholder="HAZMAT UN/NA#"
                  autoFocus
                />
              </Form.Item>
              <Form.Item label="Hazmat Proper Shipping Name" style={{ marginBottom: 12 }}>
                <Input
                  value={hazmatForm.hazMatProperShippingName}
                  onChange={(e) => setHazmatForm((prev) => ({ ...prev, hazMatProperShippingName: e.target.value }))}
                  placeholder="Hazmat Proper Shipping Name"
                />
              </Form.Item>
              <Form.Item label="Hazmat Class" style={{ marginBottom: 12 }}>
                <Input
                  value={hazmatForm.hazMatClass}
                  onChange={(e) => setHazmatForm((prev) => ({ ...prev, hazMatClass: e.target.value }))}
                  placeholder="Hazmat Class"
                />
              </Form.Item>
              <Form.Item label="Hazmat Packing Group" style={{ marginBottom: 12 }}>
                <Input
                  value={hazmatForm.hazMatPackingGroup}
                  onChange={(e) => setHazmatForm((prev) => ({ ...prev, hazMatPackingGroup: e.target.value }))}
                  placeholder="Hazmat Packing Group"
                />
              </Form.Item>
              <Form.Item label="Hazmat Phone" style={{ marginBottom: 12 }}>
                <Input
                  value={hazmatForm.hazMatPhone}
                  onChange={(e) => setHazmatForm((prev) => ({ ...prev, hazMatPhone: e.target.value }))}
                  placeholder="Hazmat Phone"
                />
              </Form.Item>
              <Form.Item label="Hazmat Contact" style={{ marginBottom: 4 }}>
                <Input
                  value={hazmatForm.hazMatContact}
                  onChange={(e) => setHazmatForm((prev) => ({ ...prev, hazMatContact: e.target.value }))}
                  placeholder="Hazmat Contact"
                />
              </Form.Item>
            </Form>
          </div>
        </Modal>
      </Form>
    </div>
  );
}

export default NewQuote;
