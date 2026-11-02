// Controlador independente de React: uma operação por vez e CAS no servidor.
import { parseConsultation, hasContent } from './model.js';
export class ConsultationSync {
  constructor({ store, getLocal, applyRemote, onState, isEditing = () => false, now = () => Date.now() }) {
    Object.assign(this, { store, getLocal, applyRemote, onState, isEditing, now });
    this.version = null; this.dirty = false; this.active = false; this.busy = false; this.closed = false;
    this.state = { phase: 'disabled', remote: null, expiresAt: null };
  }
  emit(phase, extra = {}) { this.state = { ...this.state, phase, ...extra }; if (!this.closed) this.onState(this.state); }
  valid(row) { return row && Date.parse(row.expires_at) > this.now(); }
  changed() { this.dirty = true; if (this.active && !['conflict','expired'].includes(this.state.phase)) this.emit('pending'); }
  accept(row) {
    const doc = parseConsultation(row.payload);
    this.version = row.version; this.dirty = false; this.applyRemote(doc);
    this.emit('synced', { remote: null, expiresAt: row.expires_at });
  }
  async connect() {
    if (this.busy || this.closed) return;
    this.active = true; this.dirty = this.dirty || hasContent(this.getLocal()); this.busy = true; this.emit('loading');
    try {
      const row = await this.store.read(); if (this.closed) return;
      if (this.valid(row)) {
        if (hasContent(this.getLocal()) || this.isEditing()) { this.dirty = true; this.emit('conflict', { remote: row, expiresAt: row.expires_at }); }
        else this.accept(row);
      } else { this.version = null; this.dirty = true; this.emit('pending'); }
    } catch { this.emit('error'); }
    finally { this.busy = false; }
  }
  async tick() {
    if (!this.active || this.busy || this.closed || ['conflict','expired'].includes(this.state.phase)) return;
    if (this.version && this.state.expiresAt && Date.parse(this.state.expiresAt) <= this.now()) { this.emit('expired'); return; }
    this.busy = true;
    try {
      const beforeRead = JSON.stringify(this.getLocal());
      let row = await this.store.read(); if (this.closed) return;
      if (JSON.stringify(this.getLocal()) !== beforeRead) this.dirty = true;
      if (row && !this.valid(row)) {
        if (this.version) { this.emit('expired'); return; }
        row = null;
      }
      if (row?.version !== this.version && (row || this.version)) {
        if (this.dirty || this.isEditing() || !row) this.emit('conflict', { remote: row || null });
        else this.accept(row);
        return;
      }
      if (!this.dirty) { if (!row) this.emit('pending'); else this.emit('synced'); return; }
      const snapshot = parseConsultation(this.getLocal());
      const serialized = JSON.stringify(snapshot);
      this.emit('syncing');
      const result = await this.store.save(this.version, snapshot); if (this.closed) return;
      if (result.status !== 'saved') { this.emit('conflict', { remote: this.valid(result.row) ? result.row : null }); return; }
      this.version = result.row.version;
      this.dirty = JSON.stringify(this.getLocal()) !== serialized;
      this.emit(this.dirty ? 'pending' : 'synced', { expiresAt: result.row.expires_at, remote: null });
    } catch { this.emit('error'); }
    finally { this.busy = false; }
  }
  async useRemote() {
    if (this.busy || this.closed) return;
    this.busy = true;
    try { const row = await this.store.read(); if (this.closed) return; if (!this.valid(row)) { this.emit('expired'); return; } this.accept(row); }
    catch { this.emit('error'); } finally { this.busy = false; }
  }
  async clear() {
    if (this.busy || this.closed || !this.version) return false;
    this.busy = true;
    try {
      const deleted = await this.store.remove(this.version);
      if (this.closed) return false;
      if (!deleted) { this.emit('conflict', { remote: null }); return false; }
      this.version = null; this.active = false; this.dirty = false;
      this.emit('disabled', { remote: null, expiresAt: null }); return true;
    } catch { this.emit('error'); return false; } finally { this.busy = false; }
  }
  detach() {
    if(this.busy || this.closed)return false;
    this.active=false;this.version=null;this.dirty=false;
    this.emit('disabled',{remote:null,expiresAt:null});return true;
  }
  stop() { this.closed = true; this.active = false; }
}
