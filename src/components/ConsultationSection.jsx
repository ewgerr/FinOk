import ConsultationForm from "./ConsultationForm";

export default function ConsultationSection({ preselectedCategory = "", freeOnly = false }) {
  return (
    <section className="py-20 lg:py-32 bg-card">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <p className="text-sm uppercase tracking-[0.2em] text-primary mb-3">Консультація</p>
          <h2 className="font-heading text-3xl lg:text-4xl tracking-tight mb-3">
            Перша консультація — безкоштовно
          </h2>
          <p className="text-muted-foreground text-sm">
            15 хвилин, онлайн. Розберемо вашу ситуацію та запропонуємо рішення.
          </p>
        </div>
        <ConsultationForm preselectedCategory={preselectedCategory} freeOnly={freeOnly} />
      </div>
    </section>
  );
}