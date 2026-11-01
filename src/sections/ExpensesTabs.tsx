import Tabs from "@/components/Tabs";

const tabs = [
  { href: "/expenses", label: "Expenses" },
  { href: "/expenses/requests", label: "Change Requests" },
];

export default function ExpensesTabs({ active }: { active: string }) {
  return <Tabs tabs={tabs} active={active} />;
}
