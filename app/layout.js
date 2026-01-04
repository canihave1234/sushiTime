import "./globals.css";

export const metadata = {
  title: "system",
  description: "for SY",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}