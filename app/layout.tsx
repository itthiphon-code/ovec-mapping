import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const base = `${host.includes("localhost") ? "http" : "https"}://${host}`;
  return {
    title: "OVEC Mapping | ใบรับรอง TPQI เทียบวิชาอะไรได้บ้าง",
    description:
      "ค้นรายวิชาที่เสนอให้พิจารณาเทียบโอนจากใบรับรองมาตรฐาน TPQI ที่สอบผ่าน พร้อมหลักฐานและการตรวจรับรองโดยผู้เชี่ยวชาญ",
    metadataBase: new URL(base),
    openGraph: {
      title: "OVEC Mapping · เชื่อมสมรรถนะ สู่โอกาสใหม่",
      description: "ระบบเทียบเคียง TPQI กับรายวิชาอาชีวศึกษา",
      type: "website",
      images: [
        { url: `${base}/og.png?v=ovec-mapping`, width: 1536, height: 1024 },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [`${base}/og.png?v=ovec-mapping`],
    },
    robots: { index: false, follow: false },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
