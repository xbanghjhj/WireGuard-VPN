import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "WireGuard VPN Controller & Web Dashboard",
  description: "Hệ thống quản lý VPN doanh nghiệp hiện đại — cấp phát, giám sát và điều phối kết nối WireGuard qua giao diện Web trực quan.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
