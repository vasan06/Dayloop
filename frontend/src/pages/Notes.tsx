import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, BookOpen, Check, ChevronDown, Clock3, Code2, FileText, GripVertical, Heading1, Heading2, List, ListOrdered, Plus, Quote, Search, Trash2, Type, X } from "lucide-react";
import { ConfirmModal, Empty, ErrorBox, FormModal, Skeleton } from "../components/ui";
import { keys, useCreateNote, useDeleteNote, useNote, useNotes } from "../hooks/data";
import { useNewParam } from "../hooks/useNewParam";
import { shortDate } from "../lib/format";
import { toast } from "../lib/toast";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { Autosave } from "../lib/autosave";
import { apiRequest } from "../lib/api";
import type { NotePage, NoteBlock } from "../lib/types";
import "../styles/notes.css";

type BlockType = "paragraph" | "heading_1" | "heading_2" | "heading_3" | "heading_4" | "bulleted_list" | "numbered_list" | "todo" | "quote" | "callout" | "code" | "toggle" | "divider" | "columns";
type Draft = { id: string; type: BlockType; text: string; checked?: boolean; details?: string; columns?: [string, string]; expanded?: boolean; originalType?: string; originalContent?: Record<string, unknown> };
type Command = { type: BlockType; label: string; description: string; keywords: string; icon: typeof Type };

const COMMANDS: Command[] = [
  { type: "paragraph", label: "Text", description: "Start writing with plain text", keywords: "text paragraph normal", icon: Type },
  { type: "heading_1", label: "Heading 1", description: "Large section heading", keywords: "heading h1 title", icon: Heading1 },
  { type: "heading_2", label: "Heading 2", description: "Medium section heading", keywords: "heading h2 subtitle", icon: Heading2 },
  { type: "heading_3", label: "Heading 3", description: "Small section heading", keywords: "heading h3", icon: Heading2 },
  { type: "heading_4", label: "Heading 4", description: "Compact heading", keywords: "heading h4", icon: Heading2 },
  { type: "bulleted_list", label: "Bulleted list", description: "Create a simple bullet list", keywords: "bullet bulleted unordered list", icon: List },
  { type: "numbered_list", label: "Numbered list", description: "Create an ordered list", keywords: "number numbered ordered list", icon: ListOrdered },
  { type: "todo", label: "To-do", description: "Track a task with a checkbox", keywords: "todo task checkbox check", icon: Check },
  { type: "quote", label: "Quote", description: "Highlight a quotation", keywords: "quote blockquote", icon: Quote },
  { type: "callout", label: "Callout", description: "Emphasize an important note", keywords: "callout info note", icon: Plus },
  { type: "code", label: "Code", description: "Write or paste code", keywords: "code snippet programming", icon: Code2 },
  { type: "toggle", label: "Toggle", description: "Expandable text section", keywords: "toggle details collapsible", icon: Plus },
  { type: "divider", label: "Divider", description: "Separate sections", keywords: "divider separator line", icon: Plus },
  { type: "columns", label: "Columns", description: "Create a two-column content area", keywords: "columns layout", icon: Plus },
];

let nextBlockId = 0;
const makeId = () => `block-${++nextBlockId}`;
const asBlockType = (value: string): BlockType => COMMANDS.some((command) => command.type === value) ? value as BlockType : "paragraph";
const toDrafts = (blocks: { block_type?: string; type?: string; content?: unknown }[]): Draft[] => blocks.map((block) => {
  const content = block.content && typeof block.content === "object" ? block.content as { text?: string; checked?: boolean; details?: string; columns?: [string, string] } : {};
  const originalType = block.block_type ?? block.type ?? "paragraph";
  return { id: makeId(), originalType, originalContent: content, type: asBlockType(originalType), text: content.text ?? "", checked: Boolean(content.checked), details: content.details ?? "", columns: content.columns ?? ["", ""], expanded: false };
});

type NoteDraft = { title: string; blocks: Draft[] };
const sessions = new WeakMap<QueryClient, Map<string, Autosave<NoteDraft>>>();

function noteAutosave(client: QueryClient, id: string) {
  let notes = sessions.get(client);
  if (!notes) {
    notes = new Map();
    sessions.set(client, notes);
  }
  const existing = notes.get(id);
  if (existing) return existing;

  const queue = new Autosave<NoteDraft>(async (draft) => {
    const title = draft.title.trim() || "Untitled";
    const blocks = draft.blocks.map((block) => ({
      type: block.originalType ?? block.type,
      content: {
        ...block.originalContent, text: block.text,
        ...(block.type === "todo" ? { checked: Boolean(block.checked) } : {}),
        ...(block.type === "toggle" ? { details: block.details ?? "" } : {}),
        ...(block.type === "columns" ? { columns: block.columns ?? ["", ""] } : {}),
      },
    }));
    try {
      await apiRequest(`/notes/${id}/blocks`, { method: "PUT", body: JSON.stringify({ title, blocks }) });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save this note.", "error");
      throw error;
    }
    client.setQueryData<{item: NotePage; blocks: NoteBlock[]}>(["note", id], (previous) => previous && ({
      item: { ...previous.item, title },
      blocks: blocks.map((block) => ({ block_type: block.type, content: block.content })),
    }));
    void client.invalidateQueries({ queryKey: keys.notes });
  });
  notes.set(id, queue);
  return queue;
}

function Editor({ id, onDelete }: { id: string; onDelete: () => void }) {
  const note = useNote(id);
  const client = useQueryClient();
  const queue = useMemo(() => noteAutosave(client, id), [client, id]);
  const status = useSyncExternalStore(queue.subscribe, queue.getStatus);
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<Draft[]>([]);
  const loaded = useRef<string | null>(null);
  const edited = useRef(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const focusId = useRef<string | null>(null);
  const menuBlock = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = paper.current;
    if (!element) return;
    let width = 0;
    const observer = new ResizeObserver(([entry]) => {
      if (width === entry.contentRect.width) return;
      width = entry.contentRect.width;
      for (const input of Object.values(refs.current)) {
        if (!input) continue;
        input.style.height = "auto";
        input.style.height = `${input.scrollHeight}px`;
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [note.isLoading, note.isError]);

  useEffect(() => {
    if (!activeMenu) return;
    const dismiss = (event: PointerEvent | FocusEvent) => {
      if (event.target instanceof Node && !menuBlock.current?.contains(event.target)) setActiveMenu(null);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
    };
  }, [activeMenu]);

  useEffect(() => {
    if (note.data && loaded.current !== id) {
      loaded.current = id;
      setTitle(queue.draft?.title ?? note.data.item.title);
      setBlocks(queue.draft?.blocks ?? toDrafts(note.data.blocks));
      setActiveMenu(null);
    }
  }, [note.data, id, queue]);

  useEffect(() => {
    if (focusId.current) {
      const target = refs.current[focusId.current];
      target?.focus();
      target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      focusId.current = null;
    }
  }, [blocks]);

  const filtered = useMemo(() => COMMANDS.filter((command) => {
    const haystack = `${command.label} ${command.keywords}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [query]);

  useLayoutEffect(() => {
    if (!edited.current) return;
    edited.current = false;
    queue.edit({ title, blocks });
    const timer = window.setTimeout(queue.flush, 2500);
    return () => window.clearTimeout(timer);
  }, [queue, title, blocks]);

  useEffect(() => {
    const warnIfUnsaved = (event: BeforeUnloadEvent) => {
      if (queue.draft !== undefined) event.preventDefault();
    };
    window.addEventListener("beforeunload", warnIfUnsaved);
    return () => {
      window.removeEventListener("beforeunload", warnIfUnsaved);
      void queue.flush();
    };
  }, [queue]);

  const updateBlock = (blockId: string, patch: Partial<Draft>) => {
    setBlocks((current) => current.map((block) => block.id === blockId ? { ...block, ...patch } : block));
    edited.current = true;
  };

  const insertAfter = (blockId: string, type: BlockType = "paragraph") => {
    const next: Draft = { id: makeId(), type, text: "" };
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === blockId);
      return [...current.slice(0, index + 1), next, ...current.slice(index + 1)];
    });
    focusId.current = next.id;
    edited.current = true;
    return next;
  };

  const chooseCommand = (block: Draft, type: BlockType) => {
    const cleaned = block.text.replace(/(^|\s)\/[\w-]*$/, "$1");
    updateBlock(block.id, { type, originalType: undefined, originalContent: undefined, text: cleaned.trimStart() });
    setActiveMenu(null);
    setQuery("");
    setHighlighted(0);
    requestAnimationFrame(() => refs.current[block.id]?.focus());
  };

  const onBlockChange = (block: Draft, value: string) => {
    updateBlock(block.id, { text: value });
    const match = value.match(/(?:^|\s)\/([\w-]*)$/);
    if (match) {
      setActiveMenu(block.id);
      setQuery(match[1]);
      setHighlighted(0);
    } else if (activeMenu === block.id) {
      setActiveMenu(null);
      setQuery("");
    }
  };

  const onBlockKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>, block: Draft) => {
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      const index = blocks.findIndex((item) => item.id === block.id);
      const target = event.key === "ArrowUp" ? index - 1 : index + 1;
      if (target < 0 || target >= blocks.length) return;
      const reordered = [...blocks];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(target, 0, moved);
      setBlocks(reordered);
      edited.current = true;
      requestAnimationFrame(() => refs.current[block.id]?.focus());
      return;
    }
    if (activeMenu === block.id) {
      if (event.key === "ArrowDown") { event.preventDefault(); setHighlighted((index) => Math.min(filtered.length - 1, index + 1)); return; }
      if (event.key === "ArrowUp") { event.preventDefault(); setHighlighted((index) => Math.max(0, index - 1)); return; }
      if (event.key === "Escape") { event.preventDefault(); setActiveMenu(null); setQuery(""); return; }
      if (event.key === "Enter") { event.preventDefault(); if (filtered[highlighted]) chooseCommand(block, filtered[highlighted].type); return; }
    }
    if (event.key === "Enter" && !event.shiftKey && block.type !== "code") {
      event.preventDefault();
      const nextType: BlockType = ["bulleted_list", "numbered_list", "todo"].includes(block.type)
        ? (block.text.trim() ? block.type : "paragraph")
        : "paragraph";
      insertAfter(block.id, nextType);
    }
    if (event.key === "Backspace" && !block.text && blocks.length > 1) {
      event.preventDefault();
      const index = blocks.findIndex((item) => item.id === block.id);
      const previous = blocks[index - 1];
      setBlocks((current) => current.filter((item) => item.id !== block.id));
      if (previous) focusId.current = previous.id;
      edited.current = true;
    }
  };

  if (note.isLoading) return <div className="notebook-state"><Skeleton rows={6} /></div>;
  if (note.isError) return <div className="notebook-state"><ErrorBox error={note.error} retry={() => void note.refetch()} /></div>;
  const StatusIcon = status === "error" ? AlertCircle : status === "saved" ? Check : Clock3;

  return (
    <div className="note-editor">
      <div className="note-toolbar">
        <span className="note-save-status" role="status" data-status={status}>
          <StatusIcon aria-hidden="true" />
          {status === "error" ? queue.error : status === "saved" ? "All changes saved" : status === "pending" ? "Changes pending" : "Saving…"}
        </span>
        {status === "error" && <button className="note-retry" type="button" onClick={() => void queue.flush()}>Retry save</button>}
        <button className="note-delete" type="button" onClick={onDelete} aria-label="Delete note"><Trash2 aria-hidden="true" />Delete</button>
      </div>
      <div className="note-paper" ref={paper}>
        <input className="note-title-input" aria-label="Note title" maxLength={240} value={title} onBlur={() => { if (!title.trim()) { setTitle("Untitled"); edited.current = true; } }} onChange={(event) => { setTitle(event.target.value); edited.current = true; }} placeholder="Untitled" />
        <div className="note-metadata">
          {note.data?.item.created_at && <span>Created {shortDate(note.data.item.created_at)}</span>}
          <span>{blocks.length} {blocks.length === 1 ? "block" : "blocks"}</span>
        </div>
        <div className="block-editor">
          {blocks.length === 0 && (
            <button className="note-start-writing" type="button" onClick={() => insertAfter("")}>
              Start writing…
            </button>
          )}
          {blocks.map((block, index) => {
            const commandMenu = activeMenu === block.id;
            const CommandIcon = COMMANDS.find((command) => command.type === block.type)?.icon ?? Type;
            const listStart = blocks.slice(0, index).reverse().findIndex((item) => item.type !== "numbered_list");
            const listNumber = listStart === -1 ? index + 1 : listStart + 1;
            return (
              <div
                className={`editor-block block-${block.type}${dropId === block.id ? " drop-target" : ""}`}
                key={block.id}
                ref={commandMenu ? menuBlock : undefined}
                onKeyDown={(event) => {
                  if (!commandMenu || event.key !== "Escape") return;
                  setActiveMenu(null);
                  event.currentTarget.querySelector<HTMLButtonElement>(".block-type-button")?.focus();
                }}
                onDragEnd={() => { setDragId(null); setDropId(null); }}
                onDragStart={(event) => { setDragId(block.id); event.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropId(block.id); }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (!dragId || dragId === block.id) return;
                  const reordered = [...blocks];
                  const from = reordered.findIndex((item) => item.id === dragId);
                  const [moved] = reordered.splice(from, 1);
                  const to = reordered.findIndex((item) => item.id === block.id);
                  reordered.splice(to, 0, moved);
                  setBlocks(reordered);
                  edited.current = true;
                  setDragId(null);
                  setDropId(null);
                }}
              >
                <div className="block-line">
                  <span draggable className="block-grip" role="button" tabIndex={0} aria-label={`Move block ${index + 1}. Use Alt plus arrow keys.`} onKeyDown={(event) => {
                    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
                    event.preventDefault();
                    const target = event.key === "ArrowUp" ? index - 1 : index + 1;
                    if (target < 0 || target >= blocks.length) return;
                    const reordered = [...blocks];
                    const [moved] = reordered.splice(index, 1);
                    reordered.splice(target, 0, moved);
                    setBlocks(reordered);
                    edited.current = true;
                  }}><GripVertical /></span>
                  {block.type === "todo" && <input className="block-checkbox" type="checkbox" checked={Boolean(block.checked)} onChange={(event) => updateBlock(block.id, { checked: event.target.checked })} aria-label="Mark to-do complete" />}
                  {block.type === "divider" ? <hr /> : (
                    <>
                      {block.type === "toggle" && <button type="button" className="block-type-mark toggle-expander" aria-label={block.expanded ? "Collapse toggle content" : "Expand toggle content"} aria-expanded={Boolean(block.expanded)} onClick={() => updateBlock(block.id, { expanded: !block.expanded })}>▸</button>}
                      {block.type === "bulleted_list" && <span className="block-list-mark">•</span>}
                      {block.type === "numbered_list" && <span className="block-list-mark">{listNumber}.</span>}
                      {block.type === "callout" && <span className="block-type-mark">✦</span>}
                      {block.type === "columns" ? <div className="block-columns-grid"><textarea rows={3} value={block.columns?.[0] ?? ""} onChange={(event) => updateBlock(block.id, { columns: [event.target.value, block.columns?.[1] ?? ""] })} placeholder="First column" aria-label={`First column, block ${index + 1}`} /><textarea rows={3} value={block.columns?.[1] ?? ""} onChange={(event) => updateBlock(block.id, { columns: [block.columns?.[0] ?? "", event.target.value] })} placeholder="Second column" aria-label={`Second column, block ${index + 1}`} /></div> : <textarea ref={(element) => { refs.current[block.id] = element; if (element) { element.style.height = "auto"; element.style.height = `${element.scrollHeight}px`; } }} rows={1} value={block.text} onChange={(event) => { event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`; onBlockChange(block, event.target.value); }} onKeyDown={(event) => onBlockKeyDown(event, block)} placeholder={block.type === "paragraph" ? "Type '/' for commands…" : block.type.replace(/_/g, " ")} className={`block-input ${block.checked ? "is-checked" : ""}`} aria-label={`Note block ${index + 1}`} />}
                    </>
                  )}
                  <label className="block-type-select-wrap" title="Change block type live"><CommandIcon /><select className="block-type-select" aria-label={`Change block ${index + 1} type`} value={block.type} onChange={(event) => updateBlock(block.id, { type: event.target.value as BlockType, originalType: undefined, originalContent: undefined })}>{COMMANDS.map((command) => <option key={command.type} value={command.type}>{command.label}</option>)}</select></label>
                  <button className="block-type-button" type="button" title="Open block commands" aria-label="Open block commands" aria-expanded={commandMenu} aria-haspopup="listbox" onClick={() => { setActiveMenu(commandMenu ? null : block.id); setQuery(""); setHighlighted(0); }}><CommandIcon /></button>
                </div>
                {block.type === "toggle" && block.expanded && <textarea className="block-input toggle-details" rows={2} value={block.details ?? ""} onChange={(event) => updateBlock(block.id, { details: event.target.value })} placeholder="Hidden toggle content…" aria-label={`Toggle details, block ${index + 1}`} />}
                {commandMenu && <div className="slash-menu" role="listbox" aria-label="Insert a block">
                  <div className="slash-menu-heading">{query ? `Commands matching “${query}”` : "Basic blocks"}</div>
                  {filtered.length ? filtered.map((command, commandIndex) => {
                    const Icon = command.icon;
                    return <button key={command.type} type="button" role="option" aria-selected={commandIndex === highlighted} className={commandIndex === highlighted ? "active" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseCommand(block, command.type)}><Icon /><span><b>{command.label}</b><small>{command.description}</small></span></button>;
                  }) : <p className="slash-no-results">No matching blocks</p>}
                </div>}
              </div>
            );
          })}
          <button type="button" className="add-block-button" onClick={() => insertAfter(blocks[blocks.length - 1]?.id ?? "")}><Plus />Add a block</button>
        </div>
      </div>
    </div>
  );
}

export default function Notes() {
  const notes = useNotes();
  const create = useCreateNote();
  const remove = useDeleteNote();
  const [params, setParams] = useSearchParams();
  const [isNew, closeNew, showNew] = useNewParam();
  const [q, setQ] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const list = (notes.data ?? []).filter((note) => !q || note.title.toLowerCase().includes(q.toLowerCase()));
  const selected = params.get("open") ?? notes.data?.[0]?.id ?? null;
  const select = (noteId: string) => {
    setParams((current) => { current.set("open", noteId); return current; }, { replace: true });
    setLibraryOpen(false);
  };

  return (
    <div className="notes-workspace">
      <header className="notes-workspace-head">
        <div><span className="mono">KNOWLEDGE SPACE</span><h1>Notes</h1><p>Capture ideas, structure plans, and keep long-form thinking in one place.</p></div>
        <div className="notes-head-actions"><span>{notes.data?.length ?? 0} pages</span><button className="btn pri" onClick={showNew}><Plus className="ic" />New note</button></div>
      </header>
      <div className="notebook">
        <aside className="notebook-index" aria-label="Note library">
          <div className="notebook-index-head">
            <h2><BookOpen aria-hidden="true" />Library</h2>
            {notes.data && <span className="notebook-count">{notes.data.length} {notes.data.length === 1 ? "note" : "notes"}</span>}
            <button className="notebook-library-toggle" type="button" aria-expanded={libraryOpen} aria-controls="note-library-list" onClick={() => setLibraryOpen(!libraryOpen)}>
              {libraryOpen ? "Close library" : "Browse notes"}<ChevronDown aria-hidden="true" />
            </button>
          </div>
          <div id="note-library-list" className={`notebook-library${libraryOpen ? " is-open" : ""}`}>
            <div className="notebook-search">
              <Search aria-hidden="true" />
              <input ref={searchRef} placeholder="Search notes" aria-label="Search notes" value={q} onChange={(event) => setQ(event.target.value)} />
              {q && <button type="button" aria-label="Clear search" onClick={() => { setQ(""); searchRef.current?.focus(); }}><X aria-hidden="true" /></button>}
            </div>
            {notes.isLoading ? <Skeleton /> : notes.isError ? <ErrorBox error={notes.error} retry={() => void notes.refetch()} /> : list.length === 0 ? (
              <p className="notebook-index-empty" role="status">{q ? "No matching notes." : "No notes yet."}</p>
            ) : <nav aria-label="Notes" className="notebook-pages">{list.map((note) => (
              <button key={note.id} type="button" className="notebook-link" aria-current={note.id === selected ? "page" : undefined} onClick={() => select(note.id)}>
                <FileText aria-hidden="true" />
                <span><strong>{note.title}</strong><small>Edited {shortDate(note.updated_at)}</small></span>
              </button>
            ))}</nav>}
          </div>
        </aside>
        <section className="notebook-document" aria-label="Note editor">
          {selected ? <Editor key={selected} id={selected} onDelete={() => setDeleting(true)} /> : notes.isLoading ? <div className="notebook-state"><Skeleton /></div> : notes.isError ? (
            <div className="notebook-state"><ErrorBox error={notes.error} retry={() => void notes.refetch()} /></div>
          ) : <Empty title="Create your first note" hint="Use text, lists and other blocks to build your page." action={<button className="btn" onClick={showNew}><Plus className="ic" />New note</button>} />}
        </section>
      </div>
      {isNew && <FormModal title="New note" busy={create.isPending} onClose={closeNew} fields={[{ name: "title", label: "Title", required: true }]} onSubmit={(value) => create.mutate({ title: value.title.trim() }, { onSuccess: (result) => {
        setQ("");
        setLibraryOpen(false);
        setParams({ open: result.item.id }, { replace: true });
      } })} />}
      {deleting && selected && <ConfirmModal title="Delete note?" body="This note and its blocks will be removed." onConfirm={() => remove.mutate(selected, { onSuccess: () => {
        setParams((current) => { if (current.get("open") === selected) current.delete("open"); return current; }, { replace: true });
      } })} onClose={() => setDeleting(false)} />}
    </div>
  );
}
