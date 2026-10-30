import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div className="shell page" role="status" aria-label="กำลังโหลดข้อมูล">
      <Skeleton className="h-10 w-64 mb-6" />
      <Skeleton className="h-20 w-full mb-8" />
      <div className="loading-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-72 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
