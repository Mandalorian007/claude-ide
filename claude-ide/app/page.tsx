import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { IDEContent } from "@/components/ide-content";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <IDEContent />
      <Footer />
    </div>
  );
}
