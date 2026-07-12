import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import FloatingButtons from "./FloatingButtons";
import CookieConsent from "./CookieConsent";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col font-body">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <FloatingButtons />
      <CookieConsent />
    </div>
  );
}