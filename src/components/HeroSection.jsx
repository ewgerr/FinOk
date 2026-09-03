import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function HeroSection({ heroImage }) {
  return (
   <section className="relative min-h-[calc(100vh-5rem)] flex items-center overflow-hidden pt-28 pb-16 lg:pt-36 lg:pb-24">
  {/* Background */}
  <div className="absolute inset-0 pointer-events-none">
    <img 
      src={heroImage} 
      alt="ФінОк — фінансовий партнер" 
      className="w-full h-full object-cover opacity-20" 
    />
    <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/80" />
  </div>

  {/* Structural lines */}
  <div className="absolute top-0 left-[15%] w-px h-full bg-border/40 hidden lg:block pointer-events-none" />
  <div className="absolute top-0 left-[85%] w-px h-full bg-border/40 hidden lg:block pointer-events-none" />

  <div className="relative max-w-7xl mx-auto px-6 w-full">
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="max-w-3xl"
    >
      <p className="text-sm uppercase tracking-[0.2em] text-primary mb-4 font-normal">
        Управлінський та фінансово-консалтинговий центр
        <br />
      </p>
      <h1 className="font-heading text-3xl sm:text-5xl lg:text-5xl xl:text-6xl leading-[1.15] tracking-tight mb-6">
        Фінансовйи партнер для вашого бізнесу
      </h1>
      <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-8 max-w-2xl">
      Працюємо з власниками бізнесу на будь-якому етапі — від ідеї до масштабування.
        <br /><br />
      Допомагаємо навести лад у фінансах і обліку, коли бізнес змінюється: з'являються нові партнери, потрібні гранти або настав час зростати.
        <br /><br />
        Аналізуємо поточний стан, знаходимо оптимальні рішення й вибудовуємо прозору фінансову систему — таку, що витримує перевірки, зрозуміла партнерам і працює на зростання бізнесу.
      </p>
        <div className="flex flex-col sm:flex-row gap-4">
            <Link 
              to="/kontakty" 
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3.5 sm:py-4 bg-primary text-primary-foreground font-bold text-base sm:text-lg rounded-md hover:opacity-90 transition-opacity text-center shadow-sm"
            >
              Записатися на безкоштовну консультацію
            </Link>
            <Link 
              to="/prajs" 
              className="inline-flex items-center justify-center px-6 sm:px-6 py-3.5 sm:py-4 border-2 border-foreground/20 text-foreground  text-base sm:text-lg rounded-md hover:border-primary hover:text-primary transition-colors text-center"
            >
              Переглянути послуги
            </Link>
        </div>
    </motion.div>
  </div>
</section>
  );
}