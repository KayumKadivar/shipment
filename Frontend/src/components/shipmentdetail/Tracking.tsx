import {
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  PlusOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Button, Checkbox, DatePicker, Input, Select } from "antd";
import { useState } from "react";
import type { ShipmentRecord } from "../../pages/shipmentData";

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

type TrackingEvent = {
  id: string;
  status: string;
  type: string;
  source: string;
  description: string;
  location: string;
  date: string;
};

type EventEditor = {
  event: TrackingEvent;
  isNew: boolean;
};

const initialNotifications: NotificationPreferences = {
  methods: ["Email"],
  email: "Byoung@priority1inc.net",
  event: "Shipment tendered",
};

const initialReminderDraft: ReminderDraft = {
  user: "Gregory Bonomo",
  dateRange: null,
  time: "00:00",
  timezone: "CT",
};

const initialTrackingEvents: TrackingEvent[] = Array.from(
  { length: 4 },
  (_, index) => ({
    id: `tracking-event-${index + 1}`,
    status: "In Transit",
    type: "Departed",
    source: "?",
    description: "Weight Changed",
    location: "Las Vegas, Nevada",
    date: "4/25/26 - 4:00 A.M.",
  }),
);

function createEmptyEvent(): TrackingEvent {
  return {
    id: `tracking-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    status: "",
    type: "",
    source: "?",
    description: "",
    location: "",
    date: "",
  };
}

function Tracking({ shipment }: { shipment: ShipmentRecord }) {
  const [notifications, setNotifications] =
    useState<NotificationPreferences>(initialNotifications);
  const [notificationDraft, setNotificationDraft] =
    useState<NotificationPreferences | null>(null);
  const [reminderDraft, setReminderDraft] = useState<ReminderDraft>(
    initialReminderDraft,
  );
  const [reminders, setReminders] = useState<TrackingReminder[]>([]);
  const [reminderError, setReminderError] = useState("");
  const [datePickerKey, setDatePickerKey] = useState(0);
  const [events, setEvents] = useState<TrackingEvent[]>(initialTrackingEvents);
  const [eventEditor, setEventEditor] = useState<EventEditor | null>(null);
  const [notificationInput, setNotificationInput] = useState("");

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
    setNotifications(notificationDraft);
    setNotificationDraft(null);
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

  const updateEventDraft = (
    field: keyof TrackingEvent,
    value: string,
  ) => {
    setEventEditor((current) =>
      current
        ? { ...current, event: { ...current.event, [field]: value } }
        : current,
    );
  };

  const saveEvent = () => {
    if (!eventEditor) return;
    setEvents((current) =>
      eventEditor.isNew
        ? [...current, eventEditor.event]
        : current.map((event) =>
            event.id === eventEditor.event.id ? eventEditor.event : event,
          ),
    );
    setEventEditor(null);
  };

  const beginNewEvent = () => {
    if (eventEditor) return;
    setEventEditor({ event: createEmptyEvent(), isNew: true });
  };

  const renderEventInputs = (trackingEvent: TrackingEvent) => (
    <>
      <td>
        <Input
          value={trackingEvent.status}
          aria-label='Tracking status'
          onChange={(event) => updateEventDraft("status", event.target.value)}
        />
      </td>
      <td>
        <Input
          value={trackingEvent.type}
          aria-label='Tracking type'
          onChange={(event) => updateEventDraft("type", event.target.value)}
        />
      </td>
      <td>
        <Input
          value={trackingEvent.source}
          aria-label='Tracking source'
          onChange={(event) => updateEventDraft("source", event.target.value)}
        />
      </td>
      <td>
        <div className='shipment-tracking-description-inputs'>
          <Input
            value={trackingEvent.description}
            aria-label='Tracking description'
            onChange={(event) =>
              updateEventDraft("description", event.target.value)
            }
          />
          <Input
            value={trackingEvent.location}
            aria-label='Tracking location'
            onChange={(event) =>
              updateEventDraft("location", event.target.value)
            }
          />
        </div>
      </td>
      <td>
        <Input
          value={trackingEvent.date}
          aria-label='Tracking date'
          onChange={(event) => updateEventDraft("date", event.target.value)}
        />
      </td>
    </>
  );

  return (
    <section
      className='shipment-tracking-tab'
      aria-label={`Tracking for shipment ${shipment.bol}`}>
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
                    { value: "Shipment delivered", label: "Shipment delivered" },
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
                  {reminder.dateRange?.join(" Ã¢â‚¬â€œ ")} Ã‚Â· {reminder.time} {" "}
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
        aria-labelledby='tracking-events-title'>
        <div className='shipment-tracking-events-head'>
          <h2 id='tracking-events-title'>Tracking</h2>
        </div>

        <div className='shipment-tracking-table-wrap'>
          <table className='shipment-tracking-table'>
            <thead>
              <tr>
                <th>Status</th>
                <th>Type</th>
                <th>Source</th>
                <th>Description</th>
                <th>Date</th>
                <th aria-label='Actions' />
              </tr>
            </thead>
            <tbody>
              {events.map((trackingEvent) => {
                const isEditing = eventEditor?.event.id === trackingEvent.id;
                return (
                  <tr
                    key={trackingEvent.id}
                    className={isEditing ? "is-editing" : ""}>
                    {isEditing && eventEditor ? (
                      renderEventInputs(eventEditor.event)
                    ) : (
                      <>
                        <td>{trackingEvent.status}</td>
                        <td>{trackingEvent.type}</td>
                        <td>{trackingEvent.source}</td>
                        <td>
                          <strong>{trackingEvent.description}</strong>
                          <small>Location: {trackingEvent.location}</small>
                        </td>
                        <td>{trackingEvent.date}</td>
                      </>
                    )}
                    <td className='shipment-tracking-row-actions'>
                      {isEditing ? (
                        <>
                          <Button
                            type='text'
                            size='small'
                            icon={<CheckOutlined />}
                            aria-label='Save tracking event'
                            title='Save'
                            onClick={saveEvent}
                          />
                          <Button
                            type='text'
                            size='small'
                            icon={<CloseOutlined />}
                            aria-label='Cancel tracking event editing'
                            title='Cancel'
                            onClick={() => setEventEditor(null)}
                          />
                        </>
                      ) : (
                        <Button
                          type='text'
                          size='small'
                          icon={<EditOutlined />}
                          disabled={Boolean(eventEditor)}
                          aria-label={`Edit ${trackingEvent.description}`}
                          title='Edit tracking event'
                          onClick={() =>
                            setEventEditor({
                              event: { ...trackingEvent },
                              isNew: false,
                            })
                          }
                        />
                      )}
                    </td>
                  </tr>
                );
              })}

              {eventEditor?.isNew ? (
                <tr className='is-editing'>
                  {renderEventInputs(eventEditor.event)}
                  <td className='shipment-tracking-row-actions'>
                    <Button
                      type='text'
                      size='small'
                      icon={<CheckOutlined />}
                      aria-label='Save new tracking event'
                      title='Save'
                      onClick={saveEvent}
                    />
                    <Button
                      type='text'
                      size='small'
                      icon={<CloseOutlined />}
                      aria-label='Cancel new tracking event'
                      title='Cancel'
                      onClick={() => setEventEditor(null)}
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className='shipment-tracking-add-line'>
          <Button
            type='text'
            icon={<PlusOutlined />}
            disabled={Boolean(eventEditor)}
            onClick={beginNewEvent}>
            Add Line
          </Button>
        </div>
      </section>
    </section>
  );
}

export default Tracking;
