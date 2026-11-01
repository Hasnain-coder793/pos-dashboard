import Tabs from "@/components/Tabs";

const tabs = [
  { href: "/items", label: "Items" },
  { href: "/items/requests", label: "Change Requests" },
];

export default function ItemsTabs({ active }: { active: string }) {
  return <Tabs tabs={tabs} active={active} />;
}
