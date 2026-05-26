import './globals.css';

export const metadata = {
  title: 'Career-Ops Dashboard',
  description: 'Product dashboard for Career-Ops job search pipelines'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
