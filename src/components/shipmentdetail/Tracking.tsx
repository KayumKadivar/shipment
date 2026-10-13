import {
  CheckOutlined,
  CloseOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Alert, Button, Checkbox, DatePicker, Input, Select, Spin } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { fetchCarrierTracking } from "../../store/carrierTrackingSlice";
import type { ShipmentDetails } from "../../types/shipment.types";

type NotificationMethod = "Email";

type NotificationPreferences = {
  methods: NotificationMethod[];
  email: string;
  event: string;
};

type ReminderDraft = {
  user: string;
  dateRange: [string, string] | null;
  time: string;
  timezone: string;
};

type TrackingReminder = ReminderDraft & {
  id: string;
};

type TrackingProps = {
  shipment: ShipmentDetails;
  onChangeCommitted: () => void;
  onEditorStateChange: (isEditing: boolean) => void;
};

const initialNotifications: NotificationPreferences = {
  methods: [],
  email: "",
  event: "",
};

function notificationPreferencesAreEqual(
  first: NotificationPreferences,
  second: NotificationPreferences,
) {
  return (
    first.email === second.email &&
    first.event === second.event &&
    first.methods.length === second.methods.length &&
    first.methods.every((method, index) => method === second.methods[index])
  );
}

function formatTrackingDate(value: string) {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;

  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    `${pad(parsedDate.getMonth() + 1)}/${pad(parsedDate.getDate())}/${parsedDate.getFullYear()}`,
    `${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}:${pad(parsedDate.getSeconds())}`,
  ].join(" ");
}

function Tracking({
  shipment,
  onChangeCommitted,
  onEditorStateChange,
}: TrackingProps) {
  const dispatch = useAppDispatch();
  const { data, loading, error, requestedLoadNumber, loadedLoadNumber } =
    useAppSelector((state) => state.carrierTracking);
  const [notifications, setNotifications] =
    useState<NotificationPreferences>(initialNotifications);
  const [notificationDraft, setNotificationDraft] =
    useState<NotificationPreferences | null>(null);
  const [reminderDraft, setReminderDraft] = useState<ReminderDraft>(() => ({
    user: shipment.userName ?? "",
    dateRange: null,
    time: "",
    timezone: "CT",
  }));
  const [reminders, setReminders] = useState<TrackingReminder[]>([]);
  const [reminderError, setReminderError] = useState("");
  const [datePickerKey, setDatePickerKey] = useState(0);
  const [notificationInput, setNotificationInput] = useState("");
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
    onEditorStateChange(notificationDraft !== null);
  }, [notificationDraft, onEditorStateChange]);

  const toggleNotificationMethod = (
    method: NotificationMethod,
    checked: boolean,
  ) => {
    const updateMethods = (current: NotificationPreferences) => ({
      ...current,
      methods: checked
        ? Array.from(new Set([...current.methods, method]))
        : current.methods.filter((value) => value !== method),
    });

    if (notificationDraft) {
      setNotificationDraft(updateMethods(notificationDraft));
    } else {
      setNotifications(updateMethods);
    }
  };

  const saveNotificationSettings = () => {
    if (!notificationDraft) return;
    const hasChanges = !notificationPreferencesAreEqual(
      notificationDraft,
      notifications,
    );

    setNotifications(notificationDraft);
    setNotificationDraft(null);
    if (hasChanges) onChangeCommitted();
  };

  const createReminder = () => {
    if (!reminderDraft.dateRange) {
      setReminderError("Select a start and end date for the reminder.");
      return;
    }

    setReminders((current) => [
      ...current,
      {
        ...reminderDraft,
        id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    ]);
    setReminderDraft((current) => ({ ...current, dateRange: null }));
    setReminderError("");
    setDatePickerKey((current) => current + 1);
  };

  return (
    <section
      className='shipment-tracking-tab'
      aria-label={`Tracking for shipment ${shipment.loadNumber}`}>
      <div className='shipment-tracking-top-grid'>
        <article className='shipment-tracking-card shipment-notification-card'>
          <header>
            <h2>Notifications method</h2>
            <div className='shipment-tracking-card-actions'>
              {notificationDraft ? (
                <>
                  <Button
                    type='text'
                    size='small'
                    icon={<CheckOutlined />}
                    aria-label='Save notification settings'
                    title='Save'
                    onClick={saveNotificationSettings}
                  />
                  <Button
                    type='text'
                    size='small'
                    icon={<CloseOutlined />}
                    aria-label='Cancel notification editing'
                    title='Cancel'
                    onClick={() => setNotificationDraft(null)}
                  />
                </>
              ) : (
                <Button
                  type='text'
                  size='small'
                  icon={<SettingOutlined />}
                  aria-label='Edit notification settings'
                  title='Edit notification settings'
                  onClick={() => setNotificationDraft({ ...notifications })}
                />
              )}
            </div>
          </header>

          <div className='shipment-notification-methods'>
            <Checkbox
              checked={(notificationDraft ?? notifications).methods.includes(
                "Email",
              )}
              onChange={(event) =>
                toggleNotificationMethod("Email", event.target.checked)
              }>
              Email
            </Checkbox>
          </div>

          <div className='shipment-notification-email'>
            <span>Email</span>
            <Input
              value={notificationInput}
              aria-label='Additional notification email'
              onChange={(event) => setNotificationInput(event.target.value)}
            />
            <strong>{(notificationDraft ?? notifications).email}</strong>
          </div>

          {notificationDraft ? (
            <div className='shipment-notification-edit-fields'>
              <label>
                <span>Email</span>
                <Input
                  type='email'
                  value={notificationDraft.email}
                  onChange={(event) =>
                    setNotificationDraft((current) =>
                      current
                        ? { ...current, email: event.target.value }
                        : current,
                    )
                  }
                />
              </label>
              <label>
                <span>Notification event</span>
                <Select
                  value={notificationDraft.event}
                  options={[
                    { value: "Shipment tendered", label: "Shipment tendered" },
                    { value: "Shipment departed", label: "Shipment departed" },
                    {
                      value: "Shipment delivered",
                      label: "Shipment delivered",
                    },
                  ]}
                  onChange={(event) =>
                    setNotificationDraft((current) =>
                      current ? { ...current, event } : current,
                    )
                  }
                />
              </label>
            </div>
          ) : (
            <p className='shipment-notification-rule'>
              Email {notifications.email} when:
              <strong>
                <CheckOutlined /> {notifications.event}
              </strong>
            </p>
          )}
        </article>

        <article className='shipment-tracking-card shipment-reminder-form-card'>
          <h2>Tracking Reminder</h2>
          <label className='shipment-reminder-user-field'>
            <span>Send To User</span>
            <Input
              value={reminderDraft.user}
              onChange={(event) =>
                setReminderDraft((current) => ({
                  ...current,
                  user: event.target.value,
                }))
              }
            />
          </label>
          <div className='shipment-reminder-fields'>
            <label>
              <span>Date</span>
              <DatePicker.RangePicker
                key={datePickerKey}
                format='MM/DD/YYYY'
                aria-label='Reminder date range'
                onChange={(_, dateStrings) => {
                  const start = dateStrings[0];
                  const end = dateStrings[1];
                  setReminderDraft((current) => ({
                    ...current,
                    dateRange: start && end ? [start, end] : null,
                  }));
                  if (start && end) setReminderError("");
                }}
              />
            </label>
            <label>
              <span>Reminder Time</span>
              <Input
                type='time'
                value={reminderDraft.time}
                onChange={(event) =>
                  setReminderDraft((current) => ({
                    ...current,
                    time: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Timezone</span>
              <Select
                value={reminderDraft.timezone}
                options={["CT", "ET", "MT", "PT"].map((timezone) => ({
                  value: timezone,
                  label: timezone,
                }))}
                onChange={(timezone) =>
                  setReminderDraft((current) => ({ ...current, timezone }))
                }
              />
            </label>
          </div>
          {reminderError ? (
            <p className='shipment-reminder-error' role='alert'>
              {reminderError}
            </p>
          ) : null}
          <div className='shipment-reminder-create'>
            <Button onClick={createReminder}>Create Reminder</Button>
          </div>
        </article>
      </div>

      <article className='shipment-tracking-card shipment-reminder-list-card'>
        <h2>Tracking Reminder</h2>
        {reminders.length ? (
          <div className='shipment-reminder-list'>
            {reminders.map((reminder) => (
              <div key={reminder.id}>
                <strong>{reminder.user}</strong>
                <span>
                  {reminder.dateRange?.join(" Ã¢â‚¬â€œ ")} Ã‚Â· {reminder.time}{" "}
                  {reminder.timezone}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p>
            <strong>No Tracking Reminders have been added yet.</strong>
            <span>All the Tracking Reminders will be shown here.</span>
          </p>
        )}
      </article>

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
