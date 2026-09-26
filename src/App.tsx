import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ToasterMobile } from "@/components/ui/sonner-mobile";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { lazy, Suspense, Component, ReactNode, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { initNetworkMonitor } from "@/lib/networkMonitor";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { initSyncEngine } from "@/lib/syncEngine";
import { useAppearanceSync } from "@/hooks/useAppearanceSync";
import LiquidGlassRoot from "@/components/LiquidGlassRoot";
import PageTransition from "@/components/transitions/PageTransition";
import { GlobalProfilePopupHost } from "@/components/GlobalProfilePopupHost";
import { NavHistoryRecorder } from "@/components/NavHistoryRecorder";
import { AppTour } from "@/components/AppTour";
import { CallSessionProvider } from "@/components/calls/CallSessionProvider";
import { AppSwipeNavigation } from "@/hooks/useAppSwipeNavigation";

// Eager-load core pages for instant navigation
import Feed from "./pages/Feed";
import MessagesPage from "./pages/MessagesPage";
import ProfilePage from "./pages/ProfilePage";
import SearchPage from "./pages/SearchPage";

// Lazy load components that are only needed when authenticated
const RealtimeNotifications = lazy(() => import("@/components/RealtimeNotifications").then(m => ({ default: m.RealtimeNotifications })));
const IncomingCallOverlay = lazy(() => import("@/components/IncomingCallOverlay").then(m => ({ default: m.IncomingCallOverlay })));

// Lazy load secondary pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const MagicLinkSent = lazy(() => import("./pages/MagicLinkSent"));
const FriendsPage = lazy(() => import("./pages/FriendsPage"));
const ThreadView = lazy(() => import("./pages/ThreadView"));
const CreatorPage = lazy(() => import("./pages/creator/CreatorPage").then(m => ({ default: m.CreatorPage })));
const VerificationCodes = lazy(() => import("./pages/admin/VerificationCodes"));
const BookmarksPage = lazy(() => import("./pages/BookmarksPage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const VerificationPage = lazy(() => import("./pages/VerificationPage"));
const EmailVerification = lazy(() => import("./pages/EmailVerification"));
const LoginVerification = lazy(() => import("./pages/LoginVerification"));
const HashtagPage = lazy(() => import("./pages/HashtagPage"));
const AdminSetup = lazy(() => import("./pages/AdminSetup"));
const AnalyticsDashboard = lazy(() => import("./pages/AnalyticsDashboard"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PremiumPage = lazy(() => import("./pages/PremiumPage"));
const HelpSupportPage = lazy(() => import("./pages/HelpSupportPage"));
const PagesDirectory = lazy(() => import("./pages/PagesDirectory"));
const ReelsPage = lazy(() => import("./pages/ReelsPage"));
const PagesPage = lazy(() => import("./pages/PagesPage"));
const PurchaseHistoryPage = lazy(() => import("./pages/PurchaseHistoryPage"));
const StarredMessagesPage = lazy(() => import("./pages/StarredMessagesPage"));
const ChatMediaPage = lazy(() => import("./pages/ChatMediaPage"));
const ChatSettingsPage = lazy(() => import("./pages/ChatSettingsPage"));
const CreateStoryPage = lazy(() => import("./pages/CreateStoryPage"));
const CreateReelPage = lazy(() => import("./pages/CreateReelPage"));
const CreatePagePage = lazy(() => import("./pages/CreatePagePage"));
const EditPagePage = lazy(() => import("./pages/EditPagePage"));
const PageProfilePage = lazy(() => import("./pages/PageProfilePage"));
const InstructionsPage = lazy(() => import("./pages/InstructionsPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));

const PageLoader = () => {
  const { pathname } = useLocation();
  const shell = <Skeleton className="h-12 w-full rounded-xl" />;
  const personRow = (key: number) => (
    <div key={key} className="flex items-center gap-3 rounded-2xl border border-border/40 p-4">
      <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-9 w-20 rounded-full" />
    </div>
  );
  const postCard = (key: number) => (
    <div key={key} className="space-y-3 rounded-2xl border border-border/40 bg-card p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="aspect-[4/3] w-full rounded-xl" />
      <div className="flex gap-4"><Skeleton className="h-5 w-14" /><Skeleton className="h-5 w-14" /><Skeleton className="h-5 w-14" /></div>
    </div>
  );

  let content;
  if (pathname === '/messages') {
    content = (
      <div className="flex h-[calc(100dvh-4rem)] overflow-hidden rounded-2xl border border-border/40">
        <div className="w-full space-y-2 p-3 md:w-80">{[0, 1, 2, 3, 4, 5].map(personRow)}</div>
        <div className="hidden flex-1 border-l border-border/40 p-5 md:block">
          {shell}
          <div className="mt-8 flex h-3/4 flex-col justify-end gap-4">
            {[0, 1, 2].map((key) => <Skeleton key={key} className={`h-12 w-3/5 rounded-2xl ${key % 2 ? 'ml-auto' : ''}`} />)}
          </div>
          <Skeleton className="mt-5 h-12 w-full rounded-full" />
        </div>
      </div>
    );
  } else if (pathname === '/feed' || pathname === '/dashboard' || pathname === '/') {
    content = <><div className="mb-4 flex gap-3 overflow-hidden">{[0, 1, 2, 3, 4].map((key) => <Skeleton key={key} className="h-[68px] w-[68px] shrink-0 rounded-full" />)}</div><div className="mx-auto max-w-2xl space-y-5">{[0, 1].map(postCard)}</div></>;
  } else if (pathname === '/profile' || pathname.startsWith('/profile/')) {
    content = <><Skeleton className="h-52 w-full rounded-2xl" /><div className="-mt-12 flex items-end gap-4 px-6"><Skeleton className="h-28 w-28 rounded-full ring-4 ring-background" /><div className="space-y-2 pb-2"><Skeleton className="h-6 w-44" /><Skeleton className="h-4 w-28" /></div></div><div className="mx-auto mt-8 max-w-2xl space-y-5">{[0, 1].map(postCard)}</div></>;
  } else if (pathname === '/friends') {
    content = <><Skeleton className="mb-5 h-10 w-56" /><div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3, 4, 5].map(personRow)}</div></>;
  } else if (pathname === '/search') {
    content = <><Skeleton className="mb-6 h-12 w-full rounded-full" /><div className="space-y-3">{[0, 1, 2, 3].map(personRow)}</div></>;
  } else if (pathname === '/explore' || pathname === '/reels') {
    content = <><Skeleton className="mb-5 h-10 w-52" /><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((key) => <Skeleton key={key} className="aspect-[4/5] rounded-xl" />)}</div></>;
  } else {
    content = <><Skeleton className="mb-5 h-8 w-48" /><Skeleton className="mb-3 h-24 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></>;
  }

  return (
    <div className="min-h-screen bg-background px-4 pb-10 pt-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <div className="flex gap-2"><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-9 w-9 rounded-full" /></div>
        </div>
        {content}
      </div>
    </div>
  );
};

const queryClient = new QueryClient();

// Initialize network monitoring
initNetworkMonitor();

// Prefetch secondary pages in background after auth
const usePagePrefetch = () => {
  useEffect(() => {
    const timer = setTimeout(() => {
      const prefetch = () => {
        import("./pages/ReelsPage");
        import("./pages/BookmarksPage");
        import("./pages/SettingsPage");
        import("./pages/ExplorePage");
        import("./pages/FriendsPage");
        import("./pages/AnalyticsDashboard");
        import("./pages/PremiumPage");
        import("./pages/PagesPage");
      };
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(prefetch);
      } else {
        prefetch();
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);
};
// Error Boundary Component
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[APP_ERROR] Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="text-6xl">⚠️</div>
            <h1 className="text-2xl font-bold text-destructive">
              Something Went Wrong [APP_001]
            </h1>
            <p className="text-muted-foreground">
              The application encountered an unexpected error. Please try refreshing the page.
            </p>
            {this.state.error && process.env.NODE_ENV === 'development' && (
              <details className="text-left bg-muted p-4 rounded-lg text-sm">
                <summary className="cursor-pointer font-medium mb-2">
                  Error Details (Dev Only)
                </summary>
                <pre className="whitespace-pre-wrap break-words text-xs">
                  {this.state.error.toString()}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div className="flex gap-2 justify-center">
              <Button onClick={() => window.location.reload()}>
                Reload Page
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/'}>
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Component that only renders authenticated-only features
const AuthenticatedFeatures = () => {
  const { user } = useAuth();

  // Always run offline sync for queued actions
  useOfflineSync();

  // Boot the IndexedDB -> API gateway sync engine once per session.
  useEffect(() => {
    initSyncEngine();
  }, []);

  // Apply saved appearance prefs (theme/font/layout/accent) globally
  useAppearanceSync();

  // Prefetch secondary pages in background
  usePagePrefetch();

  if (!user) return null;

  return (
    <>
      <Suspense fallback={null}>
        <RealtimeNotifications />
        <IncomingCallOverlay />
      </Suspense>
      {/* Right-side slide-in panel replaces bottom nav under the fb26 skin */}
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <ToasterMobile />
          <LiquidGlassRoot />
          <BrowserRouter>
            <AuthenticatedFeatures />
            <NavHistoryRecorder />
            <GlobalProfilePopupHost />
            <AppTour />
            <AppSwipeNavigation />
            <CallSessionProvider>
              <Suspense fallback={<PageLoader />}>
                <PageTransition>
                  <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/signin" element={<SignIn />} />
                  <Route path="/signup" element={<SignUp />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/auth/verify" element={<EmailVerification />} />
                  <Route path="/auth/login-verify" element={<LoginVerification />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/auth/magic-link-sent" element={<MagicLinkSent />} />
                  <Route
                    path="/onboarding"
                    element={
                      <ProtectedRoute>
                        <OnboardingPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/feed"
                    element={
                      <ProtectedRoute>
                        <Feed />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/search"
                    element={
                      <ProtectedRoute>
                        <SearchPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/messages"
                    element={
                      <ProtectedRoute>
                        <MessagesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/friends"
                    element={
                      <ProtectedRoute>
                        <FriendsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile/:userId"
                    element={
                      <ProtectedRoute>
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/bookmarks"
                    element={
                      <ProtectedRoute>
                        <BookmarksPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/explore"
                    element={
                      <ProtectedRoute>
                        <ExplorePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/verification"
                    element={
                      <ProtectedRoute>
                        <VerificationPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/hashtag/:tag"
                    element={
                      <ProtectedRoute>
                        <HashtagPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/post/:postId"
                    element={
                      <ProtectedRoute>
                        <ThreadView />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/verification"
                    element={
                      <ProtectedRoute>
                        <VerificationCodes />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/creator/:slug"
                    element={
                      <ProtectedRoute>
                        <CreatorPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin-setup"
                    element={
                      <ProtectedRoute>
                        <AdminSetup />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/analytics"
                    element={
                      <ProtectedRoute>
                        <AnalyticsDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <SettingsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/premium"
                    element={
                      <ProtectedRoute>
                        <PremiumPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/pages"
                    element={
                      <ProtectedRoute>
                        <PagesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reels"
                    element={
                      <ProtectedRoute>
                        <ReelsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/premium" element={<ProtectedRoute><PremiumPage /></ProtectedRoute>} />
                  <Route path="/help-support" element={<ProtectedRoute><HelpSupportPage /></ProtectedRoute>} />
                  <Route path="/purchases" element={<ProtectedRoute><PurchaseHistoryPage /></ProtectedRoute>} />
                  <Route path="/admin-setup" element={<ProtectedRoute><AdminSetup /></ProtectedRoute>} />
                  <Route path="/starred-messages" element={<ProtectedRoute><StarredMessagesPage /></ProtectedRoute>} />
                  <Route path="/chat-media" element={<ProtectedRoute><ChatMediaPage /></ProtectedRoute>} />
                  <Route path="/chat-settings" element={<ProtectedRoute><ChatSettingsPage /></ProtectedRoute>} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="/create/story" element={
                    <ProtectedRoute>
                      <Suspense fallback={<PageLoader />}>
                        <CreateStoryPage />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/create/reel" element={
                    <ProtectedRoute>
                      <Suspense fallback={<PageLoader />}>
                        <CreateReelPage />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/create/page" element={
                    <ProtectedRoute>
                      <Suspense fallback={<PageLoader />}>
                        <CreatePagePage />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/page/:pageId/edit" element={
                    <ProtectedRoute>
                      <Suspense fallback={<PageLoader />}>
                        <EditPagePage />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/page/:username" element={
                    <ProtectedRoute>
                      <Suspense fallback={<PageLoader />}>
                        <PageProfilePage />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/instructions" element={
                    <ProtectedRoute>
                      <Suspense fallback={<PageLoader />}>
                        <InstructionsPage />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="*" element={<NotFound />} />
                  </Routes>
                </PageTransition>
              </Suspense>
            </CallSessionProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;