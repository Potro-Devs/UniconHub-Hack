import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { ContentDetailScreen } from '@/features/curriculum/ContentDetailScreen';
import { CurriculumScreen } from '@/features/curriculum/CurriculumScreen';
import { GroupMapScreen } from '@/features/group-map/GroupMapScreen';
import { GamesCatalogScreen } from '@/features/learning-games/GamesCatalogScreen';
import { LearningGameScreen } from '@/features/learning-games/LearningGameScreen';
import { CreateGroupScreen } from '@/features/groups/CreateGroupScreen';
import { GroupDetailScreen } from '@/features/groups/GroupDetailScreen';
import { TeacherGroupsProvider } from '@/features/groups/TeacherGroupsContext';
import { HintCardsScreen } from '@/features/paper-mode/HintCardsScreen';
import { PrintSheetScreen } from '@/features/paper-mode/PrintSheetScreen';
import { QuickCaptureScreen } from '@/features/paper-mode/QuickCaptureScreen';
import { PromoteGroupsScreen } from '@/features/school-admin/PromoteGroupsScreen';
import { SchoolDashboardScreen } from '@/features/school-admin/SchoolDashboardScreen';
import { SchoolOverviewScreen } from '@/features/school-admin/SchoolOverviewScreen';
import { TransfersScreen } from '@/features/school-admin/TransfersScreen';
import { StudentAchievementsScreen } from '@/features/student-portal/StudentAchievementsScreen';
import { StudentClassesScreen } from '@/features/student-portal/StudentClassesScreen';
import { StudentCodeScreen } from '@/features/student-portal/StudentCodeScreen';
import { StudentExerciseScreen } from '@/features/student-portal/StudentExerciseScreen';
import { StudentHomeScreen } from '@/features/student-portal/StudentHomeScreen';
import { StudentLayout } from '@/features/student-portal/StudentLayout';
import { StudentNameScreen } from '@/features/student-portal/StudentNameScreen';
import { StudentShellLayout } from '@/features/student-portal/StudentShellLayout';
import { StudentSummaryScreen } from '@/features/student-portal/StudentSummaryScreen';
import { StudentProfileScreen } from '@/features/student-profile/StudentProfileScreen';
import { TeacherGroupsScreen } from '@/features/teacher-dashboard/TeacherGroupsScreen';
import { AppShellLayout } from '@/shared/components/AppShellLayout';
import { RequireRole } from '@/shared/components/RequireRole';
import { AppUiProvider } from '@/shared/state/AppUiContext';
import { STAFF_ROLES } from '@/shared/state/session';
import { SessionProvider } from '@/shared/state/SessionContext';

/**
 * Enrutador modular de Axi que separa cada ventana en su feature correspondiente.
 * Las vistas de docente/dirección y el área del alumno con sesión están protegidas por rol.
 */
export function App() {
  return (
    <SessionProvider>
      <AppUiProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginScreen />} />

            <Route
              element={
                <RequireRole roles={STAFF_ROLES} redirectTo="/login">
                  <TeacherGroupsProvider>
                    <AppShellLayout />
                  </TeacherGroupsProvider>
                </RequireRole>
              }
            >
              <Route path="/docente/grupos" element={<TeacherGroupsScreen />} />
              <Route path="/docente/grupos/:groupId" element={<GroupDetailScreen />} />
              <Route path="/docente/mapa" element={<GroupMapScreen />} />
              <Route path="/docente/perfil" element={<StudentProfileScreen />} />
              <Route path="/docente/perfil/:studentId" element={<StudentProfileScreen />} />

              <Route element={<RequireRole roles={['teacher']} redirectTo="/login" />}>
                {/* Herramientas de aula y de escritura: el director (solo lectura) vuelve a su panel. */}
                <Route path="/docente/grupos/nuevo" element={<CreateGroupScreen />} />
                <Route path="/docente/temario" element={<CurriculumScreen />} />
                <Route path="/docente/temario/:contentId" element={<ContentDetailScreen />} />
                <Route path="/docente/hoja" element={<PrintSheetScreen />} />
                <Route path="/docente/pistas" element={<HintCardsScreen />} />
                <Route path="/docente/captura" element={<QuickCaptureScreen />} />
              </Route>

              <Route element={<RequireRole roles={['director']} redirectTo="/login" />}>
                <Route path="/direccion/panel" element={<SchoolDashboardScreen />} />
              </Route>
              <Route path="/direccion/escuela" element={<SchoolOverviewScreen />} />
              <Route path="/direccion/promover" element={<PromoteGroupsScreen />} />
              <Route path="/direccion/traslados" element={<TransfersScreen />} />
            </Route>

            <Route path="/alumno" element={<StudentLayout />}>
              <Route index element={<Navigate to="/alumno/inicio" replace />} />
              <Route path="codigo" element={<StudentCodeScreen />} />
              <Route path="nombre" element={<StudentNameScreen />} />
              <Route element={<RequireRole roles={['student']} redirectTo="/login" />}>
                <Route path="ejercicio" element={<StudentExerciseScreen />} />
                <Route path="resumen" element={<StudentSummaryScreen />} />
              </Route>
            </Route>

            <Route
              element={
                <RequireRole roles={['student']} redirectTo="/login">
                  <StudentShellLayout />
                </RequireRole>
              }
            >
              <Route path="/alumno/inicio" element={<StudentHomeScreen />} />
              <Route path="/alumno/clases" element={<StudentClassesScreen />} />
              <Route path="/alumno/logros" element={<StudentAchievementsScreen />} />
              <Route path="/alumno/juegos" element={<GamesCatalogScreen />} />
              <Route path="/alumno/juegos/:gameCode" element={<LearningGameScreen />} />
            </Route>

            <Route path="/alumno/sellos" element={<Navigate to="/alumno/logros" replace />} />

            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AppUiProvider>
    </SessionProvider>
  );
}

export default App;
