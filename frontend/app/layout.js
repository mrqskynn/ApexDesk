import "./globals.css";

export const metadata = {
  title: "ApexDesk - AI Helpdesk & Workflow Automation",
  description: "Modern SaaS IT Helpdesk & Agentic Workflow Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
