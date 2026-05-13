import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ToasterMobile } from "@/components/ui/sonner-mobile";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { lazy, Suspense, Component, ReactNode, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { initNetworkMonitor } from "@/lib/networkMonitor";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useAppearanceSync } from "@/hooks/useAppearanceSync";

// Eager-load core pages for instant navigation
import Feed from "./pages/Feed";
import MessagesPage from "./pages/MessagesPage";
import ProfilePage from "./pages/ProfilePage";
import SearchPage from "./pages/SearchPage";
import { BottomNavigation } from "@/components/BottomNavigation";

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

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <Skeleton className="h-12 w-48 mx-auto" />
      <Skeleton className="h-8 w-64 mx-auto" />
    </div>
  </div>
);

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
      <BottomNavigation />
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
        <BrowserRouter>
          <AuthenticatedFeatures />
          <Suspense fallback={<PageLoader />}>
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
            <Route path="/purchases" element={<ProtectedRoute><PurchaseHistoryPage /></ProtectedRoute>} />
            <Route path="/admin-setup" element={<ProtectedRoute><AdminSetup /></ProtectedRoute>} />
            <Route path="/starred-messages" element={<ProtectedRoute><StarredMessagesPage /></ProtectedRoute>} />
            <Route path="/chat-media" element={<ProtectedRoute><ChatMediaPage /></ProtectedRoute>} />
            <Route path="/chat-settings" element={<ProtectedRoute><ChatSettingsPage /></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="/reels" element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <ReelsPage />
                    </Suspense>
                  </ProtectedRoute>
                } />
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
                <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
