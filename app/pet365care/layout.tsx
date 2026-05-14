import Pet365BottomNav from "@/components/pet365care/BottomNav";
import "./pet365-layout.css";

export const metadata = { title: "Pet365Care — 스마트 펫 케어" };

export default function Pet365CareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pet365-root font-[Plus_Jakarta_Sans,sans-serif]">
      <div className="pet365-content">
        {children}
      </div>
      <Pet365BottomNav />
    </div>
  );
}
