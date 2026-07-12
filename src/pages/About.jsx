import { motion } from "framer-motion";
import { Shield, Eye, Scale, Zap } from "lucide-react";

const ABOUT_IMG = "https://media.base44.com/images/public/6a0f3d95a129fb21b5a871de/cdc791503_generated_db12da0a.png";

const values = [
  { icon: Eye, title: "Прозорість", desc: "Реальні ціни на сайті. Ніяких прихованих платежів і дрібного шрифту." },
  { icon: Shield, title: "Відповідальність", desc: "Фіксуємо строки та результат у договорі. Несемо відповідальність." },
  { icon: Scale, title: "Мова власника", desc: "Пояснюємо фінанси без канцелярщини — у гривнях і строках." },
  { icon: Zap, title: "Швидкість", desc: "100% онлайн. Мінімум бюрократії, максимум результату." },
];

export default function About() {
  return (
    <div className="pt-24">
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-primary mb-4">Про компанію</p>
              <h1 className="font-heading text-4xl lg:text-5xl tracking-tight mb-6">
                Звільняємо підприємця від фінансового хаосу
              </h1>
              <div className="space-y-4 text-muted-foreground text-sm leading-relaxed">
                <p>
                  ФінОк — управлінський та фінансово-консалтинговий центр, що надає інформаційно-консультаційні послуги для ФОП, ТОВ, IT-фахівців, НПО та підприємців у сфері грантів.
                </p>
                <p>
                  Наша місія — пояснювати мовою власника, у гривнях і строках. Ми працюємо повністю онлайн, обслуговуємо клієнтів по всій Україні.
                </p>
                <p>
                  Усі наші послуги — інформаційно-консультаційні і не підлягають ліцензуванню відповідно до законодавства України.
                </p>
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="rounded-md overflow-hidden"
            >
              <img src={ABOUT_IMG} alt="Про ФінОк" className="w-full h-80 lg:h-[450px] object-cover" />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24 bg-card">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-heading text-3xl lg:text-4xl tracking-tight mb-12">Наші цінності</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((v, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-5"
              >
                <v.icon className="w-6 h-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-heading text-lg mb-1">{v.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-heading text-3xl lg:text-4xl tracking-tight mb-6">Команда</h2>
          <p className="text-muted-foreground text-sm max-w-xl">
            Розділ у розробці. Незабаром тут з'являться члени нашої команди з їхніми спеціалізаціями та досвідом.
          </p>
        </div>
      </section>
    </div>
  );
}