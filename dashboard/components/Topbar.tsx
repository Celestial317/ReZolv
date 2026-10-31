import { IconBell, IconChevron, IconSearch } from "./Icons";
import { STAFF_USER } from "@/lib/mock";

export default function Topbar({ title, sub }: { title: string; sub?: React.ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <label className="search">
        <IconSearch size={16} />
        <span className="sr-only">Search</span>
        <input placeholder="Search issues, buildings, departments or promises..." />
      </label>
      <button className="icon-btn" aria-label="3 notifications">
        <IconBell size={18} />
        <span className="dot-count">3</span>
      </button>
      <div className="user-chip">
        <span className="avatar">{STAFF_USER.initials}</span>
        <div>
          <b>{STAFF_USER.name}</b>
          <span>{STAFF_USER.role}</span>
        </div>
        <IconChevron size={16} />
      </div>
    </header>
  );
}
