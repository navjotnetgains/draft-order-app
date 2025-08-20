import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { MONTHLY_PLAN, ANNUAL_PLAN } from "../shopify.server";

const PLANS = {
  free: null,
  monthly: {
    name: MONTHLY_PLAN.name,
    isTest:  MONTHLY_PLAN.test,
  },
  annual: {
    name: ANNUAL_PLAN.name,
    isTest: ANNUAL_PLAN.test,
  },
};

export async function loader({ request }) {
  let session, billing;
  try {
    ({ billing, session } = await authenticate.admin(request));
  } catch (err) {
    // Not logged in, redirect to login page
    return redirect("/auth/login");
  }

  const { shop } = session;
  const url = new URL(request.url);
  const planKey = url.searchParams.get("plan");

  if (!planKey || !PLANS[planKey]) {
    return redirect("/app/pricing");
  }

  if (planKey === "free") {
    return redirect("/app");
  }

  const planInfo = PLANS[planKey];

  return billing.require({
    plans: [planInfo.name],
    isTest: planInfo.isTest,
    onFailure: async () =>
      billing.request({
        plan: planInfo.name,
        isTest: planInfo.isTest,
        returnUrl: `${url.origin}/app/pricing`,
      }),
  });
}
