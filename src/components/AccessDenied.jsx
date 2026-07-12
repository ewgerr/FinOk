import { Link } from "react-router-dom";

export default function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-destructive/10 text-destructive text-2xl font-bold">
          !
        </div>
        <h1 className="text-3xl font-heading mb-3">Доступ заборонено</h1>
        <p className="text-muted-foreground mb-6">
          Ця сторінка доступна лише адміністраторам.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/" className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium">
            На головну
          </Link>
          <Link to="/kontakty" className="px-4 py-2 rounded border border-border text-sm font-medium">
            Контакти
          </Link>
        </div>
      </div>
    </div>
  );
}