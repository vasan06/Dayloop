import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Code2, GripVertical, Heading1, Heading2, List, ListOrdered, Plus, Quote, Search, Trash2, Type } from "lucide-react";
import { Card, ConfirmModal, Empty, ErrorBox, FormModal, PageHead, Skeleton } from "../components/ui";
import { useCreateNote, useDeleteNote, useNote, useNotes, useRenameNote, useSaveBlocks } from "../hooks/data";
import { useNewParam } from "../hooks/useNewParam";
import { shortDate } from "../lib/format";
import { toast } from "../lib/toast";

type BlockType = "paragraph" | "heading_1" | "heading_2" | "heading_3" | "heading_4" | "bulleted_list" | "numbered_list" | "todo" | "quote" | "callout" | "code" | "toggle" | "divider" | "columns";
type Draft = { id: string; type: BlockType; text: string; checked?: boolean; details?: string; columns?: [string, string]; expanded?: boolean };
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

const makeId = () => crypto.randomUUID();
const asBlockType = (value: string): BlockType => COMMANDS.some((command) => command.type === value) ? value as BlockType : "paragraph";
const toDrafts = (blocks: { block_type?: string; type?: string; content?: unknown }[]): Draft[] => blocks.map((block) => {
  const content = block.content && typeof block.content === "object" ? block.content as { text?: string; checked?: boolean; details?: string; columns?: [string, string] } : {};
  return { id: makeId(), type: asBlockType(block.block_type ?? block.type ?? "paragraph"), text: content.text ?? "", checked: Boolean(content.checked), details: content.details ?? "", columns: content.columns ?? ["", ""], expanded: false };
});

function Editor({ id }: { id: string }) {
  const note = useNote(id);
  const save = useSaveBlocks();
  const rename = useRenameNote();
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<Draft[]>([]);
  const loaded = useRef<string | null>(null);
  const savedTitle = useRef("");
  const [dirty, setDirty] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const focusId = useRef<string | null>(null);

  useEffect(() => {
    if (note.data && loaded.current !== id) {
      loaded.current = id;
      setTitle(note.data.item.title);
      savedTitle.current = note.data.item.title;
      setBlocks(toDrafts(note.data.blocks as { block_type?: string; content?: unknown }[]));
      setDirty(false);
      setActiveMenu(null);
    }
  }, [note.data, id]);

  useEffect(() => {
    if (focusId.current) {
      refs.current[focusId.current]?.focus();
      focusId.current = null;
    }
  }, [blocks]);

  const filtered = useMemo(() => COMMANDS.filter((command) => {
    const haystack = `${command.label} ${command.keywords}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [query]);

  const persist = () => {
    if (!dirty || !note.data) return;
    if (title.trim() && title.trim() !== savedTitle.current) {
      savedTitle.current = title.trim();
      rename.mutate({ id, title: title.trim() });
    }
    save.mutate({ id, blocks: blocks.map((block) => ({ type: block.type, content: { text: block.text, ...(block.type === "todo" ? { checked: Boolean(block.checked) } : {}), ...(block.type === "toggle" ? { details: block.details ?? "" } : {}), ...(block.type === "columns" ? { columns: block.columns ?? ["", ""] } : {}) } })) }, {
      onSuccess: () => { setDirty(false); toast("Note saved"); },
    });
  };

  useEffect(() => {
    if (!dirty || !note.data) return;
    const timer = window.setTimeout(persist, 1200);
    return () => window.clearTimeout(timer);
    // persist intentionally snapshots the latest editor state after the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, blocks, dirty, note.data]);

  const updateBlock = (blockId: string, patch: Partial<Draft>) => {
    setBlocks((current) => current.map((block) => block.id === blockId ? { ...block, ...patch } : block));
    setDirty(true);
  };

  const insertAfter = (blockId: string, type: BlockType = "paragraph") => {
    const next: Draft = { id: makeId(), type, text: "" };
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === blockId);
      return [...current.slice(0, index + 1), next, ...current.slice(index + 1)];
    });
    focusId.current = next.id;
    setDirty(true);
    return next;
  };

  const chooseCommand = (block: Draft, type: BlockType) => {
    const cleaned = block.text.replace(/(^|\s)\/[\w-]*$/, "$1");
    updateBlock(block.id, { type, text: cleaned.trimStart() });
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
      setDirty(true);
    }
  };

  if (note.isLoading) return <Skeleton rows={6} />;
  if (note.isError) return <ErrorBox error={note.error} retry={() => void note.refetch()} />;

  return (
    <div className="note-editor">
      <input className="note-title-input" aria-label="Note title" value={title} onChange={(event) => { setTitle(event.target.value); setDirty(true); }} placeholder="Untitled" />
      <div className="block-editor" onClick={() => { if (!blocks.length) { const first = { id: makeId(), type: "paragraph" as const, text: "" }; setBlocks([first]); focusId.current = first.id; setDirty(true); } }}>
        {blocks.map((block, index) => {
          const commandMenu = activeMenu === block.id;
          const CommandIcon = COMMANDS.find((command) => command.type === block.type)?.icon ?? Type;
          const listStart = blocks.slice(0, index).reverse().findIndex((item) => item.type !== "numbered_list");
          const listNumber = listStart === -1 ? index + 1 : listStart + 1;
          return (
            <div className={`editor-block block-${block.type}`} key={block.id}>
              <span className="block-grip" aria-hidden="true"><GripVertical /></span>
              {block.type === "todo" && <input className="block-checkbox" type="checkbox" checked={Boolean(block.checked)} onChange={(event) => updateBlock(block.id, { checked: event.target.checked })} aria-label="Mark to-do complete" />}
              {block.type === "divider" ? <hr /> : (
                <>
                  {block.type === "toggle" && <button type="button" className="block-type-mark toggle-expander" aria-label={block.expanded ? "Collapse toggle content" : "Expand toggle content"} aria-expanded={Boolean(block.expanded)} onClick={() => updateBlock(block.id, { expanded: !block.expanded })}>▸</button>}
                  {block.type === "bulleted_list" && <span className="block-list-mark">•</span>}
                  {block.type === "numbered_list" && <span className="block-list-mark">{listNumber}.</span>}
                  {block.type === "callout" && <span className="block-type-mark">✦</span>}
                  {block.type === "columns" ? <div className="block-columns-grid"><textarea rows={3} value={block.columns?.[0] ?? ""} onChange={(event) => updateBlock(block.id, { columns: [event.target.value, block.columns?.[1] ?? ""] })} placeholder="First column" aria-label={`First column, block ${index + 1}`} /><textarea rows={3} value={block.columns?.[1] ?? ""} onChange={(event) => updateBlock(block.id, { columns: [block.columns?.[0] ?? "", event.target.value] })} placeholder="Second column" aria-label={`Second column, block ${index + 1}`} /></div> : <textarea ref={(element) => { refs.current[block.id] = element; if (element) { element.style.height = "auto"; element.style.height = `${element.scrollHeight}px`; } }} rows={1} value={block.text} onChange={(event) => { event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`; onBlockChange(block, event.target.value); }} onKeyDown={(event) => onBlockKeyDown(event, block)} placeholder={block.type === "paragraph" ? "Type '/' for commands…" : block.type.replace(/_/g, " ")} className={`block-input ${block.checked ? "is-checked" : ""}`} aria-label={`Note block ${index + 1}`} />}
                  {block.type === "toggle" && block.expanded && <textarea className="block-input toggle-details" rows={2} value={block.details ?? ""} onChange={(event) => updateBlock(block.id, { details: event.target.value })} placeholder="Hidden toggle content…" aria-label={`Toggle details, block ${index + 1}`} />}
                </>
              )}
              <button className="block-type-button" type="button" title="Change block type" aria-label="Change block type" onClick={() => { setActiveMenu(commandMenu ? null : block.id); setQuery(""); }}><CommandIcon /></button>
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
        <button type="button" className="add-block-button" onClick={() => { const last = blocks[blocks.length - 1]; if (last) insertAfter(last.id); else { const first = { id: makeId(), type: "paragraph" as const, text: "" }; setBlocks([first]); focusId.current = first.id; setDirty(true); } }}><Plus /> Add a block</button>
      </div>
      <div className="row sb sm mute note-savebar"><span>{dirty ? "Changes pending…" : save.isPending ? "Saving…" : "All changes saved"}</span><button className="btn sm" onClick={persist} disabled={save.isPending}>Save now</button></div>
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
  const list = (notes.data ?? []).filter((note) => !q || note.title.toLowerCase().includes(q.toLowerCase()));
  const selected = params.get("open") ?? list[0]?.id ?? null;
  const select = (noteId: string) => setParams((current) => { current.set("open", noteId); return current; }, { replace: true });

  return (
    <>
      <PageHead title="Notes" sub={`${notes.data?.length ?? 0} pages · write with structured blocks`}><button className="btn pri" onClick={showNew}><Plus className="ic" />New note</button></PageHead>
      <div className="g">
        <Card className="s4">
          <label className="search2 search"><Search className="ic" /><input placeholder="Search notes" aria-label="Search notes" value={q} onChange={(event) => setQ(event.target.value)} /></label>
          {notes.isLoading ? <Skeleton /> : notes.isError ? <ErrorBox error={notes.error} retry={() => void notes.refetch()} /> : list.length === 0 ? <Empty title="No notes" hint="Capture ideas, meeting notes, anything." /> : <div className="list">{list.map((note) => (
            <button key={note.id} className="li" onClick={() => select(note.id)} style={{ border: 0, background: note.id === selected ? "var(--acc-soft)" : undefined, cursor: "pointer", textAlign: "left" }}>
              <div className="t"><b>{note.title}</b><div className="mono">{shortDate(note.updated_at)}</div></div>
            </button>
          ))}</div>}
        </Card>
        <Card className="s8">
          {selected ? <><div className="row" style={{ justifyContent: "flex-end", marginBottom: 6 }}><button className="btn sm ghost" onClick={() => setDeleting(true)}><Trash2 className="ic" style={{ width: 14, height: 14 }} />Delete</button></div><Editor key={selected} id={selected} /></> : <Empty title="Select or create a note" hint="Your writing is saved automatically." />}
        </Card>
      </div>
      {isNew && <FormModal title="New note" busy={create.isPending} onClose={closeNew} fields={[{ name: "title", label: "Title", required: true }]} onSubmit={(value) => create.mutate({ title: value.title.trim() }, { onSuccess: (result) => { closeNew(); select((result as { item: { id: string } }).item.id); } })} />}
      {deleting && selected && <ConfirmModal title="Delete note?" body="This note will be removed." onConfirm={() => { remove.mutate(selected); setParams((current) => { current.delete("open"); return current; }, { replace: true }); }} onClose={() => setDeleting(false)} />}
    </>
  );
}
