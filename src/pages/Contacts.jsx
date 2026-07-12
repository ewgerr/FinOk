import { Send, Mail } from "lucide-react";
import ConsultationSection from "../components/ConsultationSection";

export default function Contacts() {
  return (
    <div className="pt-24">
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-4">Контакти</p>
          <h1 className="font-heading text-4xl lg:text-6xl tracking-tight mb-6">Зв'яжіться з нами</h1>
          <p className="text-lg text-muted-foreground max-w-xl mb-12">
            Оберіть зручний спосіб зв'язку або заповніть форму нижче.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl">
            <a href="https://t.me/finok_ua" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-5 border border-border rounded-md hover:border-primary/30 transition-colors">
              <Send className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Telegram</p>
                <p className="text-xs text-muted-foreground">@finok_ua</p>
              </div>
            </a>
            <a href="mailto:info@finok.com.ua" className="flex items-center gap-4 p-5 border border-border rounded-md hover:border-primary/30 transition-colors">
              <Mail className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-xs text-muted-foreground">info@finok.com.ua</p>
              </div>
            </a>
          </div>
        </div>
      </section>
      <ConsultationSection />
    </div>
  );
}