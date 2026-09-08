import { motion } from "framer-motion";
import { Shield, Eye, Scale, Zap } from "lucide-react";

const ABOUT_IMG = "https://media.base44.com/images/public/6a0f3d95a129fb21b5a871de/cdc791503_generated_db12da0a.png";
const HALYNA_IMG = new URL("../../image/Галина.png", import.meta.url).href;

const values = [
  { icon: Eye, title: "Прозорість", desc: "Реальні ціни на сайті. Ніяких прихованих платежів і дрібного шрифту." },
  { icon: Shield, title: "Відповідальність", desc: "Фіксуємо строки та результат у договорі. Несемо відповідальність." },
  { icon: Scale, title: "Мова власника", desc: "Пояснюємо фінанси без канцелярщини — у гривнях і строках." },
  { icon: Zap, title: "Швидкість", desc: "100% онлайн. Мінімум бюрократії, максимум результату." },
];

const teamMembers = [
  {
    name: "Перший експерт",
    role: "Консультант команди",
    experience: "Профіль команди ФінОк",
    image: null,
    bio: "Працює з клієнтами над впорядкуванням фінансових процесів, податковою логікою та підготовкою бізнесу до впевненого розвитку.",
    details:
      "Цей блок уже готовий для другої фотографії та персонального опису — достатньо додати файл у папку image і оновити ім’я та текст.",
  },
  {
    name: "Другий експерт",
    role: "Консультант команди",
    experience: "Профіль команди ФінОк",
    image: null,
    bio: "Працює з клієнтами над впорядкуванням фінансових процесів, податковою логікою та підготовкою бізнесу до впевненого розвитку.",
    details:
      "Цей блок уже готовий для другої фотографії та персонального опису — достатньо додати файл у папку image і оновити ім’я та текст.",
  },
  {
    name: "Галина Ковальов",
    role: "ФІНАНСОВИЙ ЕКСПЕРТ ТА КОНСУЛЬТАНТ З УПРАВЛІННЯ БІЗНЕСОМ\nФінанси • Облік • Управління • Антикризові рішення",
    experience: "Доктор філософії (PhD) з економіки · 25+ років досвіду",
    image: HALYNA_IMG,
    bio: "Практика в бухгалтерському обліку, аудиті, управлінському обліку та стратегічному плануванні — реалізовані проєкти в агропромисловості, ІТ, будівництві, виробництві, e-commerce, фінансах та HoReCa.",
    details:
      "Спеціалізуюся на трансформації фінансових процесів, оптимізації податкового навантаження та підготовці бізнесу до масштабування — від точкових змін до повної перебудови фінансової архітектури компанії.\n Розробляю моделі та стратегії, що дають власникам і інвесторам чітке бачення окупності, ризиків і точок зростання — перетворюючи цифри на конкретні кроки для стійкого розвитку.",
  },
];

export default function About() {
  return (
    <div className="pt-24">
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-primary mb-4">Про компанію</p>
              <h1 className="font-heading text-4xl lg:text-5xl tracking-tight mb-6">
                Звільняємо бізнес від фінансового хаосу
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
              <img src={ABOUT_IMG} alt="Про ФінОк" className="w-full h-80 lg:h-[600px] object-cover" />
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
          <p className="text-muted-foreground text-sm max-w-2xl mb-10">
            Наша команда поєднує стратегічне бачення, глибоку фінансову експертизу та практичний досвід супроводу бізнесів з різних галузей.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
            {teamMembers.map((member, index) => (
              // <motion.div
              //   key={member.name}
              //   initial={{ opacity: 0, y: 20 }}
              //   whileInView={{ opacity: 1, y: 0 }}
              //   viewport={{ once: true }}
              //   transition={{ delay: index * 0.08 }}
              //   className="rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-sm"
              // >
              //   <div className="flex flex-col items-center text-center mb-6">
              //     {member.image ? (
              //       <img
              //         src={member.image}
              //         alt={member.name}
              //         className="w-28 h-28 rounded-full object-cover border border-border shadow-sm mb-4"
              //       />
              //     ) : (
              //       <div className="w-28 h-28 rounded-full border border-border bg-muted flex items-center justify-center text-2xl font-heading text-primary mb-4">
              //         {member.name
              //           .split(" ")
              //           .map((part) => part[0])
              //           .join("")
              //           .slice(0, 2)}
              //       </div>
              <motion.div
                  key={member.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  className="rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-sm"
                >
                  <div className="flex flex-col items-center text-center mb-6">
                    {member.image ? (
                      <img
                        src={member.image}
                        alt={member.name}
                        // Змінено: прямокутник (w-56 h-40), заокруглення (rounded-2xl)
                        className="w-56 h-40 rounded-2xl object-cover border border-border shadow-sm mb-4"
                      />
                    ) : (
                      // Змінено запасний блок (ініціали) для збереження тих самих пропорцій
                      <div className="w-56 h-40 rounded-2xl border border-border bg-muted flex items-center justify-center text-3xl font-heading text-primary mb-4">
                        {member.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                              
                  )}

                  <h3 className="font-heading text-2xl mb-1">{member.name}</h3>
                  <p className="text-primary text-sm font-medium">{member.role}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground mt-2">
                    {member.experience}
                  </p>
                </div>

                <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                  <p>{member.bio}</p>
                  <p>{member.details}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}