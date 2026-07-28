import { redirect } from "next/navigation";

type Props = { params: Promise<{ jobId: string }> };

/** Owner share UI lives on the result page with tokenized public links. */
export default async function LegacyShareRedirect({ params }: Props) {
  const { jobId } = await params;
  redirect(`/result/${jobId}`);
}
