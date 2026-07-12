import { useState, useEffect } from 'react';
import { X, Cookie } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'finok_cookie_consent';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const storedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!storedConsent) {
      setIsVisible(true);
    } else {
      setIsAccepted(storedConsent === 'accepted');
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    setIsAccepted(true);
    setIsVisible(false);
    
    // Initialize GA if cookie is accepted and GA is available
    if (window.gtag && window.__GA_ID__) {
      window.gtag('consent', 'update', {
        'analytics_storage': 'granted'
      });
    }
  };

  const handleReject = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'rejected');
    setIsAccepted(false);
    setIsVisible(false);
    
    // Disable GA if cookie is rejected and GA is available
    if (window.gtag && window.__GA_ID__) {
      window.gtag('consent', 'update', {
        'analytics_storage': 'denied'
      });
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-foreground text-background p-4 lg:p-6 shadow-2xl">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Content */}
          <div className="flex items-start gap-3 flex-1">
            <Cookie className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed">
              <p className="font-medium mb-1">Ми використовуємо cookies та аналітику</p>
              <p className="text-background/70 text-xs">
                Для покращення досвіду користування та аналізу трафіку. Деталі у&nbsp;
                <a href="/privacy" className="underline hover:text-background transition-colors">Політиці конфіденційності</a>.
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 flex-shrink-0 sm:flex-col lg:flex-row">
            <button
              onClick={handleReject}
              className="px-4 py-2 text-xs font-medium border border-background/30 rounded hover:border-background/60 transition-colors"
            >
              Відхилити
            </button>
            <button
              onClick={handleAccept}
              className="px-4 py-2 text-xs font-medium bg-background text-foreground rounded hover:opacity-90 transition-opacity"
            >
              Прийняти
            </button>
          </div>

          {/* Close button */}
          <button
            onClick={handleReject}
            className="absolute top-4 right-4 text-background/60 hover:text-background transition-colors"
            aria-label="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
