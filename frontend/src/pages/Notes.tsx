import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, Trash2 } from "lucide-react";
import { Card, ConfirmModal, Empty, ErrorBox, FormModal, PageHead, Skeleton } from "../components/ui";
import { useCreateNote, useDeleteNote, useNote, useNotes, useRenameNote, useSaveBlocks } from "../hooks/data";
import { useNewParam } from "../hooks/useNewParam";
import { shortDate } from "../lib/format";
import { toast } from "../lib/toast";

type Draft = { type: string; text: string };

function Editor({ id }: { id: string }) {
  const note = useNote(id);
  const save = useSaveBlocks();
  const rename = useRenameNote();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const loaded = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (note.data && loaded.current !== id) {
      loaded.current = id;
      setTitle(note.data.item.title);
      setBody(note.data.blocks.map((b) => b.content.text ?? "").join("\n\n"));
      setDirty(false);
    }
  }, [note.data, id]);

  const persist = () => {
    const blocks: Draft[] = body.split(/\n{2,}/).map((t) => t.trimEnd()).filter(Boolean).map((text) => ({ type: "paragraph", text }));
    if (title.trim() && title !== note.data?.item.title) rename.mutate({ id, title: title.trim() });
    save.mutate({ id, blocks: blocks.map((b) => ({ type: b.type, content: { text: b.text } })) }, { onSuccess: () => { setDirty(false); toast("Note saved"); } });
  };

  // Autosave after 1.5s of inactivity.
  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(persist, 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, dirty]);

  if (note.isLoading) return <Skeleton rows={6} />;
  if (note.isError) return <ErrorBox error={note.error} retry={() => void note.refetch()} />;
  return (
    <div>
      <input aria-label="Note title" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} style={{ width: "100%", border: 0, background: "none", outline: 0, fontFamily: "var(--f-d)", fontSize: 26, fontWeight: 600, letterSpacing: "-.03em", marginBottom: 10 }} />
      <textarea aria-label="Note body" value={body} placeholder="Start writing… separate paragraphs with a blank line." onChange={(e) => { setBody(e.target.value); setDirty(true); }} style={{ width: "100%", minHeight: 360, border: 0, background: "none", outline: 0, resize: "vertical", lineHeight: 1.7, fontSize: 15 }} />
      <div className="row sb sm mute"><span>{dirty ? "Unsaved changes…" : save.isPending ? "Saving…" : "All changes saved"}</span><button className="btn sm" onClick={persist} disabled={save.isPending}>Save now</button></div>
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
  const list = (notes.data ?? []).filter((n) => !q || n.title.toLowerCase().includes(q.toLowerCase()));
  const selected = params.get("open") ?? list[0]?.id ?? null;
  const select = (id: string) => setParams((p) => { p.set("open", id); return p; }, { replace: true });

  return (
    <>
      <PageHead title="Notes" sub={`${notes.data?.length ?? 0} pages`}><button className="btn pri" onClick={showNew}><Plus className="ic" />New note</button></PageHead>
      <div className="g">
        <Card className="s4">
          <label className="search2 search"><Search className="ic" /><input placeholder="Search notes" aria-label="Search notes" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          {notes.isLoading ? <Skeleton /> : notes.isError ? <ErrorBox error={notes.error} retry={() => void notes.refetch()} /> : list.length === 0 ? <Empty title="No notes" hint="Capture ideas, meeting notes, anything." /> : <div className="list">{list.map((n) => (
            <button key={n.id} className="li" onClick={() => select(n.id)} style={{ border: 0, background: n.id === selected ? "var(--acc-soft)" : undefined, cursor: "pointer", textAlign: "left" }}>
              <div className="t"><b>{n.title}</b><div className="mono">{shortDate(n.updated_at)}</div></div>
            </button>
          ))}</div>}
        </Card>
        <Card className="s8">
          {selected ? <><div className="row" style={{ justifyContent: "flex-end", marginBottom: 6 }}><button className="btn sm ghost" onClick={() => setDeleting(true)}><Trash2 className="ic" style={{ width: 14, height: 14 }} />Delete</button></div><Editor key={selected} id={selected} /></> : <Empty title="Select or create a note" hint="Your writing is saved automatically." />}
        </Card>
      </div>
      {isNew && <FormModal title="New note" busy={create.isPending} onClose={closeNew} fields={[{ name: "title", label: "Title", required: true }]} onSubmit={(v) => create.mutate({ title: v.title.trim() }, { onSuccess: (r) => { closeNew(); select((r as { item: { id: string } }).item.id); } })} />}
      {deleting && selected && <ConfirmModal title="Delete note?" body="This note will be removed." onConfirm={() => { remove.mutate(selected); setParams((p) => { p.delete("open"); return p; }, { replace: true }); }} onClose={() => setDeleting(false)} />}
    </>
  );
}
