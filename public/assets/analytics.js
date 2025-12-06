// GhostConvert — GA4 custom event tracking

console.log("Analytics loaded");

// Track initial page view (SPA safe)
gtag('event', 'page_view', {
  page_title: document.title,
  page_location: window.location.href,
  page_path: window.location.pathname
});

// Helper for sending events
function trackEvent(name, data = {}) {
  gtag('event', name, data);
  console.log("GA4 Event:", name, data);
}

// Expose globally so app.js can use it
window.GCAnalytics = {
  fileSelected: (tool, fileName, fileSize) =>
    trackEvent("file_selected", {
      tool,
      file_name: fileName,
      file_size: fileSize
    }),

  conversionStarted: (tool) =>
    trackEvent("conversion_started", { tool }),

  conversionSuccess: (tool, outputFile) =>
    trackEvent("conversion_success", {
      tool,
      output_file: outputFile
    }),

  conversionFailed: (tool, errorMessage) =>
    trackEvent("conversion_failed", {
      tool,
      error: errorMessage
    })
};