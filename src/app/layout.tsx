import { AntdRegistry } from "@ant-design/nextjs-registry";
import type { Metadata } from "next";
import "./globals.css";
import AntdProvider from "./AntdProvider";

export const metadata: Metadata = {
  title: "EliteHub",
  description: "Connect. Grow. Excel.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <AntdProvider>
            {children}
          </AntdProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}

