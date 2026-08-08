import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import "../wellpath-src/styles.css";
import "../wellpath-src/components/survey/survey.css";
import "../wellpath-src/components/insights/insights.css";
import "../wellpath-src/components/nutrition/nutrition.css";
import "../wellpath-src/components/risksignal/risksignal.css";
import "../wellpath-src/styles/role-refinements.css";
import "../wellpath-src/styles/trainer-workspace.css";
import "../wellpath-src/styles/trainer-workspace-extra.css";
import "../wellpath-src/styles/clinician-workflow.css";
import "../wellpath-src/styles/clinician-responsive.css";
import "../wellpath-src/styles/pro-workspaces.css";
import "./web-overrides.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0];
  const candidateHost = forwardedHost || requestHeaders.get("host") || "";
  const host = /^[a-z0-9.-]+(?::\d+)?$/i.test(candidateHost)
    ? candidateHost
    : "localhost:3001";
  const forwardedProtocol = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0];
  const protocol =
    forwardedProtocol === "https" || forwardedProtocol === "http"
      ? forwardedProtocol
      : host.startsWith("localhost")
        ? "http"
        : "https";
  const baseUrl = new URL(`${protocol}://${host}`);
  const description =
    "A responsive WellPath Health workspace for patients, trainers, and clinicians, with live AI-powered lifestyle insights.";

  return {
    metadataBase: baseUrl,
    title: "WellPath Health | Connected wellness workspace",
    description,
    icons: {
      icon: "/wellpath-icon.svg",
      shortcut: "/wellpath-icon.svg",
    },
    openGraph: {
      type: "website",
      title: "WellPath Health",
      description: "Connected wellness. Clearer next steps.",
      images: [
        {
          url: new URL("/og.png", baseUrl).toString(),
          width: 1732,
          height: 909,
          alt: "WellPath Health connected wellness dashboard",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "WellPath Health",
      description: "Connected wellness. Clearer next steps.",
      images: [new URL("/og.png", baseUrl).toString()],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
