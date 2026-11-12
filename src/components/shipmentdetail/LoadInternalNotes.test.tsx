// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoadInternalNotes from "./LoadInternalNotes";

describe("LoadInternalNotes", () => {
  it("LoadInternalNotes_AddedNote_PublishesAcceptedCollection", () => {
    const onValuesChange = vi.fn();
    render(<LoadInternalNotes initialNotes={["Original"]} onNoteAdded={vi.fn()} onEditorStateChange={vi.fn()} onValuesChange={onValuesChange} />);
    fireEvent.change(screen.getByLabelText("Customer / Internal Note"), { target: { value: "New note" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onValuesChange).toHaveBeenCalledWith(["Original", "New note"]);
  });

  it("LoadInternalNotes_CancelledEdit_DoesNotPublishDraft", () => {
    const onValuesChange = vi.fn();
    render(<LoadInternalNotes initialNotes={["Original"]} onNoteAdded={vi.fn()} onEditorStateChange={vi.fn()} onValuesChange={onValuesChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit internal notes" }));
    fireEvent.change(screen.getByLabelText("Internal note 1"), { target: { value: "Draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel internal note editing" }));
    expect(onValuesChange).not.toHaveBeenCalled();
  });

  it("LoadInternalNotes_AcceptedEdit_PublishesChangedCollection", () => {
    const onValuesChange = vi.fn();
    render(<LoadInternalNotes initialNotes={["Original"]} onNoteAdded={vi.fn()} onEditorStateChange={vi.fn()} onValuesChange={onValuesChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit internal notes" }));
    fireEvent.change(screen.getByLabelText("Internal note 1"), { target: { value: "Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save internal notes" }));
    expect(onValuesChange).toHaveBeenCalledWith(["Updated"]);
  });
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}

        unobserve() {}

        disconnect() {}
      },
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("LoadInternalNotes_whenRendered_showsTheTextareaAndAddButton", () => {
    render(
      <LoadInternalNotes
        initialNotes={null}
        onNoteAdded={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Internal Notes" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Customer / Internal Note")).toBeTruthy();
    expect(screen.getByPlaceholderText("Note...")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
  });

  it("LoadInternalNotes_whenRendered_omitsPrivacyAndNoteTypeControls", () => {
    render(
      <LoadInternalNotes
        initialNotes={null}
        onNoteAdded={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByText("Private")).toBeNull();
    expect(screen.queryByText("Notes")).toBeNull();
    expect(screen.queryByText("Log")).toBeNull();
  });

  it("LoadInternalNotes_whenBolDispatchNotesAreProvided_showsThemAboveTheComposer", () => {
    render(
      <LoadInternalNotes
        initialNotes={["Call before arrival", "Use dock 3"]}
        onNoteAdded={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    const noteList = screen.getByRole("list", { name: "BOL dispatch notes" });
    const textarea = screen.getByLabelText("Customer / Internal Note");

    expect(noteList.textContent).toContain("Call before arrival");
    expect(noteList.textContent).toContain("Use dock 3");
    expect(
      noteList.compareDocumentPosition(textarea) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("LoadInternalNotes_whenAddIsClicked_appendsTheTrimmedNoteAndClearsTheInput", () => {
    const onNoteAdded = vi.fn();
    render(
      <LoadInternalNotes
        initialNotes={["Existing note"]}
        onNoteAdded={onNoteAdded}
        onEditorStateChange={vi.fn()}
      />,
    );
    const note = screen.getByLabelText<HTMLTextAreaElement>(
      "Customer / Internal Note",
    );

    fireEvent.change(note, { target: { value: "  Call before delivery  " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Existing note")).toBeTruthy();
    expect(screen.getByText("Call before delivery")).toBeTruthy();
    expect(note.value).toBe("");
    expect(onNoteAdded).toHaveBeenCalledTimes(1);
  });

  it("LoadInternalNotes_whenNoteIsBlank_disablesAdd", () => {
    render(
      <LoadInternalNotes
        initialNotes={[]}
        onNoteAdded={vi.fn()}
        onEditorStateChange={vi.fn()}
      />,
    );

    const addButton = screen.getByRole<HTMLButtonElement>("button", {
      name: "Add",
    });
    expect(addButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Customer / Internal Note"), {
      target: { value: "   " },
    });

    expect(addButton.disabled).toBe(true);
  });

  it("LoadInternalNotes_whenEditedNoteIsSaved_commitsTheTrimmedChange", () => {
    const onNoteAdded = vi.fn();
    const onEditorStateChange = vi.fn();
    render(
      <LoadInternalNotes
        initialNotes={["Original note"]}
        onNoteAdded={onNoteAdded}
        onEditorStateChange={onEditorStateChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit internal notes" }));
    fireEvent.change(screen.getByLabelText("Internal note 1"), {
      target: { value: "  Updated note  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save internal notes" }));

    expect(screen.getByText("Updated note")).toBeTruthy();
    expect(screen.queryByText("Original note")).toBeNull();
    expect(onNoteAdded).toHaveBeenCalledTimes(1);
    expect(onEditorStateChange).toHaveBeenNthCalledWith(1, true);
    expect(onEditorStateChange).toHaveBeenNthCalledWith(2, false);
  });

  it("LoadInternalNotes_whenDeletionIsConfirmedAndSaved_removesTheNote", async () => {
    const onNoteAdded = vi.fn();
    render(
      <LoadInternalNotes
        initialNotes={["Remove this note", "Keep this note"]}
        onNoteAdded={onNoteAdded}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit internal notes" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Delete internal note 1" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Save internal notes" }));

    expect(screen.queryByText("Remove this note")).toBeNull();
    expect(screen.getByText("Keep this note")).toBeTruthy();
    expect(onNoteAdded).toHaveBeenCalledTimes(1);
  });

  it("LoadInternalNotes_whenEditingIsCancelled_discardsTheDraft", () => {
    const onNoteAdded = vi.fn();
    render(
      <LoadInternalNotes
        initialNotes={["Original note"]}
        onNoteAdded={onNoteAdded}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit internal notes" }));
    fireEvent.change(screen.getByLabelText("Internal note 1"), {
      target: { value: "Changed note" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel internal note editing" }),
    );

    expect(screen.getByText("Original note")).toBeTruthy();
    expect(screen.queryByText("Changed note")).toBeNull();
    expect(onNoteAdded).not.toHaveBeenCalled();
  });
});
