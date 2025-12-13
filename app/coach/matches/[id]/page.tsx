import { redirect } from "next/navigation";

export default function CoachMatchRedirect({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/matches/${params.id}`);
}
