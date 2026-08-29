import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function HeroSection({ heroImage }) {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img src={heroImage} alt="ФінОк — фінансовий партнер" className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/80" />
      </div>

      {/* Structural lines */}
      <div className="absolute top-0 left-[15%] w-px h-full bg-border/40 hidden lg:block" />
      <div className="absolute top-0 left-[85%] w-px h-full bg-border/40 hidden lg:block" />

      <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-16 lg:pt-0 w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-6 font-medium">
            Управлінський та фінансово-консалтинговий центр
          </p>
          <h1 className="font-heading text-3xl sm:text-5xl lg:text-7xl leading-[1.1] tracking-tight mb-6">
            Ми допомагаємо там, де немає готової відповіді
          </h1>
          <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed mb-10 max-w-xl">
            Коли бізнес, організація або проєкт росте, змінює формат, залучає партнерів, отримує гранти чи виходить на новий рівень - попередні підходи до фінансів, податків і звітності можуть уже не відповідати реальності. 
            Ми комплексно аналізуємо ситуацію: цифри, податкові наслідки, структуру роботи та вимоги до звітності. На цій основі допомагаємо обрати відповідну модель діяльності, вибудувати прозорий фінансовий і управлінський облік,
            взяти під контроль грошові потоки та підготувати фінансову частину для залучення фінансування та подальшого зростання.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/kontakty" className="inline-flex items-center justify-center px-7 py-3.5 bg-primary text-primary-foreground font-medium text-sm rounded hover:opacity-90 transition-opacity">
              Записатися на безкоштовну консультацію
            </Link>
            <Link to="/prajs" className="inline-flex items-center justify-center px-7 py-3.5 border border-foreground/20 text-foreground font-medium text-sm rounded hover:border-primary hover:text-primary transition-colors">
              Переглянути послуги
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}