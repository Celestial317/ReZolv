"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useApi } from "@/lib/api";
import { cat, CATEGORY } from "@/lib/format";
import { Async, CatTag, Empty, PageHead, StatusTag } from "@/components/ui";
import type { Pin } from "@/components/MapView";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false, loading: () => <div className="map" /> });

type Item = { id: string; code: string; title: string; category: string; status: string; report_count: number; location: string; lat: number; lng: number };

export default function CampusMapPage() {
  const router = useRouter();
  const data = useApi<Item[]>("/admin/map");
  const [active, setActive] = useState<string | null>(null);

  const pins: Pin[] = useMemo(() => (data.data ?? []).map((i) => ({
    id: i.id, at: [i.lat, i.lng] as [number, number], count: i.report_count, color: cat(i.category).pin,
  })), [data.data]);

  return (
    <>
      <PageHead title="Campus map" />
      <Async state={data}>
        {(items) => (
          <div className="split">
            <div className="stack">
              <div className="map"><MapView pins={pins} activeId={active} onPick={setActive} /></div>
              <div className="row">{Object.keys(CATEGORY).map((k) => <CatTag key={k} category={k} />)}</div>
            </div>
            <div className="card">
              {items.length === 0 ? <Empty>No open issues on campus</Empty> : (
                <table>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id} className="link" style={active === i.id ? { background: "var(--teal-50)" } : undefined}
                        onMouseEnter={() => setActive(i.id)} onClick={() => router.push(`/issues/${i.id}`)}>
                        <td style={{ boxShadow: `inset 5px 0 0 ${cat(i.category).pin}` }}><span className="code">{i.code}</span> <b>{i.title}</b><div className="sub">{i.location} · {i.report_count} reports</div></td>
                        <td><StatusTag status={i.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Async>
    </>
  );
}
