import "./globals.css";

export const metadata = {
  title: "급여 관리 시스템",
  description: "레스토랑 근무 시간 및 팁 관리",
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