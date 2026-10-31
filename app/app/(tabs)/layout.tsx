import BottomNav from "@/components/BottomNav";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="page">{children}</main>
      <BottomNav />
    </>
  );
}
