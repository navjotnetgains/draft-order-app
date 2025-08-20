import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { billing } = await authenticate.admin(request);

  // Cancel all active subscriptions
  const activeSubscriptions = await billing.check();
  for (const sub of activeSubscriptions) {
    await billing.cancel({ subscriptionId: sub.id, isTest: sub.test });
  }

  return redirect("/app/pricing");
}
