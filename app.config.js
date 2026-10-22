// Ergänzt app.json um Werte aus Umgebungsvariablen.
// GYMQUEST_BASE_URL: Unterpfad der Web-App, z. B. "/gymquest" auf GitHub Pages (leer = Domain-Wurzel).
module.exports = ({ config }) => {
  const baseUrl = (process.env.GYMQUEST_BASE_URL || '').replace(/\/+$/, '');
  return {
    ...config,
    experiments: { ...config.experiments, ...(baseUrl ? { baseUrl } : {}) },
  };
};
