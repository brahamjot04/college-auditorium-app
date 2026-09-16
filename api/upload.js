// api/upload.js
// Vercel Serverless Function: securely uploads auditorium assets to GitHub
// The GITHUB_TOKEN is stored as a server environment variable and NEVER sent to the client.
// Callers must provide a valid Firebase Auth ID token in the Authorization header.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  // 1. Authenticate caller using Firebase Auth ID Token
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized: Missing or invalid Authorization Bearer token.",
    });
  }

  const idToken = authHeader.split("Bearer ")[1]?.trim();
  if (!idToken) {
    return res.status(401).json({
      error: "Unauthorized: Missing authentication token.",
    });
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    "theatre-event-gndec";

  try {
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );

    if (!verifyRes.ok) {
      return res.status(401).json({
        error: "Unauthorized: Invalid or expired authentication token.",
      });
    }

    const tokenData = await verifyRes.json();
    // Verify token was issued by Google for our specific Firebase project
    if (tokenData.aud !== projectId && !tokenData.iss?.includes(projectId)) {
      return res.status(403).json({
        error: "Forbidden: Token was not issued for this auditorium project.",
      });
    }
  } catch (authErr) {
    console.error("Auth verification error:", authErr);
    return res.status(401).json({
      error: "Unauthorized: Failed to verify authentication token.",
    });
  }

  // 2. Read server-side environment variables (configured in Vercel Dashboard or local .env)
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const USERNAME =
    process.env.GITHUB_USERNAME ||
    process.env.VITE_GITHUB_USERNAME ||
    "brahamjot04";
  const REPO_NAME =
    process.env.GITHUB_REPO ||
    process.env.VITE_GITHUB_REPO ||
    "event-report-cc-app-data";
  const BRANCH =
    process.env.GITHUB_BRANCH ||
    process.env.VITE_GITHUB_BRANCH ||
    "main";

  if (!GITHUB_TOKEN) {
    return res.status(500).json({
      error: "Server configuration error: GITHUB_TOKEN environment variable is not set.",
    });
  }

  try {
    const { content, fileName } = req.body || {};

    if (!content || !fileName) {
      return res.status(400).json({
        error: "Missing required fields: 'content' (base64 string) and 'fileName'.",
      });
    }

    // Restrict payload size (max 5MB file -> ~7MB base64 string)
    const MAX_BASE64_LENGTH = 7 * 1024 * 1024;
    if (typeof content !== "string" || content.length > MAX_BASE64_LENGTH) {
      return res.status(413).json({
        error: "Payload too large. Assets must not exceed 5MB.",
      });
    }

    // Validate file extension against allowed raster image formats (blocks SVG script execution)
    const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : "";
    const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({
        error: "Invalid file format. Only PNG, JPG, JPEG, and WebP images are permitted.",
      });
    }

    // Destination folder is strictly locked to prevent directory traversal and workflow injection
    const FOLDER = "auditorium-assets";
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${FOLDER}/${Date.now()}_${sanitizedFileName}`;

    // Upload via GitHub Contents API using server-side token
    const response = await fetch(
      `https://api.github.com/repos/${USERNAME}/${REPO_NAME}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": "College-Auditorium-App-Backend",
        },
        body: JSON.stringify({
          message: `Upload auditorium branding asset: ${sanitizedFileName}`,
          content: content,
          branch: BRANCH,
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      const publicUrl = `https://raw.githubusercontent.com/${USERNAME}/${REPO_NAME}/${BRANCH}/${path}`;
      return res.status(200).json({
        success: true,
        path: path,
        publicUrl: publicUrl,
      });
    } else {
      console.error("GitHub API error:", data);
      return res.status(response.status).json({
        error: data.message || "Failed to upload asset to GitHub.",
      });
    }
  } catch (error) {
    console.error("Server upload handler error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error during upload.",
    });
  }
}
