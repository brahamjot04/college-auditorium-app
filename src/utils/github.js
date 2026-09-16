// src/utils/github.js
// Client-side GitHub asset utility
// SECURE IMPLEMENTATION: No secrets or Personal Access Tokens (PAT) exist in client code.

import { auth } from "../firebase";

const USERNAME = import.meta.env.VITE_GITHUB_USERNAME;
const REPO_NAME = import.meta.env.VITE_GITHUB_REPO;
const BRANCH = import.meta.env.VITE_GITHUB_BRANCH;

// Cache for loaded images to avoid repeated network requests
const imageCache = new Map();

/**
 * Returns direct public raw URL for an asset in the GitHub repository
 * @param {string} path - Relative path in repository (e.g. "auditorium-assets/1234_logo.png")
 * @returns {string} Public direct CDN URL
 */
export const getGitHubImageUrl = (path) => {
  if (!path) return null;
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  ) {
    return path;
  }
  // Route through the secure serverless asset proxy for private repository support
  return `/api/asset?path=${encodeURIComponent(path)}`;
};

/**
 * Upload an image file via the secure serverless backend endpoint (/api/upload).
 * The server holds the GITHUB_TOKEN securely in environment variables.
 * Attaches the logged-in user's Firebase Auth ID token for authorization.
 *
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

    // 2. Obtain Firebase Auth ID token for authorization
    const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : "";
    const headers = {
      "Content-Type": "application/json",
    };
    if (idToken) {
      headers["Authorization"] = `Bearer ${idToken}`;
    }

    // 3. Delegate upload to secure serverless endpoint
    const response = await fetch("/api/upload", {
      method: "POST",
      headers,
      body: JSON.stringify({
        content,
        fileName,
        folder,
      }),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        `Server returned HTTP ${response.status} (${response.statusText || "Unexpected response"})`
      );
    }

    if (response.ok && data.path) {
      console.log("Asset uploaded successfully to GitHub:", data.path);
      return data.path;
    } else {
      console.error("Upload error response:", data);
      alert(`Upload Failed: ${data.error || "Server could not process upload."}`);
      return null;
    }
  } catch (error) {
    console.error("Upload request failed:", error);
    alert(`Upload request failed: ${error.message}`);
    return null;
  }
};

/**
 * Fetch an image from GitHub repository and return a usable URL.
 * Works seamlessly with public repositories without any tokens.
 *
 * @param {string} path
 * @returns {Promise<string|null>} Usable image URL
 */
export const fetchImageFromGitHub = async (path) => {
  if (!path) return null;

  if (imageCache.has(path)) {
    return imageCache.get(path);
  }

  // Direct public raw URL from GitHub
  const rawUrl = getGitHubImageUrl(path);
  imageCache.set(path, rawUrl);
  return rawUrl;
};
