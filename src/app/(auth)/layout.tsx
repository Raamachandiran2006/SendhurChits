
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4">
      <div className="flex flex-col items-center mb-6">
        <Image
          src="/logo.png"
          alt="Sendhur Chits Logo"
          width={120} // Adjust width as needed
          height={120} // Adjust height as needed
          priority // Load the logo quickly
          data-ai-hint="company logo"
        />
      </div>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
