type SaveStatus = "pending" | "saving" | "saved" | "error";

/** Serializes writes while retaining edits made during an in-flight save. */
export class Autosave<T> {
  draft: T | undefined;
  status: SaveStatus = "saved";
  error = "";
  private revision = 0;
  private writing?: Promise<void>;
  private listeners = new Set<() => void>();
  private persist: (value: T) => Promise<void>;

  constructor(persist: (value: T) => Promise<void>) {
    this.persist = persist;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getStatus = () => this.status;

  private notify(status: SaveStatus) {
    this.status = status;
    this.listeners.forEach((listener) => listener());
  }

  edit(draft: T) {
    this.draft = draft;
    this.revision++;
    this.notify("pending");
  }

  flush = (): Promise<void> => {
    if (!this.writing && this.draft !== undefined) {
      this.writing = this.write().finally(() => { this.writing = undefined; });
    }
    return this.writing ?? Promise.resolve();
  };

  private async write() {
    while (this.draft !== undefined) {
      const revision = this.revision;
      this.notify("saving");
      try {
        await this.persist(this.draft);
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Could not save this note.";
        this.notify("error");
        return;
      }
      if (revision === this.revision) this.draft = undefined;
    }
    this.notify("saved");
  }
}
