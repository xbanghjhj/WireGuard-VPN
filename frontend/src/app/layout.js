import "./globals.css";

export const metadata = {
  title: "WireGuard VPN Controller & Web Dashboard",
  description: "Hệ thống quản lý VPN doanh nghiệp hiện đại — cấp phát, giám sát và điều phối kết nối WireGuard qua giao diện Web trực quan.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
