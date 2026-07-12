import { Link } from "react-router-dom";

export default function Blog() {
  return (
    <div className="pt-24">
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-4">Блог</p>
          <h1 className="font-heading text-4xl lg:text-6xl tracking-tight mb-6">Корисні матеріали</h1>
          <p className="text-lg text-muted-foreground max-w-xl mb-16">
            Статті, поради та новини для підприємців. Пояснюємо складне — простою мовою.
          </p>

          <div className="text-center py-16 border border-dashed border-border rounded-md">
            <p className="text-muted-foreground text-sm mb-4">Розділ у розробці</p>
            <p className="text-xs text-muted-foreground">Незабаром тут з'являться статті про реєстрацію ФОП, гранти, управлінський облік та інше.</p>
            <Link to="/" className="inline-block mt-6 text-sm text-primary hover:underline">
              Повернутися на головну
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}