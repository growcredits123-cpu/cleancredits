import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>FruitMap - Community Harvest & Exchange</title>
        <meta name="description" content="Discover, share, and exchange nearby fruits, vegetables, trees, and seeds on the interactive FruitMap." />
        <link rel="icon" type="image/png" href="/assets/images/favicon.png" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveGlobalStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveGlobalStyles = `
  /* Global Web & Responsive Styles */
  html, body {
    height: 100%;
    margin: 0;
    padding: 0;
    background-color: #f8fafc;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
  #root {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    height: 100%;
    background-color: #f8fafc;
  }
  /* Modern clean scrollbars */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: #f1f5f9;
  }
  ::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
  /* Interactive pointer on buttons and clickable elements */
  [role="button"], button, a {
    cursor: pointer !important;
  }
`;
