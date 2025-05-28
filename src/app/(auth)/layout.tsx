
// import Image from "next/image"; // No longer needed if logo is removed

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4">
      {/* Logo display removed from here */}
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
