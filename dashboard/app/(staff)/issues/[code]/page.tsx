import { notFound } from "next/navigation";
import Topbar from "@/components/Topbar";
import { getIssueDetail } from "@/lib/mock";
import IssueDetailView from "./IssueDetailView";

export default async function IssuePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const detail = getIssueDetail(decodeURIComponent(code));
  if (!detail) notFound();
  return (
    <>
      <Topbar title={detail.issue.code} sub={`Issues / ${detail.issue.code}`} />
      <IssueDetailView detail={detail} />
    </>
  );
}
