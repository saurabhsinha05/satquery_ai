import { Suspense, lazy, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/system/ErrorBoundary';
import { RouteFallback } from '@/components/system/RouteFallback';
import NotFoundPage from '@/pages/NotFoundPage';

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const WorkspacePage = lazy(() => import('@/pages/WorkspacePage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

export default function App() {
  const location = useLocation();

  return (
    <ErrorBoundary>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        {/* Keyed wrapper gives every route a soft cross-fade on entry. */}
        <div key={location.pathname} className="h-full animate-fade-in">
          <Routes location={location}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}
