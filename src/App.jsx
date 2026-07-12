import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { trackPageView } from '@/lib/ga';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Home from './pages/Home';
import FOP from './pages/FOP';
import TOV from './pages/TOV';
import ITDiyaCity from './pages/ITDiyaCity';
import GrantyNPO from './pages/GrantyNPO';
import Konsaltyng from './pages/Konsaltyng';
import Price from './pages/Price';
import About from './pages/About';
import Contacts from './pages/Contacts';
import Blog from './pages/Blog';
import Privacy from './pages/Privacy';
import SelectServices from './pages/SelectServices';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Admin from './pages/Admin';
import AdminRoute from './components/AdminRoute';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  const location = useLocation();

  // Track page views
  useEffect(() => {
    trackPageView(location.pathname, document.title);
  }, [location]);

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }


  // Render the main app
  return (
    <Routes>
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<Admin />} />
      </Route>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/fop" element={<FOP />} />
        <Route path="/tov" element={<TOV />} />
        <Route path="/it-diya-city" element={<ITDiyaCity />} />
        <Route path="/granty-npo" element={<GrantyNPO />} />
        <Route path="/konsaltyng" element={<Konsaltyng />} />
        <Route path="/prajs" element={<Price />} />
        <Route path="/pro-nas" element={<About />} />
        <Route path="/kontakty" element={<Contacts />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/zapis" element={<SelectServices />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App