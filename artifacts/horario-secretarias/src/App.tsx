import { Component, lazy, Suspense, type ReactNode } from "react";
import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { isModuleEnabled, ROUTE_MODULE } from "@/lib/navConfig";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HorarioProvider } from "@/context/HorarioContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { NotificationProvider } from "@/context/NotificationContext";
import ToastContainer from "@/components/ToastContainer";
import Navbar from "@/components/Navbar";
import { UserProvider } from "@/context/UserContext";
import UserSelectionModal from "@/components/UserSelectionModal";

const HomePage         = lazy(() => import("@/pages/HomePage"));
const HorarioPage      = lazy(() => import("@/pages/HorarioPage"));
const AdminPage        = lazy(() => import("@/pages/AdminPage"));
const GuiasPage        = lazy(() => import("@/pages/GuiasPage"));
const FotoPage         = lazy(() => import("@/pages/FotoPage"));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));
const CambiosPage      = lazy(() => import("@/pages/CambiosPage"));
const TareasPage       = lazy(() => import("@/pages/TareasPage"));
const OrientacionPage  = lazy(() => import("@/pages/OrientacionPage"));
const NotasPage        = lazy(() => import("@/pages/NotasPage"));
const OwnerPage        = lazy(() => import("@/pages/OwnerPage"));
const NotFound         = lazy(() => import("@/pages/not-found"));

// Ruta que solo existe si el módulo está activo para este negocio (/backoffice)
function ModuleRoute({ path, component }: { path: string; component: React.ComponentType }) {
  const mod = ROUTE_MODULE[path];
  const enabled = !mod || isModuleEnabled(mod);
  return <Route path={path} component={enabled ? component : () => <Redirect to="/" />} />;
}

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[40vh]">
      <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

const queryClient = new QueryClient();

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-background">
          <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-lg text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h1 className="text-xl font-bold text-foreground">Ocurrió un problema</h1>
            <p className="text-sm text-muted-foreground">
              La página encontró un error inesperado. Por favor recarga la página para continuar.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
      <HorarioProvider>
        <UserProvider>
        <NotificationProvider>
          <UserSelectionModal />
          <div className="min-h-screen flex flex-col bg-background">
            <Navbar />
            <ToastContainer />
            <main className="flex-1">
              <Suspense fallback={<PageLoader />}>
                <Switch>
                  <Route path="/" component={HomePage} />
                  <Route path="/horarios" component={HorarioPage} />
                  <Route path="/admin" component={AdminPage} />
                  <Route path="/backoffice" component={OwnerPage} />
                  <ModuleRoute path="/guias" component={GuiasPage} />
                  <ModuleRoute path="/foto" component={FotoPage} />
                  <Route path="/notificaciones" component={NotificationsPage} />
                  <ModuleRoute path="/cambios" component={CambiosPage} />
                  <ModuleRoute path="/tareas" component={TareasPage} />
                  <ModuleRoute path="/orientacion" component={OrientacionPage} />
                  <ModuleRoute path="/notas" component={NotasPage} />
                  <Route component={NotFound} />
                </Switch>
              </Suspense>
            </main>
          </div>
        </NotificationProvider>
        </UserProvider>
      </HorarioProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
