import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Plan } from '../lib/types';

const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

// Landing pública de marketing con los 3 planes.
export function LandingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    api<{ plans: Plan[] }>('/billing/plans')
      .then((data) => setPlans(data.plans))
      .catch(() => setPlans([]));
  }, []);

  return (
    <div className="min-h-screen bg-card">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="text-xl font-bold text-primary">PreuFlow</div>
        <nav className="flex items-center gap-3">
          <Link to="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
            Iniciar sesión
          </Link>
          <Link
            to="/registro"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Prueba gratis 14 días
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16 text-center">
        <h1 className="font-display mx-auto max-w-3xl text-4xl font-extrabold leading-tight text-foreground md:text-5xl">
          Los horarios de tu preu, taller o academia, <span className="text-primary">sin choques ni Excel</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          PreuFlow impide que un profesor o una sala queden con horarios traslapados, maneja cupos y
          lista de espera con aviso automático, y lleva el registro de cuotas pagadas — todo en un
          panel simple para tu secretaría.
        </p>
        <div className="mt-8">
          <Link
            to="/registro"
            className="rounded-xl bg-primary px-8 py-3 text-lg font-semibold text-white shadow-lg hover:bg-primary/90"
          >
            Crear mi centro gratis
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">14 días de prueba · sin tarjeta</p>
        </div>
      </section>

      <section className="border-y border-border/60 bg-muted/50 py-14">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-3">
          {[
            {
              title: 'Choques imposibles',
              body: 'Al crear un bloque, el sistema rechaza traslapes de sala o profesor el mismo día — con detección inteligente por semestre para preuniversitarios.',
              icon: '🛡️',
            },
            {
              title: 'Cupos y lista de espera',
              body: 'Curso lleno no es un no: anota al alumno en espera y avisamos automáticamente cuando se libera un cupo.',
              icon: '📋',
            },
            {
              title: 'Cuotas al día',
              body: 'Marca pagado/pendiente por alumno y por mes. Sin pasarelas ni cobros: el registro claro que tu secretaría necesita.',
              icon: '💵',
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl bg-card p-6 shadow-sm">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-3 text-lg font-bold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16" id="planes">
        <h2 className="font-display text-center text-3xl font-bold text-foreground">Planes simples, en pesos chilenos</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl border p-6 ${
                plan.id === 'growth' ? 'border-primary shadow-lg' : 'border-border'
              }`}
            >
              {plan.id === 'growth' && (
                <div className="mb-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  Más popular
                </div>
              )}
              <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
              <div className="mt-2 text-3xl font-extrabold text-foreground">
                {clp.format(plan.priceClp)}
                <span className="text-base font-medium text-muted-foreground">/mes</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {plan.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              <Link
                to="/registro"
                className="mt-6 block rounded-lg bg-primary py-2 text-center font-semibold text-white hover:bg-primary/90"
              >
                Empezar prueba gratis
              </Link>
            </div>
          ))}
          {plans.length === 0 && (
            <p className="col-span-3 text-center text-muted-foreground">Cargando planes…</p>
          )}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        PreuFlow · Hecho para preuniversitarios, talleres y academias de Chile
      </footer>
    </div>
  );
}
