import { Alert, Button, Checkbox, DatePicker, Input, Select, Spin, TimePicker } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { fetchCarrierTracking } from "../../store/carrierTrackingSlice";
import { fetchShipmentTrackingNotification, saveShipmentTrackingNotification } from "../../store/shipmentTrackingNotificationSlice";
import { fetchShipmentTrackingReminder, saveShipmentTrackingReminder } from "../../store/shipmentTrackingReminderSlice";
import { getReminderValidationError, toReminderDraft, toReminderPayload, type ReminderDraft } from "./trackingReminderForm";
import type { ShipmentDetails } from "../../types/shipment.types";

type NotificationMethod = "Email";

type NotificationPreferences = {
  methods: NotificationMethod[];
  email: string;
  isNotifyOnPickupRequest: boolean;
  isNotifyOnInTransit: boolean;
  isNotifyOnOutForDelivery: boolean;
  isNotifyOnDelivered: boolean;
};

type TrackingProps = {
  shipment: ShipmentDetails;
  onChangeCommitted: () => void;
  onEditorStateChange: (isEditing: boolean) => void;
};

const initialNotifications: NotificationPreferences = {
  methods: [],
  email: "",
  isNotifyOnPickupRequest: false,
  isNotifyOnInTransit: false,
  isNotifyOnOutForDelivery: false,
  isNotifyOnDelivered: false,
};

function formatTrackingDate(value: string) {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;

  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    `${pad(parsedDate.getMonth() + 1)}/${pad(parsedDate.getDate())}/${parsedDate.getFullYear()}`,
    `${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}:${pad(parsedDate.getSeconds())}`,
  ].join(" ");
}

function Tracking({ shipment, onEditorStateChange }: TrackingProps) {
  const dispatch = useAppDispatch();
  const { data, loading, error, requestedLoadNumber, loadedLoadNumber } =
    useAppSelector((state) => state.carrierTracking);
  const notificationState = useAppSelector((state) => state.shipmentTrackingNotification);
  const bolNo = shipment.loadNumber.trim();
  const notificationLoading = notificationState.loading && notificationState.requestedBolNo === bolNo;
  const notificationError = notificationState.requestedBolNo === bolNo ? notificationState.error : null;
  const preferences = notificationState.loadedBolNo === bolNo ? notificationState.data : null;
  const notificationSaving = notificationState.saving && notificationState.saveBolNo === bolNo;
  const notificationLookupReady = notificationState.loadedBolNo === bolNo && !notificationLoading && !notificationError;
  const [notificationValidation, setNotificationValidation] = useState<{ bolNo: string; message: string } | null>(null);
  const notificationSaveRequestRef = useRef<{ requestId: string } | null>(null);
  const notificationInput = (preferences?.email ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean)
    .join(",");
  const notifications: NotificationPreferences = preferences ? {
    methods: notificationInput ? ["Email"] : [],
    email: notificationInput,
    isNotifyOnPickupRequest: preferences.isNotifyOnPickupRequest === true,
    isNotifyOnInTransit: preferences.isNotifyOnInTransit === true,
    isNotifyOnOutForDelivery: preferences.isNotifyOnOutForDelivery === true,
    isNotifyOnDelivered: preferences.isNotifyOnDelivered === true,
  } : initialNotifications;
  const [notificationDraft, setNotificationDraft] = useState<{
    bolNo: string;
    values: Partial<NotificationPreferences>;
  } | null>(null);
  const displayedNotifications = {
    ...notifications,
    ...(notificationDraft?.bolNo === bolNo ? notificationDraft.values : {}),
  };

  /** Updates the current shipment draft before explicit persistence. */
  const updateNotificationDraft = (changes: Partial<NotificationPreferences>) => {
    setNotificationValidation(null);
    setNotificationDraft((current) => ({
      bolNo,
      values: {
        ...(current?.bolNo === bolNo ? current.values : {}),
        ...changes,
      },
    }));
  };

  const [notificationRetry, setNotificationRetry] = useState(0);
  const reminderState = useAppSelector((state) => state.shipmentTrackingReminder);
  const savedReminder = reminderState.loadedBolNo === bolNo ? reminderState.data : null;
  const reminderLoading = reminderState.loading && reminderState.requestedBolNo === bolNo;
  const reminderSaving = reminderState.saving && reminderState.saveBolNo === bolNo;
  const reminderLookupError = reminderState.requestedBolNo === bolNo ? reminderState.error : null;
  const reminderLookupReady = reminderState.loadedBolNo === bolNo && !reminderLoading && !reminderLookupError;
  const [reminderDraft, setReminderDraft] = useState<{ bolNo: string; values: ReminderDraft } | null>(null);
  const displayedReminderDraft = reminderDraft?.bolNo === bolNo ? reminderDraft.values : toReminderDraft(savedReminder);
  const [reminderError, setReminderError] = useState<{ bolNo: string; message: string } | null>(null);
  const [reminderRetry, setReminderRetry] = useState(0);
  const reminderSaveRequestRef = useRef<{ requestId: string } | null>(null);

  /** Updates the current shipment's reminder draft before explicit persistence. */
  const updateReminderDraft = (changes: Partial<ReminderDraft>) => {
    setReminderError(null);
    setReminderDraft({ bolNo, values: { ...displayedReminderDraft, ...changes } });
  };
  const activeRequestRef = useRef<{ abort: () => void } | null>(null);

  const trackingData = loadedLoadNumber === shipment.loadNumber ? data : null;
  const isTrackingLoading =
    loading && requestedLoadNumber === shipment.loadNumber;
  const trackingError =
    requestedLoadNumber === shipment.loadNumber ? error : null;
  const trackingRecords = useMemo(
    () =>
      [...(trackingData?.trackRecords ?? [])].sort((left, right) => {
        const leftTime = Date.parse(left.statusDate);
        const rightTime = Date.parse(right.statusDate);

        if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0;
        return rightTime - leftTime;
      }),
    [trackingData],
  );

  const loadCarrierTracking = useCallback(() => {
    const request = dispatch(
      fetchCarrierTracking({
        loadNumber: shipment.loadNumber,
        clientCode: shipment.clientCode,
      }),
    );
    activeRequestRef.current = request;
    void request.finally(() => {
      if (activeRequestRef.current === request) {
        activeRequestRef.current = null;
      }
    });
  }, [dispatch, shipment.clientCode, shipment.loadNumber]);

  useEffect(
    () => () => {
      activeRequestRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    onEditorStateChange(false);
  }, [onEditorStateChange]);

  useEffect(() => {
    const request = dispatch(fetchShipmentTrackingNotification(shipment.loadNumber));
    return () => request.abort();
  }, [dispatch, shipment.loadNumber, notificationRetry]);

  useEffect(() => {
    return () => { notificationSaveRequestRef.current = null; };
  }, [bolNo]);

  /** Validates recipients and persists the current shipment's complete notification snapshot. */
  const saveNotificationSettings = async () => {
    if (!notificationLookupReady || notificationSaving || notificationSaveRequestRef.current) return;
    const emailAddresses = displayedNotifications.email.split(",").map((email) => email.trim());
    const message = !displayedNotifications.methods.includes("Email")
      ? "Select the Email notification method."
      : !displayedNotifications.email.trim()
        ? "Enter at least one notification email."
        : emailAddresses.some((email) => !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email))
          ? "Enter valid email addresses separated by commas."
          : null;
    if (message) {
      setNotificationValidation({ bolNo, message });
      return;
    }
    setNotificationValidation(null);
    const request = dispatch(saveShipmentTrackingNotification({
      shipmentTrackingNotificationId: preferences?.shipmentTrackingNotificationId ?? 0,
      bolNo,
      email: emailAddresses.join(","),
      isNotifyOnPickupRequest: displayedNotifications.isNotifyOnPickupRequest,
      isNotifyOnInTransit: displayedNotifications.isNotifyOnInTransit,
      isNotifyOnOutForDelivery: displayedNotifications.isNotifyOnOutForDelivery,
      isNotifyOnDelivered: displayedNotifications.isNotifyOnDelivered,
    }));
    notificationSaveRequestRef.current = request;
    const result = await request;
    if (notificationSaveRequestRef.current !== request) return;
    notificationSaveRequestRef.current = null;
    if (saveShipmentTrackingNotification.fulfilled.match(result)) {
      setNotificationDraft(null);
    }
  };

  useEffect(() => {
    const request = dispatch(fetchShipmentTrackingReminder(shipment.loadNumber));
    return () => request.abort();
  }, [dispatch, shipment.loadNumber, reminderRetry]);

  useEffect(() => {
    return () => { reminderSaveRequestRef.current = null; };
  }, [bolNo]);

  /** Validates and creates or replaces the reminder using its persisted identifier. */
  const createReminder = async () => {
    if (!reminderLookupReady || reminderSaving || reminderSaveRequestRef.current) return;
    const message = getReminderValidationError(displayedReminderDraft);
    if (message) {
      setReminderError({ bolNo, message });
      return;
    }
    setReminderError(null);
    const request = dispatch(saveShipmentTrackingReminder(toReminderPayload(
      displayedReminderDraft, bolNo, savedReminder?.shipmentTrackingReminderId ?? 0,
    )));
    reminderSaveRequestRef.current = request;
    const result = await request;
    if (reminderSaveRequestRef.current !== request) return;
    reminderSaveRequestRef.current = null;
    if (saveShipmentTrackingReminder.fulfilled.match(result)) setReminderDraft(null);
  };

  return (
    <section
      className='shipment-tracking-tab'
      aria-label={`Tracking for shipment ${shipment.loadNumber}`}>
      <div className='shipment-tracking-top-grid'>
        <article className='shipment-tracking-card shipment-notification-card'>
          <header>
            <h2>Notifications method</h2>
          </header>
          {notificationLoading ? (
            <div role="status" aria-live="polite">
              <Spin size="small" /> Loading notification preferences...
            </div>
          ) : null}
          {notificationError ? (
            <Alert
              type="error"
              showIcon
              title="Unable to load notification preferences"
              description={notificationError}
              action={
                <Button
                  size="small"
                  onClick={() => setNotificationRetry((current) => current + 1)}>
                  Retry
                </Button>
              }
            />
          ) : null}
          <div className="shipment-notification-methods">
            <Checkbox
              disabled={notificationSaving}
              checked={displayedNotifications.methods.includes("Email")}
              onChange={(event) => updateNotificationDraft({
                methods: event.target.checked ? ["Email"] : [],
              })}>
              Email
            </Checkbox>
          </div>
          <div className="shipment-notification-email">
            <span>Email</span>
            <Input
              value={displayedNotifications.email}
              aria-label="Notification emails"
              onChange={(event) => updateNotificationDraft({ email: event.target.value })}
              disabled={notificationSaving}
            />
          </div>
          <div className="shipment-notification-events">
            <Checkbox
              disabled={notificationSaving}
              checked={displayedNotifications.isNotifyOnPickupRequest}
              onChange={(event) => updateNotificationDraft({
                isNotifyOnPickupRequest: event.target.checked,
              })}>
              PickupRequest
            </Checkbox>
            <Checkbox
              disabled={notificationSaving}
              checked={displayedNotifications.isNotifyOnInTransit}
              onChange={(event) => updateNotificationDraft({
                isNotifyOnInTransit: event.target.checked,
              })}>
              InTransit
            </Checkbox>
            <Checkbox
              disabled={notificationSaving}
              checked={displayedNotifications.isNotifyOnOutForDelivery}
              onChange={(event) => updateNotificationDraft({
                isNotifyOnOutForDelivery: event.target.checked,
              })}>
              OutForDelivery
            </Checkbox>
            <Checkbox
              disabled={notificationSaving}
              checked={displayedNotifications.isNotifyOnDelivered}
              onChange={(event) => updateNotificationDraft({
                isNotifyOnDelivered: event.target.checked,
              })}>
              Delivered
            </Checkbox>
          </div>
          {notificationValidation?.bolNo === bolNo ? <p role="alert">{notificationValidation.message}</p> : null}
          {notificationState.saveBolNo === bolNo && notificationState.saveError ? (
            <Alert type="error" showIcon title="Unable to save notification preferences" description={notificationState.saveError} />
          ) : null}
          {notificationState.saveBolNo === bolNo && notificationState.saveSuccess && notificationDraft?.bolNo !== bolNo ? (
            <p role="status">{notificationState.saveSuccess}</p>
          ) : null}
          <div className="shipment-notification-create">
            <Button
              loading={notificationSaving}
              disabled={!notificationLookupReady || notificationSaving}
              onClick={saveNotificationSettings}>
              {preferences ? "Update Notification" : "Create Notification"}
            </Button>
          </div>
        </article>

        <article className='shipment-tracking-card shipment-reminder-form-card'>
          <h2>Tracking Reminder</h2>
          {reminderLoading ? <div role="status"><Spin size="small" /> Loading tracking reminder...</div> : null}
          {reminderLookupError ? <Alert type="error" showIcon title="Unable to load tracking reminder" description={reminderLookupError}
            action={<Button onClick={() => setReminderRetry((current) => current + 1)}>Retry reminder</Button>} /> : null}
          <label className='shipment-reminder-user-field'>
            <span>Send To User</span>
            <Input value={displayedReminderDraft.user} aria-label="Reminder emails" disabled={reminderSaving}
              placeholder="first@example.com,second@example.com"
              aria-describedby="reminder-email-help"
              onChange={(event) => updateReminderDraft({ user: event.target.value })} />
            <span id="reminder-email-help">Separate multiple email addresses with commas.</span>
          </label>
          <div className='shipment-reminder-fields'>
            <label>
              <span>Date</span>
              <DatePicker.RangePicker
                format='MM/DD/YYYY'
                aria-label='Reminder date range'
                aria-labels={{ start: "Reminder start date", end: "Reminder end date" }}
                disabled={reminderSaving}
                value={displayedReminderDraft.dateRange ? [dayjs(displayedReminderDraft.dateRange[0]), dayjs(displayedReminderDraft.dateRange[1])] : null}
                onChange={(dates) => updateReminderDraft({ dateRange: dates?.[0] && dates[1] ? [dates[0].format("YYYY-MM-DD"), dates[1].format("YYYY-MM-DD")] : null })}
              />
            </label>
            <label>
              <span>Reminder Time</span>
              <TimePicker
                aria-label="Reminder time"
                use12Hours
                format="hh:mm A"
                needConfirm={false}
                placeholder="Select time"
                value={displayedReminderDraft.time ? dayjs(`2000-01-01T${displayedReminderDraft.time}:00`) : null}
                disabled={reminderSaving}
                onChange={(time) => updateReminderDraft({ time: time?.format("HH:mm") ?? "" })}
              />
            </label>
            <label>
              <span>Timezone</span>
              <Select aria-label="Reminder timezone" value={displayedReminderDraft.timezone} disabled={reminderSaving}
                options={["CT", "ET", "MT", "PT"].map((timezone) => ({ value: timezone, label: timezone }))}
                onChange={(timezone) => updateReminderDraft({ timezone })} />
            </label>
          </div>
          {reminderError?.bolNo === bolNo ? <p className='shipment-reminder-error' role='alert'>{reminderError.message}</p> : null}
          {reminderState.saveBolNo === bolNo && reminderState.saveError ? <Alert type="error" showIcon title="Unable to save tracking reminder" description={reminderState.saveError} /> : null}
          {reminderState.saveBolNo === bolNo && reminderState.saveSuccess && reminderDraft?.bolNo !== bolNo ? <p role="status">{reminderState.saveSuccess}</p> : null}
          <div className='shipment-reminder-create'>
            <Button onClick={createReminder} loading={reminderSaving} disabled={!reminderLookupReady || reminderSaving}>
              {savedReminder ? "Update Reminder" : "Create Reminder"}
            </Button>
          </div>
        </article>
      </div>

      <section
        className='shipment-tracking-events'
        aria-labelledby='tracking-status-title'>
        <div className='shipment-tracking-events-head'>
          {/* <h2 id='tracking-status-title'>Status</h2> */}
        </div>

        {isTrackingLoading ? (
          <div
            className='shipment-tracking-feedback'
            role='status'
            aria-live='polite'>
            <Spin size='small' />
            <span>Loading carrier tracking details...</span>
          </div>
        ) : null}

        {trackingError ? (
          <Alert
            className='shipment-tracking-alert'
            type='error'
            showIcon
            title='Unable to load carrier tracking details'
            description={trackingError}
            action={
              <Button size='small' onClick={loadCarrierTracking}>
                Retry
              </Button>
            }
          />
        ) : null}

        {trackingData && !isTrackingLoading && !trackingError ? (
          <>
            <p className='shipment-tracking-current-status'>
              <span>Current Status:</span>{" "}
              <strong>
                {trackingData.statusDescription || "Not available"}
              </strong>
            </p>

            <div className='shipment-tracking-table-wrap'>
              <table className='shipment-tracking-table'>
                <colgroup>
                  <col className='shipment-tracking-col-date' />
                  <col className='shipment-tracking-col-description' />
                  <col className='shipment-tracking-col-city' />
                  <col className='shipment-tracking-col-state' />
                </colgroup>
                <thead>
                  <tr>
                    <th scope='col'>Status Date</th>
                    <th scope='col'>Description</th>
                    <th scope='col'>City</th>
                    <th scope='col'>State</th>
                  </tr>
                </thead>
                <tbody>
                  {!trackingRecords.length ? (
                    <tr>
                      <td className='shipment-tracking-empty' colSpan={4}>
                        No tracking records were returned.
                      </td>
                    </tr>
                  ) : null}
                  {trackingRecords.map((trackingRecord, index) => (
                    <tr
                      key={`${trackingRecord.statusDate}-${trackingRecord.statusCode ?? "status"}-${index}`}>
                      <td>{formatTrackingDate(trackingRecord.statusDate)}</td>
                      <td className='shipment-tracking-description-cell'>
                        {trackingRecord.statusDescription}
                      </td>
                      <td>{trackingRecord.city ?? ""}</td>
                      <td>{trackingRecord.state ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </section>
  );
}

export default Tracking;
