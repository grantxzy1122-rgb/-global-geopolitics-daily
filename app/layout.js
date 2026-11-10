import "./globals.css";

const siteUrl = "https://global-geopolitics-daily-khan-73f2.vercel.app";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Global Geopolitics Daily | World News & Analysis",
    template: "%s | Global Geopolitics Daily",
  },
  description:
    "Follow the latest world news, geopolitics, international conflicts, diplomacy, security and global economic developments.",
  applicationName: "Global Geopolitics Daily",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Global Geopolitics Daily",
    title: "Global Geopolitics Daily | World News & Analysis",
    description:
      "Follow the latest world news, geopolitics, international conflicts, diplomacy, security and global economic developments.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Global Geopolitics Daily | World News & Analysis",
    description:
      "Follow the latest world news, geopolitics, international conflicts, diplomacy, security and global economic developments.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
