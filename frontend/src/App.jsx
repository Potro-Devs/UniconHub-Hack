import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { ContentDetailScreen } from '@/features/curriculum/ContentDetailScreen';
import { CurriculumScreen } from '@/features/curriculum/CurriculumScreen';
import { GroupMapScreen } from '@/features/group-map/GroupMapScreen';
import { CreateGroupScreen } from '@/features/groups/CreateGroupScreen';
import { HintCardsScreen } from '@/features/paper-mode/HintCardsScreen';
import { PrintSheetScreen } from '@/features/paper-mode/PrintSheetScreen';
import { QuickCaptureScreen } from '@/features/paper-mode/QuickCaptureScreen';
import { PromoteGroupsScreen } from '@/features/school-admin/PromoteGroupsScreen';
import { SchoolOverviewScreen } from '@/features/school-admin/SchoolOverviewScreen';
import { TransfersScreen } from '@/features/school-admin/TransfersScreen';
import { StudentBadgesScreen } from '@/features/student-portal/StudentBadgesScreen';
import { StudentCodeScreen } from '@/features/student-portal/StudentCodeScreen';
import { StudentExerciseScreen } from '@/features/student-portal/StudentExerciseScreen';
import { StudentLayout } from '@/features/student-portal/StudentLayout';
import { StudentNameScreen } from '@/features/student-portal/StudentNameScreen';
import { StudentSummaryScreen } from '@/features/student-portal/StudentSummaryScreen';
import { StudentProfileScreen } from '@/features/student-profile/StudentProfileScreen';
import { TeacherGroupsScreen } from '@/features/teacher-dashboard/TeacherGroupsScreen';
import { AppShellLayout } from '@/shared/components/AppShellLayout';
import { AppUiProvider } from '@/shared/state/AppUiContext';

/**
 * Enrutador modular de Axi que separa cada ventana en su feature correspondiente.
 */
export function App() {
  return (
    <AppUiProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />

          <Route element={<AppShellLayout />}>
            <Route path="/docente/grupos" element={<TeacherGroupsScreen />} />
            <Route path="/docente/grupos/nuevo" element={<CreateGroupScreen />} />
            <Route path="/docente/mapa" element={<GroupMapScreen />} />
            <Route path="/docente/perfil" element={<StudentProfileScreen />} />
            <Route path="/docente/perfil/:studentIdx" element={<StudentProfileScreen />} />
            <Route path="/docente/temario" element={<CurriculumScreen />} />
            <Route path="/docente/temario/:contentId" element={<ContentDetailScreen />} />
            <Route path="/docente/hoja" element={<PrintSheetScreen />} />
            <Route path="/docente/pistas" element={<HintCardsScreen />} />
            <Route path="/docente/captura" element={<QuickCaptureScreen />} />

            <Route path="/direccion/escuela" element={<SchoolOverviewScreen />} />
            <Route path="/direccion/promover" element={<PromoteGroupsScreen />} />
            <Route path="/direccion/traslados" element={<TransfersScreen />} />
          </Route>

          <Route path="/alumno" element={<StudentLayout />}>
            <Route index element={<Navigate to="/alumno/codigo" replace />} />
            <Route path="codigo" element={<StudentCodeScreen />} />
            <Route path="nombre" element={<StudentNameScreen />} />
            <Route path="ejercicio" element={<StudentExerciseScreen />} />
            <Route path="resumen" element={<StudentSummaryScreen />} />
            <Route path="sellos" element={<StudentBadgesScreen />} />
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AppUiProvider>
  );
}

export default App;
