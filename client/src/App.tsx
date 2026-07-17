import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import { Shell } from './components/Shell';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { CalendarioPage } from './pages/CalendarioPage';
import { CursosPage } from './pages/CursosPage';
import { AlumnosPage } from './pages/AlumnosPage';
import { ProfesoresPage } from './pages/ProfesoresPage';
import { PagosPage } from './pages/PagosPage';
import { NotificacionesPage } from './pages/NotificacionesPage';
import { ConfiguracionPage } from './pages/ConfiguracionPage';

export default function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegisterPage />} />

      {/* Panel (requiere sesión de organización) */}
      <Route
        path="/panel"
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="calendario" element={<CalendarioPage />} />
        <Route path="cursos" element={<CursosPage />} />
        <Route path="alumnos" element={<AlumnosPage />} />
        <Route path="profesores" element={<ProfesoresPage />} />
        <Route path="pagos" element={<PagosPage />} />
        <Route path="notificaciones" element={<NotificacionesPage />} />
        <Route path="configuracion" element={<ConfiguracionPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
