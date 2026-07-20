import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/backendClient";
import { useEffect } from "react";

const formatDate = (value) => {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
};

export default function BlogPost() {
  const { slug } = useParams();

  const postQuery = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: () => apiClient.blog.getBySlug(slug),
    enabled: Boolean(slug),
  });

  const post = postQuery.data || null;

  useEffect(() => {
    if (!post) return;

    const pageTitle = `${post.title} — ФінОк`;
    const pageDescription = String(post.excerpt || post.content || "").slice(0, 160);
    const canonicalHref = `https://finok.com.ua/blog/${post.slug}`;

    document.title = pageTitle;

    const ensureMeta = (name) => {
      let tag = document.head.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      return tag;
    };

    const ensurePropertyMeta = (property) => {
      let tag = document.head.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("property", property);
        document.head.appendChild(tag);
      }
      return tag;
    };

    ensureMeta("description").setAttribute("content", pageDescription);
    ensurePropertyMeta("og:type").setAttribute("content", "article");
    ensurePropertyMeta("og:title").setAttribute("content", pageTitle);
    ensurePropertyMeta("og:description").setAttribute("content", pageDescription);
    ensurePropertyMeta("og:url").setAttribute("content", canonicalHref);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalHref);

    let schemaTag = document.head.querySelector('script[data-schema="article"]');
    if (!schemaTag) {
      schemaTag = document.createElement("script");
      schemaTag.setAttribute("type", "application/ld+json");
      schemaTag.setAttribute("data-schema", "article");
      document.head.appendChild(schemaTag);
    }
    schemaTag.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: pageDescription,
      datePublished: post.publishedAt || post.createdAt,
      dateModified: post.publishedAt || post.createdAt,
      author: {
        "@type": "Organization",
        name: "ФінОк",
      },
      publisher: {
        "@type": "Organization",
        name: "ФінОк",
        logo: {
          "@type": "ImageObject",
          url: "https://finok.com.ua/image/LOGO.png",
        },
      },
      mainEntityOfPage: canonicalHref,
    });

    return () => {
      const currentArticleSchema = document.head.querySelector('script[data-schema="article"]');
      if (currentArticleSchema) currentArticleSchema.remove();
    };
  }, [post]);

  if (postQuery.isLoading) {
    return (
      <div className="pt-24 max-w-4xl mx-auto px-6 py-16">
        <p className="text-sm text-muted-foreground">Завантаження статті...</p>
      </div>
    );
  }

  if (postQuery.isError || !postQuery.data) {
    return (
      <div className="pt-24 max-w-4xl mx-auto px-6 py-16">
        <h1 className="font-heading text-3xl mb-4">Статтю не знайдено</h1>
        <Link to="/blog" className="text-primary hover:underline">Повернутися до блогу</Link>
      </div>
    );
  }

  return (
    <div className="pt-24">
      <article className="max-w-4xl mx-auto px-6 py-16">
        <Link to="/blog" className="text-sm text-primary hover:underline">← До блогу</Link>
        <h1 className="font-heading text-4xl tracking-tight mt-4 mb-3">{post.title}</h1>
        <p className="text-sm text-muted-foreground mb-8">{formatDate(post.publishedAt || post.createdAt)}</p>
        {post.excerpt ? <p className="text-lg text-muted-foreground mb-8">{post.excerpt}</p> : null}
        <div className="prose prose-slate max-w-none whitespace-pre-wrap leading-relaxed text-foreground">
          {post.content}
        </div>
      </article>
    </div>
  );
}
