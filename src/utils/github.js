// src/utils/github.js
// Replicated from gndec-reports with auditorium-assets folder default

const GITHUB_TOKEN =
  import.meta.env.VITE_GITHUB_TOKEN || "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";
const USERNAME = import.meta.env.VITE_GITHUB_USERNAME || "brahamjot04";
const REPO_NAME = import.meta.env.VITE_GITHUB_REPO || "event-report-cc-app-data";
const BRANCH = import.meta.env.VITE_GITHUB_BRANCH || "main";

// Cache for loaded images to avoid repeated API calls
const imageCache = new Map();

/**
 * Upload an image file to GitHub repository
 * @param {File} file
 * @param {string} fileName
 * @param {string} folder
 * @returns {Promise<string|null>} Relative path in repository
 */
export const uploadToGitHub = async (file, fileName, folder = "auditorium-assets") => {
  try {
    // 1. Convert File to Base64
    const toBase64 = (f) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(f);
        reader.onload = () => {
          const base64String = reader.result.split(",")[1];
          resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
      });

    const content = await toBase64(file);
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${folder}/${Date.now()}_${sanitizedFileName}`;

    // 2. Upload via GitHub API
    const response = await fetch(
      `https://api.github.com/repos/${USERNAME}/${REPO_NAME}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Upload auditorium branding asset: ${sanitizedFileName}`,
          content: content,
          branch: BRANCH,
        }),
      },
    );

    const data = await response.json();

    if (response.ok) {
      console.log("Branding asset uploaded successfully to GitHub:", path);
      return path;
    } else {
      console.error("GitHub Upload Error:", data);
      alert(`GitHub Upload Failed: ${data.message || "Unknown error"}`);
      return null;
    }
  } catch (error) {
    console.error("Upload to GitHub failed:", error);
    alert(`Upload failed: ${error.message}`);
    return null;
  }
};

/**
 * Fetch an image from GitHub repository and convert to Data URL
 * @param {string} path
 * @returns {Promise<string|null>} Base64 Data URL
 */
export const fetchImageFromGitHub = async (path) => {
  if (!path) return null;

  // Check cache first
  if (imageCache.has(path)) {
    return imageCache.get(path);
  }

  try {
    const url = `https://api.github.com/repos/${USERNAME}/${REPO_NAME}/contents/${path}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch image from GitHub:", response.status);
      return null;
    }

    const data = await response.json();
    if (!data.content) return null;

    const extension = path.split(".").pop().toLowerCase();
    const mimeTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
    };
    const mimeType = mimeTypes[extension] || "image/jpeg";
    const cleanBase64 = data.content.replace(/\s/g, "");
    const dataUrl = `data:${mimeType};base64,${cleanBase64}`;

    imageCache.set(path, dataUrl);
    return dataUrl;
  } catch (error) {
    console.error("Error fetching image from GitHub:", error);
    return null;
  }
};
