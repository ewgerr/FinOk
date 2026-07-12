// Google Analytics tracking utility

const hasGA = () => window.gtag && window.__GA_ID__;

export const trackPageView = (path, title) => {
  if (hasGA()) {
    window.gtag('config', window.__GA_ID__, {
      page_path: path,
      page_title: title
    });
  }
};

export const trackEvent = (eventName, eventParams = {}) => {
  if (hasGA()) {
    window.gtag('event', eventName, eventParams);
  }
};

export const trackFormSubmission = (formName) => {
  trackEvent('form_submit', {
    form_name: formName,
    timestamp: new Date().toISOString()
  });
};

export const trackServiceClick = (serviceName) => {
  trackEvent('service_click', {
    service_name: serviceName,
    timestamp: new Date().toISOString()
  });
};

export const trackContactClick = (contactType) => {
  trackEvent('contact_click', {
    contact_type: contactType,
    timestamp: new Date().toISOString()
  });
};
