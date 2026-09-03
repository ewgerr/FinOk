import { motion } from "framer-motion";

const steps = [
  { num: "01", title: "Безкоштовна консультація", desc: "15 хвилин — з'ясовуємо вашу ситуацію та потреби." },
  { num: "02", title: "Комерційна пропозиція", desc: "Формуємо чітку пропозицію з фіксованою ціною та строками." },
  { num: "03", title: "Робота над завданням", desc: "Ви займаєтесь бізнесом — ми ведемо ваші фінанси." },
  { num: "04", title: "Результат та підтримка", desc: "Передаємо готовий результат і залишаємося на зв'язку." },
];

export default function HowWeWorkSection() {
  return (
    <section className="py-20 lg:py-32 bg-card">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <p className="text-sm uppercase tracking-[0.2em] text-primary mb-3">Процес</p>
          <h2 className="font-heading text-3xl lg:text-5xl tracking-tight">Як ми працюємо</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <span className="font-heading text-5xl text-primary/20 block mb-3">{s.num}</span>
              <h3 className="font-heading text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}