import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBillingStatus } from '../hooks/useBillingStatus';
import { TrialBanner } from '../components/TrialBanner';
import { api } from '../lib/api';
import type { BusinessType, Organization, Plan } from '../lib/types';

const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

const TYPE_NAMES: Record<BusinessType, string> = {
  preuniversitario: 'Preuniversitario',
  taller: 'Taller',
  academia: 'Academia',
  personalizado: 'Personalizado',
};

export function ConfiguracionPage() {
  const { organization, refreshOrganization } = useAuth();
  const { status, refresh: refreshBilling } = useBillingStatus();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState({
    name: '',
    businessType: 'personalizado' as BusinessType,
    courseLabel: '',
    studentLabel: '',
    brandColor: '#4F46E5',
    feesEnabled: true,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;
    setForm({
      name: organization.name,
      businessType: organization.businessType,
      courseLabel: organization.courseLabel,
      studentLabel: organization.studentLabel,
      brandColor: organization.brandColor,
      feesEnabled: organization.feesEnabled,
    });
  }, [organization]);

  useEffect(() => {
    api<{ plans: Plan[] }>('/billing/plans')
      .then((d) => setPlans(d.plans))
      .catch(() => setPlans([]));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      // Si cambió el tipo de negocio, el servidor re-aplica sus presets; se
      // mandan también los campos visibles para respetar lo que ve el usuario.
      const changedType = form.businessType !== organization?.businessType;
      const body: Record<string, unknown> = changedType
        ? { businessType: form.businessType, name: form.name }
        : { ...form };
      await api<{ organization: Organization }>('/organization', { method: 'PATCH', body });
      await refreshOrganization();
      setMessage('Cambios guardados.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.');
    }
  };

  const choosePlan = async (planId: string) => {
    setMessage(null);
    setError(null);
    try {
      const res = await api<{ available: boolean; url?: string; message?: string }>(
        '/billing/checkout',
        { method: 'POST', body: { plan: planId } },
      );
      if (res.available && res.url) {
        window.location.href = res.url;
      } else {
        setMessage(res.message ?? 'El pago en línea aún no está habilitado.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar el pago.');
    }
  };

  if (!organization) return null;
  const isPreu = form.businessType === 'preuniversitario';

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
      <div className="mt-4">
        <TrialBanner status={status} />
      </div>

      {/* Personalización */}
      <form onSubmit={save} className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">Personalización</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Nombre del centro</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Tipo de negocio</span>
            <select
              value={form.businessType}
              onChange={(e) => setForm({ ...form, businessType: e.target.value as BusinessType })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {(Object.keys(TYPE_NAMES) as BusinessType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_NAMES[t]}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-400">
              Al cambiarlo se re-aplican sus etiquetas, color y módulo de cuotas.
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Etiqueta de curso</span>
            <input
              value={form.courseLabel}
              onChange={(e) => setForm({ ...form, courseLabel: e.target.value })}
              placeholder="Curso, Taller, Clase…"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Etiqueta de alumno</span>
            <input
              value={form.studentLabel}
              onChange={(e) => setForm({ ...form, studentLabel: e.target.value })}
              placeholder="Alumno, Participante…"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Color de marca</span>
            <input
              type="color"
              value={form.brandColor}
              onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300"
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2">
            <input
              type="checkbox"
              checked={form.feesEnabled}
              onChange={(e) => setForm({ ...form, feesEnabled: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-slate-700">Módulo de cuotas activo</span>
          </label>
        </div>
        {isPreu && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Como preuniversitario, tus cursos pueden llevar semestre (1er, 2do o anual) y el
            calendario tiene filtro por semestre.
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Guardar cambios
          </button>
          {message && <span className="text-sm text-emerald-700">{message}</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>

      {/* Plan y facturación */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">Plan y facturación</h2>
        {status && (
          <p className="mt-2 text-sm text-slate-600">
            Plan actual: <strong>{status.plan.name}</strong>
            {status.subscriptionActive ? (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                Suscripción activa
              </span>
            ) : (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                Prueba: quedan {status.trialDaysLeft} días
              </span>
            )}
            <br />
            Uso: {status.studentCount}
            {status.studentLimit !== null ? ` de ${status.studentLimit}` : ''} alumnos.
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl border p-4 ${
                status?.plan.id === plan.id ? 'border-brand ring-1 ring-brand' : 'border-slate-200'
              }`}
            >
              <div className="font-bold text-slate-900">{plan.name}</div>
              <div className="text-xl font-extrabold text-slate-900">
                {clp.format(plan.priceClp)}
                <span className="text-xs font-medium text-slate-500">/mes</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {plan.maxStudents ? `Hasta ${plan.maxStudents} alumnos` : 'Alumnos ilimitados'}
              </div>
              <button
                type="button"
                onClick={() => void choosePlan(plan.id)}
                className="mt-3 w-full rounded-lg border border-brand py-1.5 text-sm font-semibold text-brand hover:bg-brand/5"
              >
                {status?.plan.id === plan.id && status.subscriptionActive ? 'Renovar' : 'Elegir plan'}
              </button>
            </div>
          ))}
        </div>
        {status && !status.flowConfigured && (
          <p className="mt-3 text-xs text-slate-400">
            El pago en línea (Flow) aún no está habilitado en esta instalación. Al elegir un plan
            verás las instrucciones para activarlo manualmente.
          </p>
        )}
      </div>
    </div>
  );
}
