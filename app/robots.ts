import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_ENV === "staging") {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: { userAgent: "*", allow: "/" },
  };
}
