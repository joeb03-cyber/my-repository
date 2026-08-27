import { redirect } from "next/navigation";
import { getControlAdmin } from "@/lib/brain/control-auth.server";
import ControlCenter from "@/components/control/control-center";

export const dynamic = "force-dynamic";

export default async function ControlPage() {
  if (!(await getControlAdmin())) redirect("/control/login");
  return <ControlCenter />;
}
