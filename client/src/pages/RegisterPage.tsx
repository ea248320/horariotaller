import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { BusinessType } from '../lib/types';

// El tipo de negocio pre-configura etiquetas, color de marca y si el módulo
// de cuotas está activo. Reconfigurable después en /panel/configuracion.
const TYPES: { id: BusinessType; name: string; desc: string; icon: string }[] = [
  { id: 'preuniversitario', name: 'Preuniversitario', desc: 'Cursos, semestres y PAES', icon: '📖' },
  { id: 'taller', name: 'Taller', desc: 'Talleres con participantes y cuotas', icon: '🎨' },
  { id: 'academia', name: 'Academia', desc: 'Clases regulares con mensualidad', icon: '🏫' },
  { id: 'personalizado', name: 'Personalizado', desc: 'Configura todo a tu medida', icon: '🛠️' },
];

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('preuniversitario');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await register({ name, email, password, businessType });
      navigate('/panel');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-card p-8 shadow-sm">
        <Link to="/" className="text-lg font-bold text-primary">
          PreuFlow
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-foreground">Crea tu centro</h1>
        <p className="mt-1 text-sm text-muted-foreground">14 días de prueba gratis, sin tarjeta.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <span className="text-sm font-medium text-foreground">Tipo de negocio</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setBusinessType(t.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    businessType === t.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-input'
                  }`}
                >
                  <div className="text-xl">{t.icon}</div>
                  <div className="text-sm font-semibold text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-foreground">Nombre del centro</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Preuniversitario Andes"
              className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground">Correo</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground">Contraseña (mínimo 8 caracteres)</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-lg bg-primary py-2 font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {sending ? 'Creando…' : 'Crear centro'}
          </button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold text-primary">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
