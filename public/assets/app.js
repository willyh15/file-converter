// public/assets/app.js

/**
 * Generic tool handler for file upload + conversion + polling
 */

async function handleToolPage(config) {
  const fileInput = document.querySelector("#file-input");
  const uploadArea = document.querySelector("#upload-area");
  const fileNameEl = document.querySelector("#file-name");
  const convertBtn = document.querySelector("#convert-btn");
  const statusText = document.querySelector("#status-text");
  const progressBar = document.querySelector("#progress-bar");

  let selectedFile = null;
  let isConverting = false;
  const apiBase = "/api";

  function setStatus(text, type = "info") {
    statusText.textContent = text;
    statusText.classList.remove("success", "error");
    if (type === "success") statusText.classList.add("success");
    if (type === "error") statusText.classList.add("error");
  }

  function setProgress(value) {
    progressBar.style.width = `${value}%`;
  }

  function reset() {
    isConverting = false;
    setProgress(0);
  }

  function showFileName(file) {
    if (!fileNameEl) return;
    fileNameEl.textContent = file ? file.name : "";
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      selectedFile = file;
      fileInput.files = e.dataTransfer.files;
      showFileName(file);
      setStatus("File ready. Click Convert to start.");
    }
  }

  uploadArea?.addEventListener("click", () => fileInput?.click());
  uploadArea?.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  uploadArea?.addEventListener("drop", handleDrop);

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) {
      selectedFile = file;
      showFileName(file);
      setStatus("File ready. Click Convert to start.");
    }
  });

  convertBtn?.addEventListener("click", async () => {
    if (isConverting) return;
    if (!selectedFile) {
      setStatus("Please select a file first.", "error");
      return;
    }

    try {
      isConverting = true;
      setStatus("Uploading file...");
      setProgress(10);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("tool", config.tool);

      const res = await fetch(`${apiBase}/convert`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }

      const { jobId } = await res.json();
      setStatus("Processing file...");
      setProgress(40);

      // Poll status
      let attempts = 0;
      const maxAttempts = 60;

      const poll = async () => {
        attempts++;
        const r = await fetch(`${apiBase}/status/${jobId}`);
        if (!r.ok) throw new Error("Status check failed");

        const data = await r.json();
        if (data.status === "completed" && data.downloadUrl) {
          setStatus("Done! Download starting...", "success");
          setProgress(100);
          window.location.href = data.downloadUrl;
          isConverting = false;
          return;
        }

        if (data.status === "failed") {
          throw new Error("Conversion failed");
        }

        if (attempts >= maxAttempts) {
          throw new Error("Timed out waiting for conversion");
        }

        // simple fake progress
        const prog = 40 + Math.min(50, attempts * 2);
        setProgress(prog);

        setTimeout(poll, 2000);
      };

      await poll();
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Something went wrong", "error");
      setProgress(0);
      isConverting = false;
    }
  });

  // initial UI state
  setStatus("Select or drop a file to get started.");
}

/**
 * Home page navigation hook (optional)
 */
document.addEventListener("DOMContentLoaded", () => {
  const heroPrimary = document.querySelector("#hero-primary-btn");
  if (heroPrimary) {
    heroPrimary.addEventListener("click", () => {
      window.location.href = "/tools/png-to-jpg.html";
    });
  }
});
