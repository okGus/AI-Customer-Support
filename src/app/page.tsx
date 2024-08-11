import AIChat from "./components/AIChat";
import { SignedOut, SignedIn, SignIn } from "@clerk/nextjs";

export default function HomePage() {
  return (
    // <main className="flex w-full h-[calc(100vh - 80px)]">
    <main>
      <SignedOut>
        <div className="flex justify-center p-5">
        <SignIn routing='hash' />
        </div>
      </SignedOut>

      <SignedIn>
        <AIChat />
      </SignedIn>
    </main>
  );
}
