import { useState, useEffect, useCallback } from "react";
import {
  Plus, X, Trash2, Users, CalendarDays, Clock, MapPin,
  Pencil, Check, GraduationCap, ChevronRight, UserPlus, Minus,
} from "lucide-react";
import { apiUrl } from "@/lib/api";

interface Workshop {
  id: number;
  horarioId: string;
  sede: string;
  teacher: string;
  name: string;
  workshopDate: string;
  workshopTime: string;
  maxStudents: number;
  students: string[];
  createdAt: string;
}

interface Props {
  horarioId: string;
  activeSede: string;
  allSedes: string[];
  sedeDisplayName: (s: string) => string;
}

const MAX_STUDENTS = 8;

export default function TalleresTab({ horarioId, activeSede, allSedes, sedeDisplayName }: Props) {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Workshop | null>(null);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [formTeacher, setFormTeacher] = useState("");
  const [formName, setFormName] = useState("");
  const [formSede, setFormSede] = useState(activeSede);
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // ── Detail panel state ─────────────────────────────────────────────────────
  const [addStudent, setAddStudent] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);
  const [addError, setAddError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchWorkshops = useCallback(async () => {
    try {
      const res = await fetch(
        apiUrl(`/api/workshops?horarioId=${encodeURIComponent(horarioId)}&sede=${encodeURIComponent(activeSede)}`)
      );
      if (!res.ok) throw new Error();
      const data: Workshop[] = await res.json();
      setWorkshops(data);
      if (selected) {
        const updated = data.find(w => w.id === selected.id);
        setSelected(updated ?? null);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [horarioId, activeSede]);

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    setWorkshops([]);
    fetchWorkshops();
  }, [horarioId, activeSede]);

  // ── Reset form when sede changes ───────────────────────────────────────────
  useEffect(() => {
    setFormSede(activeSede);
  }, [activeSede]);

  // ── Create workshop ────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formTeacher.trim()) return;
    setFormSaving(true);
    try {
      const res = await fetch(apiUrl("/api/workshops"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          horarioId,
          sede: formSede,
          teacher: formTeacher,
          name: formName,
          workshopDate: formDate,
          workshopTime: formTime,
          maxStudents: MAX_STUDENTS,
        }),
      });
      if (!res.ok) throw new Error();
      setShowForm(false);
      setFormTeacher(""); setFormName(""); setFormDate(""); setFormTime("");
      fetchWorkshops();
    } catch {
    } finally {
      setFormSaving(false);
    }
  }

  // ── Delete workshop ────────────────────────────────────────────────────────
  async function handleDeleteWorkshop(id: number) {
    await fetch(apiUrl(`/api/workshops/${id}`), { method: "DELETE" });
    setSelected(null);
    setConfirmDelete(false);
    fetchWorkshops();
  }

  // ── Add student ────────────────────────────────────────────────────────────
  async function handleAddStudent() {
    if (!selected || !addStudent.trim()) return;
    setAddingStudent(true);
    setAddError("");
    try {
      const res = await fetch(apiUrl(`/api/workshops/${selected.id}/students`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName: addStudent.trim() }),
      });
      if (res.status === 409) { setAddError("El taller está lleno (8/8 alumnos)."); return; }
      if (!res.ok) throw new Error();
      setAddStudent("");
      fetchWorkshops();
    } catch {
      setAddError("No se pudo agregar el alumno.");
    } finally {
      setAddingStudent(false);
    }
  }

  // ── Remove student ─────────────────────────────────────────────────────────
  async function handleRemoveStudent(name: string) {
    if (!selected) return;
    await fetch(
      apiUrl(`/api/workshops/${selected.id}/students/${encodeURIComponent(name)}`),
      { method: "DELETE" }
    );
    setConfirmRemove(null);
    fetchWorkshops();
  }

  // ── Inline edit (detail panel) ─────────────────────────────────────────────
  async function handleSaveEdit(field: string) {
    if (!selected) return;
    const body: Record<string, string> = {};
    if (field === "teacher") body.teacher = editValue;
    else if (field === "name") body.name = editValue;
    else if (field === "sede") body.sede = editValue;
    else if (field === "date") body.workshopDate = editValue;
    else if (field === "time") body.workshopTime = editValue;
    await fetch(apiUrl(`/api/workshops/${selected.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditField(null);
    fetchWorkshops();
  }

  function startEdit(field: string, current: string) {
    setEditField(field);
    setEditValue(current);
    setConfirmRemove(null);
  }

  const liveSelected = workshops.find(w => w.id === selected?.id) ?? selected;
  const isFull = (liveSelected?.students.length ?? 0) >= MAX_STUDENTS;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-4 mt-4">
      {/* ── Workshop list ── */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <h2 className="font-display font-bold text-foreground text-lg">
              Talleres — {sedeDisplayName(activeSede)}
            </h2>
            <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
              {workshops.length}
            </span>
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setFormTeacher(""); setFormName(""); setFormDate(""); setFormTime(""); setFormSede(activeSede); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancelar" : "Nuevo taller"}
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="bg-card border border-primary/20 rounded-2xl p-5 mb-4 shadow-sm"
          >
            <h3 className="font-display font-bold text-foreground text-sm mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> Nuevo taller
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Docente *
                </label>
                <input
                  autoFocus
                  required
                  value={formTeacher}
                  onChange={e => setFormTeacher(e.target.value)}
                  placeholder="Nombre del docente"
                  className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Nombre / materia
                </label>
                <input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Ej: Taller de Matemática"
                  className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Sede
                </label>
                <select
                  value={formSede}
                  onChange={e => setFormSede(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {allSedes.map(s => (
                    <option key={s} value={s}>{sedeDisplayName(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Fecha
                </label>
                <input
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  placeholder="Ej: 15 de mayo"
                  className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Horario
                </label>
                <input
                  value={formTime}
                  onChange={e => setFormTime(e.target.value)}
                  placeholder="Ej: 10:00 - 12:00"
                  className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                type="submit"
                disabled={formSaving || !formTeacher.trim()}
                className="px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {formSaving ? "Guardando..." : "Crear taller"}
              </button>
            </div>
          </form>
        )}

        {/* Workshop cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <span className="animate-spin">↻</span> Cargando talleres...
          </div>
        ) : workshops.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <GraduationCap className="w-10 h-10 opacity-30" />
            <p className="text-sm font-medium">No hay talleres en esta sede</p>
            <p className="text-xs">Haz clic en "Nuevo taller" para agregar uno.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {workshops.map(w => {
              const count = w.students.length;
              const pct = count / MAX_STUDENTS;
              const isActive = selected?.id === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => { setSelected(w); setAddStudent(""); setAddError(""); setConfirmRemove(null); setEditField(null); setConfirmDelete(false); }}
                  className={`text-left bg-card border rounded-2xl p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${
                    isActive ? "border-primary/60 ring-2 ring-primary/20" : "border-border/50 hover:border-primary/30"
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-sm font-bold text-foreground truncate">{w.teacher}</span>
                      </div>
                      {w.name && (
                        <p className="text-xs text-muted-foreground truncate pl-5">{w.name}</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>

                  {/* Info chips */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {w.workshopDate && (
                      <span className="flex items-center gap-1 text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        <CalendarDays className="w-3 h-3" />{w.workshopDate}
                      </span>
                    )}
                    {w.workshopTime && (
                      <span className="flex items-center gap-1 text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" />{w.workshopTime}
                      </span>
                    )}
                  </div>

                  {/* Capacity bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Users className="w-3 h-3" /> Alumnos
                      </span>
                      <span className={`text-[11px] font-bold ${
                        count >= MAX_STUDENTS ? "text-destructive" : count >= 7 ? "text-amber-600" : "text-emerald-600"
                      }`}>
                        {count}/{MAX_STUDENTS}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 1 ? "bg-destructive" : pct >= 0.875 ? "bg-amber-400" : "bg-emerald-400"
                        }`}
                        style={{ width: `${Math.min(pct * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail panel ── */}
      {liveSelected && (
        <div className="w-80 shrink-0 bg-card border border-border/50 rounded-2xl shadow-xl flex flex-col max-h-[calc(100vh-200px)] sticky top-4">
          {/* Panel header */}
          <div className="px-5 py-4 border-b border-border/50 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Taller</p>
              <p className="text-base font-bold text-foreground leading-tight truncate">
                {liveSelected.teacher}
              </p>
              {liveSelected.name && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{liveSelected.name}</p>
              )}
            </div>
            <button
              onClick={() => { setSelected(null); setConfirmDelete(false); }}
              className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Editable info fields */}
            {[
              { field: "teacher",  label: "Docente",  icon: GraduationCap, value: liveSelected.teacher },
              { field: "name",     label: "Materia",  icon: GraduationCap, value: liveSelected.name },
              { field: "date",     label: "Fecha",    icon: CalendarDays,  value: liveSelected.workshopDate },
              { field: "time",     label: "Horario",  icon: Clock,         value: liveSelected.workshopTime },
            ].map(({ field, label, icon: Icon, value }) => (
              <div key={field}>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  {label}
                </span>
                {editField === field ? (
                  <div className="flex gap-1.5">
                    <input
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(field); if (e.key === "Escape") setEditField(null); }}
                      className="flex-1 px-2.5 py-1.5 text-sm border border-primary/50 rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button onClick={() => handleSaveEdit(field)} className="p-1.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditField(null)} className="p-1.5 bg-muted rounded-xl hover:bg-muted/80">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(field, value)}
                    className="flex items-center gap-2 w-full group text-left"
                  >
                    <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground flex-1">{value || <span className="text-muted-foreground italic">Sin definir</span>}</span>
                    <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                )}
              </div>
            ))}

            {/* Sede field */}
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Sede</span>
              {editField === "sede" ? (
                <div className="flex gap-1.5">
                  <select
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-sm border border-primary/50 rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {allSedes.map(s => (
                      <option key={s} value={s}>{sedeDisplayName(s)}</option>
                    ))}
                  </select>
                  <button onClick={() => handleSaveEdit("sede")} className="p-1.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditField(null)} className="p-1.5 bg-muted rounded-xl hover:bg-muted/80">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button onClick={() => startEdit("sede", liveSelected.sede)} className="flex items-center gap-2 w-full group text-left">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground flex-1">{sedeDisplayName(liveSelected.sede)}</span>
                  <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              )}
            </div>

            {/* Students section */}
            <div className="border-t border-border/50 pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Users className="w-3 h-3" /> Alumnos inscritos
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  isFull ? "bg-destructive/10 text-destructive" :
                  liveSelected.students.length >= 7 ? "bg-amber-50 text-amber-700" :
                  "bg-emerald-50 text-emerald-700"
                }`}>
                  {liveSelected.students.length}/{MAX_STUDENTS}
                </span>
              </div>

              {liveSelected.students.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3 italic">Sin alumnos inscritos</p>
              ) : (
                <ul className="space-y-1 mb-3">
                  {liveSelected.students.map(s => (
                    <li key={s} className="flex items-center gap-2 group">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-primary">{s[0]?.toUpperCase()}</span>
                      </div>
                      <span className="text-sm text-foreground flex-1 truncate">{s}</span>
                      {confirmRemove === s ? (
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => handleRemoveStudent(s)}
                            className="text-[10px] font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-lg hover:bg-destructive/20"
                          >
                            Sí
                          </button>
                          <button
                            onClick={() => setConfirmRemove(null)}
                            className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-lg hover:bg-muted/80"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRemove(s)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Add student */}
              {isFull ? (
                <div className="text-xs text-center text-destructive font-semibold bg-destructive/5 border border-destructive/20 rounded-xl py-2">
                  Taller completo (8/8)
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <input
                      value={addStudent}
                      onChange={e => { setAddStudent(e.target.value); setAddError(""); }}
                      onKeyDown={e => e.key === "Enter" && handleAddStudent()}
                      placeholder="Nombre del alumno..."
                      className="flex-1 px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                    />
                    <button
                      onClick={handleAddStudent}
                      disabled={addingStudent || !addStudent.trim()}
                      className="p-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  </div>
                  {addError && (
                    <p className="text-xs text-destructive">{addError}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Delete footer */}
          <div className="px-5 py-3 border-t border-border/50">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground flex-1">¿Eliminar taller?</span>
                <button
                  onClick={() => handleDeleteWorkshop(liveSelected.id)}
                  className="text-xs font-semibold text-destructive bg-destructive/10 px-3 py-1.5 rounded-xl hover:bg-destructive/20"
                >
                  Eliminar
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs font-semibold text-muted-foreground bg-muted px-3 py-1.5 rounded-xl hover:bg-muted/80"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 text-xs text-destructive hover:text-destructive font-semibold w-full justify-center py-1.5 rounded-xl hover:bg-destructive/5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar taller
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
