import { Link } from "react-router-dom";
import { serviceCategories } from "../lib/servicesData";
import { Send } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-foreground text-background/80 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-20 lg:py-28">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          <div className="lg:col-span-1">
            <h3 className="font-heading text-3xl text-background mb-3">ФінОк</h3>
            <p className="text-sm leading-relaxed text-background/50">
              Управлінський та фінансово-консалтинговий центр. Звільняємо підприємця від фінансового хаосу.
            </p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-widest text-background/40 mb-4">Послуги</h4>
            <div className="space-y-2">
              {serviceCategories.map(c => (
                <Link key={c.id} to={c.slug} className="block text-sm text-background/60 hover:text-background transition-colors">
                  {c.shortTitle}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-widest text-background/40 mb-4">Компанія</h4>
            <div className="space-y-2">
              {[{l:"Про нас",t:"/pro-nas"},{l:"Прайс",t:"/prajs"},{l:"Блог",t:"/blog"},{l:"Контакти",t:"/kontakty"}].map(i => (
                <Link key={i.t} to={i.t} className="block text-sm text-background/60 hover:text-background transition-colors">
                  {i.l}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-widest text-background/40 mb-4">Контакти</h4>
            <div className="space-y-3">
              <a href="https://t.me/FinOkSupport_bot" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-background/60 hover:text-background transition-colors">
                <Send className="w-4 h-4" /> @FinOkSupport_bot
              </a>
              <a href="mailto:info@finok.com.ua" className="text-sm text-background/60 hover:text-background transition-colors">
                info@finok.com.ua
              </a>
            </div>
          </div>
        </div>
        <div className="mt-16 pt-8 border-t border-background/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-background/30">© ФінОк 2026 · Всі послуги — інформаційно-консультаційні</p>
          <Link to="/privacy" className="text-xs text-background/30 hover:text-background/60 transition-colors">
            Політика конфіденційності
          </Link>
        </div>
      </div>
    </footer>
  );
}