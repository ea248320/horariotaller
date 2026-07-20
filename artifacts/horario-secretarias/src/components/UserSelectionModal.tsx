import { useState, useEffect, useRef } from "react";
import { Users, UserCircle2, ShieldCheck, LogIn, Settings, HeartHandshake } from "lucide-react";
import { useCurrentUser, UserAvatar, USER_COLORS, type CurrentUser } from "@/context/UserContext";
import { useHorario } from "@/context/HorarioContext";
import { apiUrl } from "@/lib/api";
import { Link } from "wouter";

interface TeamMember {
  id: number;
  name: string;
  role: string;
  horarioId: string;
  color: string;
}

const ROLE_LABELS: Record<string, string> = {
  secretaria: "Secretaria",
  admin: "Administrador",
  orientadora: "Orientadora",
  invitado: "Invitado",
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  secretaria: UserCircle2,
  admin: ShieldCheck,
  orientadora: HeartHandshake,
  invitado: LogIn,
};

export default function UserSelectionModal() {
  const { currentUser, setCurrentUser } = useCurrentUser();
  const { horarioId, horario } = useHorario();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const checkedRef = useRef(false);

  // Reset check when user is cleared (to re-show modal)
  useEffect(() => {
    if (!currentUser) checkedRef.current = false;
  }, [currentUser]);

  // On mount or sede change: if no user, fetch global team and show modal
  useEffect(() => {
    if (currentUser || checkedRef.current) return;
    checkedRef.current = true;
    setLoading(true);
    fetch(apiUrl("/api/team"))
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setMembers(list);
        setOpen(true);
      })
      .catch(() => {
        setMembers([]);
        setOpen(true);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horarioId]);

  if (!open) return null;

  const handleSelect = (member: TeamMember) => {
    setCurrentUser({
      id: member.id,
      name: member.name,
      role: member.role as CurrentUser["role"],
      horarioId: member.horarioId,
      color: member.color,
    });
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-sm">
        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <Users className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground">¿Quién eres?</h2>
            <p className="text-sm text-muted-foreground mt-1">{horario.label}</p>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mx-auto">
                <Settings className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">No hay usuarios configurados</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ve a Admin → Equipo Administrativo para agregar los miembros del equipo.
                </p>
              </div>
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Ir a configuración
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member) => {
                const c = USER_COLORS[member.color] ?? USER_COLORS.violet;
                const Icon = ROLE_ICONS[member.role] ?? UserCircle2;
                return (
                  <button
                    key={member.id}
                    onClick={() => handleSelect(member)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${c.light} border-transparent hover:border-current/20`}
                  >
                    <UserAvatar name={member.name} color={member.color} size="md" />
                    <div className="flex-1 text-left">
                      <div className={`font-semibold text-sm ${c.text}`}>{member.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Icon className="w-3 h-3" />
                        {ROLE_LABELS[member.role] ?? member.role}
                      </div>
                    </div>
                    <LogIn className={`w-4 h-4 ${c.text} opacity-60`} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
