import React, { useState } from 'react';
import { Card, Form, Input, Button, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import './newshipment.css';

export interface InternalNoteItem {
  id: string;
  text: string;
  createdAt: string;
}

export interface InternalNotesProps {
  initialNotes?: InternalNoteItem[];
  onNotesChange?: (notes: InternalNoteItem[]) => void;
}

const InternalNotes: React.FC<InternalNotesProps> = ({ initialNotes = [], onNotesChange }) => {
  const [noteText, setNoteText] = useState('');
  const [notesList, setNotesList] = useState<InternalNoteItem[]>(initialNotes);

  const handleAddNote = () => {
    const trimmed = noteText.trim();
    if (!trimmed) {
      message.warning('Please enter a note before adding.');
      return;
    }

    const newNote: InternalNoteItem = {
      id: `note-${Date.now()}`,
      text: trimmed,
      createdAt: new Date().toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const updated = [newNote, ...notesList];
    setNotesList(updated);
    setNoteText('');
    if (onNotesChange) onNotesChange(updated);
    message.success('Note added.');
  };

  const handleRemoveNote = (id: string) => {
    const updated = notesList.filter((n) => n.id !== id);
    setNotesList(updated);
    if (onNotesChange) onNotesChange(updated);
  };

  return (
    <Card title="Internal Notes" className="internal-notes-panel">
      <Form layout="vertical">
        <Form.Item label="Customer / Internal Note" className="mb-8">
          <Input.TextArea
            placeholder="Note..."
            rows={3}
            className="resize-none"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleAddNote();
              }
            }}
          />
        </Form.Item>

        <div className="internal-notes-actions">
          <Button
            type="primary"
            danger
            className="w-min-80"
            onClick={handleAddNote}
          >
            Add
          </Button>
        </div>

        {/* Added Notes List */}
        {notesList.length > 0 && (
          <div className="internal-notes-list">
            <div className="internal-notes-list-header">
              Customer / Internal Notes ({notesList.length})
            </div>
            {notesList.map((note) => (
              <div key={note.id} className="internal-note-item">
                <div className="internal-note-content">
                  <div className="internal-note-text">
                    {note.text}
                  </div>
                </div>
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => handleRemoveNote(note.id)}
                  title="Delete note"
                />
              </div>
            ))}
          </div>
        )}
      </Form>
    </Card>
  );
};

export default InternalNotes;
