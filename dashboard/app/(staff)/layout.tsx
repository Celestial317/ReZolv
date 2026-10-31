import Sidebar from "@/components/Sidebar";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Sidebar />
      <div className="main">{children}</div>
    </div>
  );
}
