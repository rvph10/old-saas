import { ProtectedLayout as ProtectedLayoutComponent } from "@/components/layout/ProtectedLayout";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedLayoutComponent>{children}</ProtectedLayoutComponent>;
}