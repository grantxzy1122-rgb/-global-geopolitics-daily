
import "./globals.css";

export const metadata = {
  title: "Global Geopolitics Daily",
  description:
    "Your trusted source for global politics, geopolitics, international conflicts and world affairs.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
