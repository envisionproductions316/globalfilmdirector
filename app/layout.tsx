import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { StudioProvider } from "@/lib/studio";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Global Film Director",
  description: "Local film studio for projects, direction, characters, capture, storyboard, edit, audio, export, and connectors.",
};

const themeBoot = `try{var s=JSON.parse(localStorage.getItem("gfd.studio.v1")||"{}");document.documentElement.dataset.theme=s.theme==="day"?"day":"night"}catch(e){document.documentElement.dataset.theme="night"}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="night" suppressHydrationWarning className={inter.variable}>
      <body>
        <Script id="theme-boot" strategy="beforeInteractive">
          {themeBoot}
        </Script>
        <AuthProvider>
          <StudioProvider>
            <AppShell>{children}</AppShell>
          </StudioProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
