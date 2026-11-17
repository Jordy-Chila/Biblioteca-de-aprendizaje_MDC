import { lazy, Suspense } from 'react';
import { AppLayout } from '../layouts/AppLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { StudyPage } from '../pages/StudyPage';
import { AISettingsModal } from '../modules/ai-analysis/AISettingsModal';
import { TutorDrawer } from '../modules/ai-tutor/TutorDrawer';
import { DocRefModal } from '../modules/documents/DocRefModal';
import { useSession } from '../stores/session';
import { useLeaveWarning } from '../hooks/useLeaveWarning';
import { Spinner } from '../components/ui';

// El motor 3D (three.js) se carga solo al abrir el explorador
const ExplorerPage = lazy(() => import('../pages/ExplorerPage').then((m) => ({ default: m.ExplorerPage })));

export default function App() {
  const page = useSession((s) => s.page);
  const hasDoc = useSession((s) => Boolean(s.activeDocId));
  useLeaveWarning();
  return (
    <AppLayout>
      {page === 'dashboard' || !hasDoc ? (
        <DashboardPage />
      ) : page === 'explorer' ? (
        <Suspense
          fallback={
            <div className="grid h-full place-items-center text-[13px] text-mist-400">
              <span className="flex items-center gap-2">
                <Spinner /> Cargando el motor 3D…
              </span>
            </div>
          }
        >
          <ExplorerPage />
        </Suspense>
      ) : (
        <StudyPage />
      )}
      <AISettingsModal />
      <TutorDrawer />
      <DocRefModal />
    </AppLayout>
  );
}
