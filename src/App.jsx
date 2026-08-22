import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { Outlet } from "react-router-dom";
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
import NeprybutkoviOrhanizatsiyi from './pages/NPO';
import Price from './pages/Price';
import About from './pages/About';
import Contacts from './pages/Contacts';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import Privacy from './pages/Privacy';
import SelectServices from './pages/SelectServices';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Admin from './pages/Admin';
import AdminRoute from './components/AdminRoute';
import { ADMIN_PATH } from '@/lib/adminPath';

const BACKEND_API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const routeMeta = {
      "/": {
        title: "ФінОк — Управління ФОП, ТОВ, гранти, консалтинг",
        description: "Реєстрація та супровід ФОП, ТОВ, Дія Сіті, пошук грантів, управлінський облік — 100% онлайн.",
      },
      "/fop": { title: "Послуги для ФОП — ФінОк", description: "Реєстрація ФОП, супровід, зміна КВЕД, закриття під ключ." },
      "/tov": { title: "Послуги для ТОВ — ФінОк", description: "Реєстрація та супровід ТОВ, зміни у складі, ліквідація." },
      "/it-diya-city": { title: "IT / Дія Сіті — ФінОк", description: "Консультації для IT-ФОП та компаній Дія Сіті." },
      "/granty-npo": { title: "Гранти та НПО — ФінОк", description: "Допомога з грантовими заявками, реєстрацією ГО/БФ та звітністю." },
      "/konsaltyng": { title: "Консалтинг — ФінОк", description: "Фінансові моделі, управлінський облік, KPI, бюджетування." },
      "/prajs": { title: "Прайс послуг — ФінОк", description: "Актуальна вартість послуг для ФОП, ТОВ, IT, НПО." },
      "/blog": { title: "Блог — ФінОк", description: "Статті та поради для підприємців." },
      "/kontakty": { title: "Контакти — ФінОк", description: "Зв'яжіться з командою ФінОк зручним каналом." },
      "/privacy": { title: "Політика конфіденційності — ФінОк", description: "Умови обробки персональних даних сервісом ФінОк." },
    };

    const pathname = location.pathname;
    const meta = pathname.startsWith("/blog/")
      ? { title: "Стаття блогу — ФінОк", description: "Корисні матеріали для підприємців від ФінОк." }
      : (routeMeta[pathname] || routeMeta["/"]);

    document.title = meta.title;

    const ensureMeta = (name) => {
      let tag = document.head.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      return tag;
    };

    ensureMeta("description").setAttribute("content", meta.description);

    const ensurePropertyMeta = (property) => {
      let tag = document.head.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("property", property);
        document.head.appendChild(tag);
      }
      return tag;
    };

    const canonicalHref = `https://finok.com.ua${pathname === "/" ? "" : pathname}`;
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalHref);

    const robots = ensureMeta("robots");
    const shouldNoIndex = pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password") || pathname.startsWith(ADMIN_PATH);
    robots.setAttribute("content", shouldNoIndex ? "noindex, nofollow" : "index, follow");

    ensurePropertyMeta("og:type").setAttribute("content", pathname.startsWith("/blog/") ? "article" : "website");
    ensurePropertyMeta("og:title").setAttribute("content", meta.title);
    ensurePropertyMeta("og:description").setAttribute("content", meta.description);
    ensurePropertyMeta("og:url").setAttribute("content", canonicalHref);

    ensureMeta("twitter:card").setAttribute("content", "summary_large_image");
    ensureMeta("twitter:title").setAttribute("content", meta.title);
    ensureMeta("twitter:description").setAttribute("content", meta.description);

    let schemaTag = document.head.querySelector('script[data-schema="organization"]');
    if (!schemaTag) {
      schemaTag = document.createElement("script");
      schemaTag.setAttribute("type", "application/ld+json");
      schemaTag.setAttribute("data-schema", "organization");
      document.head.appendChild(schemaTag);
    }
    schemaTag.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "ФінОк",
      url: "https://finok.com.ua",
      logo: "https://finok.com.ua/icon-512.svg",
      sameAs: [],
      contactPoint: [{
        "@type": "ContactPoint",
        contactType: "customer support",
        availableLanguage: ["uk"],
      }],
    });
  }, [location.pathname]);

  useEffect(() => {
    const dayKey = new Date().toISOString().slice(0, 10);
    const sentKey = `finok_visit_sent_${dayKey}`;
    const existingSent = localStorage.getItem(sentKey);
    if (existingSent) return;

    let visitorId = localStorage.getItem('finok_visitor_id');
    if (!visitorId) {
      visitorId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('finok_visitor_id', visitorId);
    }

    fetch(`${BACKEND_API_URL}/api/analytics/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        visitorId,
        path: location.pathname,
        referrer: document.referrer || null,
        title: document.title || null,
      }),
    })
      .then((res) => {
        if (res.ok) {
          localStorage.setItem(sentKey, '1');
        }
      })
      .catch(() => {});
  }, [location.pathname]);

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


  // Render the main app
  return (
    <Routes>
      <Route element={<AdminRoute />}>{/* This route group handles auth for admin */}
        <Route element={<AdminLayout />}>{/* This route group provides layout for admin pages */}
          <Route path={ADMIN_PATH} element={<Admin />} />
          {/* Add other admin-specific routes here if needed */}
        </Route>
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
        <Route path="/blog/:slug" element={<BlogPost />} />
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

const AdminLayout = () => {
  // A simple layout wrapper for admin pages that don't need the main Navbar/Footer
  return (
    <Outlet />
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