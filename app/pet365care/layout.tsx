import Pet365BottomNav from "@/components/pet365care/BottomNav";

export const metadata = { title: "Pet365Care — 스마트 펫 케어" };

export default function Pet365CareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full h-full bg-[#F4F4F6] flex flex-col relative overflow-hidden font-[Plus_Jakarta_Sans,sans-serif]">
      <div className="flex-1 overflow-y-auto hide-scrollbar pb-24 relative z-0">
        {children}
      </div>
      <Pet365BottomNav />
    </div>
  );
}
