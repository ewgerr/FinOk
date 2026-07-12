import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/backendClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const formatDate = (value) => {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
};

export default function Blog() {
  const postsQuery = useQuery({
    queryKey: ["blog-posts"],
    queryFn: () => apiClient.blog.list({ limit: 60 }),
  });

  const posts = postsQuery.data || [];

  return (
    <div className="pt-24">
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-4">Блог</p>
          <h1 className="font-heading text-4xl lg:text-6xl tracking-tight mb-6">Корисні матеріали</h1>
          <p className="text-lg text-muted-foreground max-w-xl mb-16">
            Статті, поради та новини для підприємців. Пояснюємо складне — простою мовою.
          </p>

          {postsQuery.isLoading && (
            <div className="text-center py-16 border border-dashed border-border rounded-md">
              <p className="text-muted-foreground text-sm">Завантажуємо матеріали...</p>
            </div>
          )}

          {!postsQuery.isLoading && !posts.length && (
            <div className="text-center py-16 border border-dashed border-border rounded-md">
              <p className="text-muted-foreground text-sm mb-4">Поки що немає публікацій</p>
              <p className="text-xs text-muted-foreground">Незабаром тут з'являться новини та корисні матеріали для підприємців.</p>
              <Link to="/" className="inline-block mt-6 text-sm text-primary hover:underline">
                Повернутися на головну
              </Link>
            </div>
          )}

          {!!posts.length && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {posts.map((post) => (
                <Card key={post.id} className="border-border/70">
                  <CardHeader>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {post.category ? <Badge variant="secondary">{post.category}</Badge> : null}
                      <Badge variant="outline">{formatDate(post.publishedAt || post.createdAt)}</Badge>
                    </div>
                    <CardTitle className="text-2xl leading-tight">{post.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {post.excerpt ? (
                      <p className="text-muted-foreground">{post.excerpt}</p>
                    ) : (
                      <p className="text-muted-foreground">{String(post.content || "").slice(0, 220)}...</p>
                    )}

                    {Array.isArray(post.tags) && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {post.tags.map((tag) => (
                          <span key={tag} className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">#{tag}</span>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-border/50">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}