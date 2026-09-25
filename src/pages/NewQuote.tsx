import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Button, Checkbox, Input, Select, AutoComplete, Spin, DatePicker, message } from "antd";
import CountrySelect from "../components/CountrySelect";
import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePostalLookup } from "../hooks/usePostalLookup";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../app/hooks";
import type { AppDispatch } from "../app/store";
import { fetchAccessorials } from "../store/accessorialsSlice";
import { fetchCarrierRates } from "../store/customerRateSlice";
import { SRV_TOKEN, DEFAULT_CLIENT_CODE } from "../config/apiConfig";

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
  | "description";

type QuoteItem = Record<ItemField, string> & {
  id: string;
};

type QuotePackage = {
  id: string;
  items: QuoteItem[];
};

let quoteEntityId = 0;

const createId = (prefix: string) => `${prefix}-${++quoteEntityId}`;

const createItem = (): QuoteItem => ({
  id: createId("item"),
  units: "1",
  handlingUnit: "Pallet",
  pieces: "1",
  weight: "864",
  weightUnit: "lbs",
  freightClass: "50",
  length: "",
  width: "",
  height: "",
  dimensionUnit: "in.",
  nmfc: "",
  description: "",
});

const createPackage = (): QuotePackage => ({
  id: createId("package"),
  items: [createItem()],
});



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
  includeDate = false,
  postal,
  setPostal,
  city,
  setCity,
  state,
  setState,
  country,
  setCountry,
}: {
  title: string;
  zipLabel: string;
  includeDate?: boolean;
  postal: string;
  setPostal: (val: string) => void;
  city: string;
  setCity: (val: string) => void;
  state: string;
  setState: (val: string) => void;
  country: string;
  setCountry: (val: string) => void;
}) {
  const { searchPostals, loadingPostal } = usePostalLookup();
  const zipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postalRef = useRef(postal);
  const [postalOptions, setPostalOptions] = useState<{ value: string; label: string; city: string; state: string; key: string }[]>([]);

  const handleSearchPostal = (value: string) => {
    if (zipTimeoutRef.current) clearTimeout(zipTimeoutRef.current);
    if (value.length >= 3) {
      zipTimeoutRef.current = setTimeout(async () => {
        const results = await searchPostals(value, country);
        
        if (results && results.length === 1) {
          // Exactly 1 result (full postal code usually) -> auto-fill immediately
          setPostal(results[0].postalCode || value);
          setCity(results[0].city);
          setState(results[0].state);
          setPostalOptions([]);
        } else if (results && results.length > 1) {
          // Multiple results -> show dropdown
          const uniqueResults = Array.from(new Set(results.map(r => `${r.postalCode || value}|${r.city}|${r.state}`)))
            .map(str => {
              const [p, c, s] = str.split('|');
              return { postalCode: p, city: c, state: s };
            });
          setPostalOptions(
            uniqueResults.map((r, idx) => ({
              value: r.postalCode,
              label: `${r.postalCode} - ${r.city}, ${r.state}`,
              city: r.city,
              state: r.state,
              key: `postal-${idx}`
            }))
          );
        } else {
          setPostalOptions([]);
        }
      }, 600);
    } else {
      setPostalOptions([]);
    }
  };

  const handleSelectPostal = (value: string, option: { city: string; state: string }) => {
    setPostal(value);
    setCity(option.city);
    setState(option.state);
  };

  const handlePostalBlur = async () => {
    const val = postalRef.current;
    if (!val || val.length < 3) return;
    if (zipTimeoutRef.current) clearTimeout(zipTimeoutRef.current);
    const results = await searchPostals(val, country);
    if (results && results.length === 1) {
      setPostal(results[0].postalCode || val);
      setCity(results[0].city);
      setState(results[0].state);
      setPostalOptions([]);
    } else if (results && results.length > 1) {
      const uniqueResults = Array.from(new Set(results.map(r => `${r.postalCode || val}|${r.city}|${r.state}`)))
        .map(str => {
          const [p, c, s] = str.split('|');
          return { postalCode: p, city: c, state: s };
        });
      setPostalOptions(
        uniqueResults.map((r, idx) => ({
          value: r.postalCode,
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
          <label className='new-quote-field quote-location-card__date'>
            <span>Pickup Date</span>
            <DatePicker style={{ width: '100%' }} format="MM-DD-YYYY" aria-label='Pickup date' />
          </label>
        ) : null}
        <label className='new-quote-field'>
          <span>{zipLabel}</span>
          <AutoComplete
            value={postal}
            options={postalOptions}
            onSearch={handleSearchPostal}
            onSelect={handleSelectPostal}
            onChange={(val) => {
              setPostal(val);
              postalRef.current = val;
            }}
            onBlur={handlePostalBlur}
            disabled={loadingPostal}
            notFoundContent={loadingPostal ? <Spin size="small" /> : null}
          />
        </label>
        <label className='new-quote-field'>
          <span>City</span>
          <Input value={city} onChange={e => setCity(e.target.value)} aria-label={`${title} city`} />
        </label>
        <label className='new-quote-field'>
          <span>State</span>
          <Input value={state} onChange={e => setState(e.target.value)} aria-label={`${title} state`} />
        </label>
        <label className='new-quote-field'>
          <span>Country</span>
          <CountrySelect
            value={country}
            onChange={(val: string) => setCountry(val)}
            aria-label={`${title} country`}
          />
        </label>
      </div>
    </section>
  );
}

function NewQuote() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [packages, setPackages] = useState<QuotePackage[]>(() => [
    createPackage(),
  ]);
  const [accessorialSearch, setAccessorialSearch] = useState("");
  const [selectedAccessorials, setSelectedAccessorials] = useState<string[]>([]);
  
  const { data: accessorialOptions } = useAppSelector((state) => state.accessorials);
  const profileCode = useAppSelector((state) => state.app.profileCode);

  useEffect(() => {
    dispatch(fetchAccessorials());
  }, [dispatch]);

  const visibleAccessorials = useMemo(() => {
    const query = accessorialSearch.trim().toLowerCase();
    const options = accessorialOptions.map((a) => a.accessorialName);
    return query
      ? options.filter((option) =>
          option.toLowerCase().includes(query),
        )
      : options;
  }, [accessorialSearch, accessorialOptions]);

  const [origPostal, setOrigPostal] = useState("");
  const [origCity, setOrigCity] = useState("");
  const [origState, setOrigState] = useState("");
  const [origCountry, setOrigCountry] = useState("USA");

  const [destPostal, setDestPostal] = useState("");
  const [destCity, setDestCity] = useState("");
  const [destState, setDestState] = useState("");
  const [destCountry, setDestCountry] = useState("USA");

  const updateItem = (
    packageId: string,
    itemId: string,
    field: ItemField,
    value: string,
  ) => {
    setPackages((current) =>
      current.map((quotePackage) =>
        quotePackage.id === packageId
          ? {
              ...quotePackage,
              items: quotePackage.items.map((item) =>
                item.id === itemId ? { ...item, [field]: value } : item,
              ),
            }
          : quotePackage,
      ),
    );
  };

  const addItem = (packageId: string) => {
    setPackages((current) =>
      current.map((quotePackage) =>
        quotePackage.id === packageId
          ? { ...quotePackage, items: [...quotePackage.items, createItem()] }
          : quotePackage,
      ),
    );
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
  };

  const isOnlyItem = packages.length === 1 && packages[0].items.length === 1;

  const handleSeeRates = () => {
    if (!origPostal || !origCity || !origState) {
      message.error("Please provide complete origin location details (Zip, City, State).");
      return;
    }
    if (!destPostal || !destCity || !destState) {
      message.error("Please provide complete destination location details (Zip, City, State).");
      return;
    }

    const hasItems = packages.some(p => p.items.length > 0);
    if (!hasItems) {
      message.error("Please add at least one item to the quote.");
      return;
    }

    const payload = {
      serviceToken: SRV_TOKEN,
      origZip: origPostal,
      origCity: origCity,
      origState: origState,
      origCountry: origCountry,
      destZip: destPostal,
      destCity: destCity,
      destState: destState,
      destCountry: destCountry,
      shipments: packages.flatMap((p) =>
        p.items.map((i) => ({
          class: i.freightClass,
          weight: Number(i.weight) || 0,
          units: Number(i.units) || 0,
          cubicFeet: 0,
          hazMat: false,
          nmfc: i.nmfc || undefined,
          pallets: i.handlingUnit === "Pallet" ? Number(i.units) || 0 : 0,
          pieces: Number(i.pieces) || 0,
          length: Number(i.length) || 0,
          width: Number(i.width) || 0,
          height: Number(i.height) || 0,
          packageType: i.handlingUnit,
          linearFeet: 0,
          stackable: true,
        }))
      ),
      accessorialCodes: accessorialOptions
        .filter((a) => selectedAccessorials.includes(a.accessorialName))
        .map((a) => a.accesorialCode || a.accessorialName),
      profileCode: profileCode,
      clientCode: DEFAULT_CLIENT_CODE,
      scac: undefined,
      shipmentDate: new Date().toISOString(),
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
      originPortCode: undefined,
      destPortCode: undefined,
      equipment: undefined,
      codAmount: 0,
      totalLinearFeet: 0,
    };

    console.log("Saving API Request Payload:", payload);
    dispatch(fetchCarrierRates(payload));
    navigate("/quotes/rate");
  };

  return (
    <div className='new-quote-scroll'>
      <section className='new-quote-page'>
        <div className='new-quote-page__topline'>
          <button className='new-quote-back' type='button'>
            &larr; All Quotes
          </button>
          <div className='new-quote-page__top-actions'>
            <Button danger>Cancel Quote</Button>
          </div>
        </div>

        <header className='new-quote-page__title'>
          <h1>New Quote: 60113985278</h1>
          <div>
            <span>
              Sales Group: <strong>Brian Young</strong>
            </span>
            <i />
            <span>
              Sales Rep: <strong>Brian Young</strong>
            </span>
            <i />
            {/* <Select
            size='small'
            defaultValue='Notes: 2'
            options={[{ value: "Notes: 2", label: "Notes: 2" }]}
            aria-label='Quote notes count'
          /> */}
          </div>
        </header>

        <div className='new-quote-layout'>
          <main className='new-quote-main'>
            <div className='new-quote-location-grid'>
              <QuoteLocationCard
                title='Pickup'
                zipLabel='Pickup Zip Code'
                includeDate
                postal={origPostal}
                setPostal={setOrigPostal}
                city={origCity}
                setCity={setOrigCity}
                state={origState}
                setState={setOrigState}
                country={origCountry}
                setCountry={setOrigCountry}
              />
              <QuoteLocationCard
                title='Destination'
                zipLabel='Dest. Zip Code'
                postal={destPostal}
                setPostal={setDestPostal}
                city={destCity}
                setCity={setDestCity}
                state={destState}
                setState={setDestState}
                country={destCountry}
                setCountry={setDestCountry}
              />
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
                      <Checkbox>Stackable</Checkbox>
                      <Checkbox>Hazmat</Checkbox>
                      <Checkbox>Used</Checkbox>
                      <Checkbox>Machinery</Checkbox>
                    </div>
                  </header>

                  <div className='quote-items-table'>
                    <div className='quote-items-table__head' aria-hidden='true'>
                      <span>Units</span>
                      <span>Handling Unit</span>
                      <span>Pieces</span>
                      <span>Weight</span>
                      <span>Class</span>
                      <span>Dimensions</span>
                      <span>NMFC</span>
                      <span>Description</span>
                      <span />
                      <span />
                    </div>

                    {quotePackage.items.map((item) => (
                      <div className='quote-item-row' key={item.id}>
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
                        <div className='quote-item-combined quote-item-combined--weight'>
                          <Input
                            value={item.weight}
                            aria-label='Weight'
                            onChange={(event) =>
                              updateItem(
                                quotePackage.id,
                                item.id,
                                "weight",
                                event.target.value,
                              )
                            }
                          />
                          <Select
                            value={item.weightUnit}
                            options={[
                              { value: "lbs", label: "lbs" },
                              { value: "kg", label: "kg" },
                            ]}
                            aria-label='Weight unit'
                            onChange={(value) =>
                              updateItem(
                                quotePackage.id,
                                item.id,
                                "weightUnit",
                                value,
                              )
                            }
                          />
                        </div>
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
                          <Select
                            value={item.dimensionUnit}
                            options={[
                              { value: "in.", label: "in." },
                              { value: "cm", label: "cm" },
                            ]}
                            aria-label='Dimension unit'
                            onChange={(value) =>
                              updateItem(
                                quotePackage.id,
                                item.id,
                                "dimensionUnit",
                                value,
                              )
                            }
                          />
                        </div>
                        <Input
                          value={item.nmfc}
                          placeholder='—'
                          aria-label='NMFC'
                          onChange={(event) =>
                            updateItem(
                              quotePackage.id,
                              item.id,
                              "nmfc",
                              event.target.value,
                            )
                          }
                        />
                        <Input
                          value={item.description}
                          placeholder='Description'
                          aria-label='Description'
                          onChange={(event) =>
                            updateItem(
                              quotePackage.id,
                              item.id,
                              "description",
                              event.target.value,
                            )
                          }
                        />
                        <Button
                          type='text'
                          className='quote-item-edit'
                          icon={<EditOutlined />}
                          aria-label='Edit item'
                          title='Edit item'
                        />
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
                icon={<PlusOutlined />}
                onClick={() =>
                  setPackages((current) => [...current, createPackage()])
                }>
                Add Package
              </Button>
              <Button type='primary' onClick={handleSeeRates}>
                See Rates
              </Button>
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

            <section className='new-quote-card quote-notes-card'>
              <header className='new-quote-card__header'>
                <h2>Notes</h2>
                <Button size='small' icon={<PlusOutlined />}>
                  Add Note
                </Button>
              </header>
              <ol className='quote-notes-list'>
                <li>
                  Make sure customer rep is at gate to supervise unloading.
                </li>
              </ol>
              <div className='quote-note-entry'>
                <Input.TextArea placeholder='Add a note...' rows={3} />
                <Button className='quote-note-confirm'>Confirm</Button>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
}

export default NewQuote;
