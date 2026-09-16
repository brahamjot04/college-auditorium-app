// api/asset.js
// Vercel Serverless Function: securely proxies assets from private GitHub repository
// The GITHUB_TOKEN is kept strictly on the server and never exposed to the client.

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const { path } = req.query || {};
  if (!path || typeof path !== "string") {
    return res.status(400).json({ error: "Missing required 'path' query parameter." });
  }

  // Security Verification: Only permit assets from auditorium-assets/ and block directory traversal
  const normalizedPath = path.replace(/\\/g, "/").trim();
  if (
    normalizedPath.includes("..") ||
    !normalizedPath.startsWith("auditorium-assets/")
  ) {
    return res.status(403).json({ error: "Forbidden: Invalid or unauthorized asset path." });
  }

  // Restrict to supported raster image formats
  if (!/\.(png|jpg|jpeg|webp)$/i.test(normalizedPath)) {
    return res.status(400).json({ error: "Invalid asset format. Only PNG, JPG, JPEG, and WebP are allowed." });
  }

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
    const rawUrl = `https://raw.githubusercontent.com/${USERNAME}/${REPO_NAME}/${BRANCH}/${normalizedPath}`;
    const response = await fetch(rawUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "User-Agent": "College-Auditorium-App-Asset-Proxy",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Asset not found in repository (${response.status})`,
      });
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Strong edge and client caching: cache for 24h on browser, 7 days on CDN edge
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
    );
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Asset proxy error:", error);
    return res.status(500).json({ error: "Internal server error fetching asset." });
  }
}
