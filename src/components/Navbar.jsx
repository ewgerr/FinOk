import { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import { serviceCategories } from "../lib/servicesData";
import { useAuth } from "@/lib/AuthContext";
import { ADMIN_PATH } from "@/lib/adminPath";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); setServicesOpen(false); }, [location]);

  const navLinks = [
    { label: "Прайс", to: "/prajs" },
    { label: "Про нас", to: "/pro-nas" },
    { label: "Блог", to: "/blog" },
    { label: "Контакти", to: "/kontakty" },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "bg-background/90 backdrop-blur-md border-b border-border shadow-sm" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center">
          <img src="/icon-192.svg" alt="ФінОк" className="h-14 w-auto object-contain" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-8">
          <div className="relative group"
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}>
            <button className="flex items-center gap-1 text-sm font-body text-foreground/70 hover:text-primary transition-colors">
              Послуги <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {servicesOpen && (
              <div className="absolute top-full left-0 pt-2">
                <div className="bg-card border border-border rounded-md shadow-lg p-3 min-w-[240px]">
                  {serviceCategories.map(c => (
                    <Link key={c.id} to={c.slug} className="block px-3 py-2 text-sm text-foreground/70 hover:text-primary hover:bg-secondary/50 rounded transition-colors">
                      {c.shortTitle}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `text-sm font-body transition-colors ${isActive ? "text-primary" : "text-foreground/70 hover:text-primary"}`
              }
            >
              {l.label}
            </NavLink>
          ))}
          {user?.role === 'ADMIN' && (
            <Link to={ADMIN_PATH} className="text-sm font-body text-foreground/70 hover:text-primary transition-colors">
              Admin
            </Link>
          )}
          <Link to="/zapis" className="ml-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:opacity-90 transition-opacity">
            Записатися
          </Link>
        </nav>

        {/* Mobile burger */}
        <button className="lg:hidden text-foreground" onClick={() => setOpen(!open)}>
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden bg-background border-t border-border">
          <nav className="max-w-7xl mx-auto px-6 py-4 space-y-1">
            <button onClick={() => setServicesOpen(!servicesOpen)} className="w-full flex items-center justify-between py-3 text-sm text-foreground/70">
              Послуги <ChevronDown className={`w-4 h-4 transition-transform ${servicesOpen ? "rotate-180" : ""}`} />
            </button>
            {servicesOpen && (
              <div className="pl-4 space-y-1">
                {serviceCategories.map(c => (
                  <Link key={c.id} to={c.slug} className="block py-2 text-sm text-foreground/60 hover:text-primary">
                    {c.shortTitle}
                  </Link>
                ))}
              </div>
            )}
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `block py-3 text-sm transition-colors ${isActive ? "text-primary" : "text-foreground/70 hover:text-primary"}`
                }
              >
                {l.label}
              </NavLink>
            ))}
            {user?.role === 'ADMIN' && (
              <Link to={ADMIN_PATH} className="block py-3 text-sm text-foreground/70 hover:text-primary">
                Admin
              </Link>
            )}
            <Link to="/zapis" className="block mt-4 text-center px-5 py-3 bg-primary text-primary-foreground text-sm font-medium rounded">
              Записатися
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}