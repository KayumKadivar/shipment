import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { Button, Card, Form, Input, Popconfirm } from "antd";
import { useEffect, useState } from "react";

/** Renders the BOL dispatch notes and local note composer for the shipment Load tab. */
function LoadInternalNotes({
  initialNotes,
  onNoteAdded,
  onEditorStateChange,
}: {
  initialNotes: readonly string[] | null;
  onNoteAdded: () => void;
  onEditorStateChange: (isEditing: boolean) => void;
}) {
  const [notes, setNotes] = useState(() =>
    (initialNotes ?? []).map((note) => note.trim()).filter(Boolean),
  );
  const [draftNote, setDraftNote] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<string[] | null>(null);

  useEffect(
    () => () => onEditorStateChange(false),
    [onEditorStateChange],
  );

  const addNote = () => {
    const note = draftNote.trim();
    if (!note) return;

    setNotes((currentNotes) => [...currentNotes, note]);
    setDraftNote("");
    onNoteAdded();
  };

  const beginEditing = () => {
    setNoteDrafts([...notes]);
    onEditorStateChange(true);
  };

  const updateNoteDraft = (index: number, value: string) => {
    setNoteDrafts((currentDrafts) =>
      currentDrafts?.map((note, noteIndex) =>
        noteIndex === index ? value : note,
      ) ?? currentDrafts,
    );
  };

  const deleteNoteDraft = (index: number) => {
    setNoteDrafts((currentDrafts) =>
      currentDrafts?.filter((_, noteIndex) => noteIndex !== index) ??
      currentDrafts,
    );
  };

  const saveEditing = () => {
    if (!noteDrafts) return;

    const nextNotes = noteDrafts.map((note) => note.trim());
    if (nextNotes.some((note) => !note)) return;

    const hasChanges =
      nextNotes.length !== notes.length ||
      nextNotes.some((note, index) => note !== notes[index]);

    setNotes(nextNotes);
    setNoteDrafts(null);
    onEditorStateChange(false);
    if (hasChanges) onNoteAdded();
  };

  const cancelEditing = () => {
    setNoteDrafts(null);
    onEditorStateChange(false);
  };

  const noteSaveDisabled =
    noteDrafts?.some((note) => !note.trim()) ?? false;

  return (
    <Card
      title={<h2>Internal Notes</h2>}
      extra={
        <div className='shipment-load-internal-notes-actions'>
          {noteDrafts ? (
            <>
              <Button
                type='text'
                size='small'
                icon={<CheckOutlined />}
                aria-label='Save internal notes'
                title='Save'
                disabled={noteSaveDisabled}
                onClick={saveEditing}
              />
              <Button
                type='text'
                size='small'
                icon={<CloseOutlined />}
                aria-label='Cancel internal note editing'
                title='Cancel'
                onClick={cancelEditing}
              />
            </>
          ) : (
            <Button
              type='text'
              size='small'
              icon={<EditOutlined />}
              aria-label='Edit internal notes'
              title='Edit internal notes'
              disabled={!notes.length}
              onClick={beginEditing}
            />
          )}
        </div>
      }
      className='shipment-load-internal-notes'>
      {noteDrafts ? (
        <div
          className='shipment-load-internal-notes-edit-list'
          aria-label='Editable internal notes'>
          {noteDrafts.length ? (
            noteDrafts.map((note, index) => (
              <div
                className='shipment-load-internal-notes-edit-row'
                key={index}>
                <Input
                  value={note}
                  aria-label={`Internal note ${index + 1}`}
                  onChange={(event) =>
                    updateNoteDraft(index, event.target.value)
                  }
                />
                <Popconfirm
                  title='Delete internal note?'
                  description='This removes the internal note from the draft.'
                  okText='Delete'
                  cancelText='Cancel'
                  okButtonProps={{ danger: true }}
                  onConfirm={() => deleteNoteDraft(index)}>
                  <Button
                    type='text'
                    size='small'
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={`Delete internal note ${index + 1}`}
                    title='Delete internal note'
                  />
                </Popconfirm>
              </div>
            ))
          ) : (
            <p className='shipment-load-internal-notes-empty'>
              All internal notes will be removed when saved.
            </p>
          )}
        </div>
      ) : notes.length ? (
        <ul
          className='shipment-load-internal-notes-list'
          aria-label='BOL dispatch notes'>
          {notes.map((note, index) => (
            <li className='shipment-detail-field' key={`${note}-${index}`}>
              <span>{`Note ${index + 1}`}</span>
              <strong>{note}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className='shipment-load-internal-notes-empty'>
          No internal notes were returned.
        </p>
      )}

      <Form layout='vertical'>
        <Form.Item label='Customer / Internal Note'>
          <Input.TextArea
            aria-label='Customer / Internal Note'
            placeholder='Note...'
            rows={4}
            className='shipment-load-internal-notes-input'
            value={draftNote}
            disabled={noteDrafts !== null}
            onChange={(event) => setDraftNote(event.target.value)}
          />
        </Form.Item>

        <div className='shipment-load-internal-notes-footer'>
          <Button
            type='primary'
            danger
            htmlType='button'
            disabled={noteDrafts !== null || !draftNote.trim()}
            onClick={addNote}>
            Add
          </Button>
        </div>
      </Form>
    </Card>
  );
}

export default LoadInternalNotes;
